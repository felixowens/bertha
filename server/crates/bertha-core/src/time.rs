//! Time on the wire is an ISO 8601 string; inside bertha it is Unix milliseconds.

use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use ts_rs::TS;

/// Unix milliseconds. Everything stored and compared inside bertha uses this.
pub type Millis = i64;

pub const SECOND: Millis = 1_000;
pub const MINUTE: Millis = 60 * SECOND;
pub const HOUR: Millis = 60 * MINUTE;
pub const DAY: Millis = 24 * HOUR;

/// ISO 8601 date-time as sent to the UI: `2026-10-13T09:12:00Z`, or
/// `2026-10-13T09:12:00.481Z` when it falls between seconds.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct IsoDate(pub String);

impl IsoDate {
    pub fn from_millis(ms: Millis) -> Self {
        Self(format_millis(ms))
    }

    /// Parses the string back to milliseconds. `None` if it isn't RFC 3339.
    pub fn millis(&self) -> Option<Millis> {
        parse_millis(&self.0)
    }
}

pub fn now_millis() -> Millis {
    (OffsetDateTime::now_utc().unix_timestamp_nanos() / 1_000_000) as Millis
}

/// UTC with a `Z`, the shape the fixtures and UI use. Milliseconds are written only
/// when there are some, so whole seconds read as they always have; breadcrumbs need
/// them to show what happened in what order.
pub fn format_millis(ms: Millis) -> String {
    let secs = ms.div_euclid(1000);
    let dt = OffsetDateTime::from_unix_timestamp(secs).unwrap_or(OffsetDateTime::UNIX_EPOCH);
    let (y, mo, d) = (dt.year(), dt.month() as u8, dt.day());
    let (h, mi, s) = (dt.hour(), dt.minute(), dt.second());
    match ms.rem_euclid(1000) {
        0 => format!("{y:04}-{mo:02}-{d:02}T{h:02}:{mi:02}:{s:02}Z"),
        frac => format!("{y:04}-{mo:02}-{d:02}T{h:02}:{mi:02}:{s:02}.{frac:03}Z"),
    }
}

pub fn parse_millis(s: &str) -> Option<Millis> {
    let dt = OffsetDateTime::parse(s, &Rfc3339).ok().or_else(|| {
        // A bare date means midnight UTC.
        OffsetDateTime::parse(&format!("{s}T00:00:00Z"), &Rfc3339).ok()
    })?;
    Some((dt.unix_timestamp_nanos() / 1_000_000) as Millis)
}

/// Start of the hour containing `ms`.
pub fn floor_hour(ms: Millis) -> Millis {
    ms - ms.rem_euclid(HOUR)
}

/// Start of the UTC day containing `ms`.
pub fn floor_day(ms: Millis) -> Millis {
    ms - ms.rem_euclid(DAY)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips() {
        let ms = parse_millis("2026-10-13T09:12:00Z").expect("parses");
        assert_eq!(format_millis(ms), "2026-10-13T09:12:00Z");
        assert_eq!(parse_millis("2026-10-13"), parse_millis("2026-10-13T00:00:00Z"));
        assert_eq!(parse_millis("2026-10-13T10:12:00+01:00"), Some(ms));
        let precise = parse_millis("2026-10-13T09:12:00.048Z").expect("parses");
        assert_eq!(precise, ms + 48);
        assert_eq!(format_millis(precise), "2026-10-13T09:12:00.048Z");
    }

    #[test]
    fn floors() {
        let ms = parse_millis("2026-10-13T09:12:34Z").expect("parses");
        assert_eq!(format_millis(floor_hour(ms)), "2026-10-13T09:00:00Z");
        assert_eq!(format_millis(floor_day(ms)), "2026-10-13T00:00:00Z");
    }
}
