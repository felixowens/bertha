//! Random ids and secrets.

use rand::Rng;
use sha2::{Digest, Sha256};

const ALPHABET: &[u8] = b"0123456789abcdefghjkmnpqrstvwxyz";

fn chars(n: usize) -> String {
    let mut rng = rand::rng();
    (0..n).map(|_| ALPHABET[rng.random_range(0..ALPHABET.len())] as char).collect()
}

/// `prefix_` plus 12 random characters (60 bits), e.g. `p_7k2m9x4q1dwz`.
pub fn id(prefix: &str) -> String {
    format!("{prefix}_{}", chars(12))
}

/// A secret with 160 bits of entropy, prefixed so a leaked one is easy to recognise,
/// e.g. `bk_live_…` for ingest keys.
pub fn secret(prefix: &str) -> String {
    format!("{prefix}{}", chars(32))
}

/// Secrets are stored only as their SHA-256 hash.
pub fn hash(secret: &str) -> Vec<u8> {
    Sha256::digest(secret.as_bytes()).to_vec()
}

#[cfg(test)]
mod tests {
    #[test]
    fn shapes() {
        let id = super::id("p");
        assert!(id.starts_with("p_") && id.len() == 14);
        assert_ne!(super::secret("t_"), super::secret("t_"));
        assert_eq!(super::hash("a").len(), 32);
    }
}
