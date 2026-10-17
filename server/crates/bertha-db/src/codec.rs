//! How domain values are stored: enum sets as bitmasks, payloads as deflated JSON,
//! short ids in base 36.

use std::io::{Read, Write};

use bertha_core::domain::{Environment, Runtime};
use flate2::Compression;
use flate2::read::DeflateDecoder;
use flate2::write::DeflateEncoder;

use crate::{Error, Result};

pub fn env_bit(e: Environment) -> i64 {
    match e {
        Environment::Production => 1,
        Environment::Staging => 2,
        Environment::Development => 4,
    }
}

pub fn env_mask(envs: &[Environment]) -> i64 {
    envs.iter().fold(0, |m, e| m | env_bit(*e))
}

pub fn envs(mask: i64) -> Vec<Environment> {
    Environment::ALL.iter().copied().filter(|e| mask & env_bit(*e) != 0).collect()
}

pub fn env_from_bit(bit: i64) -> Result<Environment> {
    envs(bit).first().copied().ok_or_else(|| Error::Corrupt(format!("environment bit {bit}")))
}

pub fn runtime_bit(r: Runtime) -> i64 {
    match r {
        Runtime::Browser => 1,
        Runtime::Server => 2,
        Runtime::Edge => 4,
    }
}

pub fn runtime_mask(rs: &[Runtime]) -> i64 {
    rs.iter().fold(0, |m, r| m | runtime_bit(*r))
}

pub fn runtimes(mask: i64) -> Vec<Runtime> {
    Runtime::ALL.iter().copied().filter(|r| mask & runtime_bit(*r) != 0).collect()
}

/// Parses a stored enum value written by bertha itself.
pub fn parse<T>(s: &str, f: impl Fn(&str) -> Option<T>) -> Result<T> {
    f(s).ok_or_else(|| Error::Corrupt(format!("unexpected value {s:?}")))
}

pub fn deflate(bytes: &[u8]) -> Vec<u8> {
    let mut enc = DeflateEncoder::new(Vec::with_capacity(bytes.len() / 3), Compression::fast());
    // Writing to a Vec cannot fail.
    let _ = enc.write_all(bytes);
    enc.finish().unwrap_or_default()
}

/// Inflates at most `limit` bytes; more than that is treated as damage.
pub fn inflate(bytes: &[u8], limit: usize) -> Result<Vec<u8>> {
    let mut out = Vec::new();
    let mut dec = DeflateDecoder::new(bytes).take(limit as u64 + 1);
    dec.read_to_end(&mut out).map_err(|e| Error::Corrupt(e.to_string()))?;
    if out.len() > limit {
        return Err(Error::Corrupt("payload larger than its limit".into()));
    }
    Ok(out)
}

pub fn to_blob<T: serde::Serialize>(v: &T) -> Result<Vec<u8>> {
    Ok(deflate(&serde_json::to_vec(v)?))
}

pub fn from_blob<T: serde::de::DeserializeOwned>(b: &[u8], limit: usize) -> Result<T> {
    Ok(serde_json::from_slice(&inflate(b, limit)?)?)
}

const BASE36: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/// `KILN` + 159 → `KILN-4F`.
pub fn short_id(key: &str, seq: i64) -> String {
    let mut n = seq.max(0) as u64;
    let mut digits = Vec::new();
    loop {
        digits.push(BASE36[(n % 36) as usize]);
        n /= 36;
        if n == 0 {
            break;
        }
    }
    digits.reverse();
    format!("{key}-{}", String::from_utf8_lossy(&digits))
}

/// The sequence number back from a short id's suffix.
pub fn short_seq(short_id: &str) -> Option<i64> {
    let suffix = short_id.rsplit_once('-')?.1;
    i64::from_str_radix(suffix, 36).ok()
}

/// A project key from its name: the first letters of its words, or its first four
/// letters, uppercased. `Kiln & Clay` → `KILN`.
pub fn key_from_name(name: &str) -> String {
    let words: Vec<String> = name
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .map(|w| w.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>())
        .filter(|w| !w.is_empty())
        .collect();
    let first = words.first().cloned().unwrap_or_else(|| "PROJ".into());
    let key: String = if first.len() >= 3 || words.len() < 3 {
        first.chars().take(4).collect()
    } else {
        words.iter().filter_map(|w| w.chars().next()).take(4).collect()
    };
    let key = key.to_ascii_uppercase();
    if key.chars().next().is_some_and(|c| c.is_ascii_digit()) { format!("P{key}") } else { key }
}

/// Lowercased with runs of non-alphanumerics collapsed, for "name taken" checks.
pub fn normalize_name(name: &str) -> String {
    name.split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .map(|w| w.to_lowercase())
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_round_trip() {
        let e = vec![Environment::Production, Environment::Development];
        assert_eq!(envs(env_mask(&e)), e);
        let r = vec![Runtime::Server, Runtime::Edge];
        assert_eq!(runtimes(runtime_mask(&r)), r);
    }

    #[test]
    fn short_ids() {
        assert_eq!(short_id("KILN", 159), "KILN-4F");
        assert_eq!(short_id("KILN", 20), "KILN-K");
        assert_eq!(short_seq("KILN-4F"), Some(159));
        assert_eq!(short_seq("MY-APP-1A"), Some(46));
    }

    #[test]
    fn deflate_round_trip_and_limit() {
        let data = vec![b'a'; 10_000];
        let z = deflate(&data);
        assert!(z.len() < 200);
        assert_eq!(inflate(&z, 10_000).ok(), Some(data));
        assert!(inflate(&z, 9_999).is_err());
    }

    #[test]
    fn keys_and_names() {
        assert_eq!(key_from_name("Kiln & Clay"), "KILN");
        assert_eq!(key_from_name("a b c"), "ABC");
        assert_eq!(key_from_name("42 things"), "P42");
        assert_eq!(normalize_name("  Kiln & Clay "), "kiln clay");
        assert_eq!(normalize_name("kiln-clay"), "kiln clay");
    }
}
