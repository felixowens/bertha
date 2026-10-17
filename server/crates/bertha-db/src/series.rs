//! Turning hourly rollups into the contract's bucketed series.
//!
//! A bucket is `None` ("no data", drawn hatched) when no project in view was known to
//! be alive in any of its hours, and a count, possibly 0, when one was.

use std::collections::{HashMap, HashSet};

use bertha_core::domain::{Bucket, TimeSeries};
use bertha_core::time::{DAY, HOUR, IsoDate, Millis, floor_day, floor_hour};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Grid {
    pub start: Millis,
    pub step: Millis,
    pub len: usize,
}

impl Grid {
    /// `len` hourly buckets, the last one containing `now`.
    pub fn hours_ending(now: Millis, len: usize) -> Grid {
        Grid { start: floor_hour(now) - (len as Millis - 1) * HOUR, step: HOUR, len }
    }

    /// `len` UTC-day buckets, the last one containing `now`.
    pub fn days_ending(now: Millis, len: usize) -> Grid {
        Grid { start: floor_day(now) - (len as Millis - 1) * DAY, step: DAY, len }
    }

    /// `len` equal buckets of `span / len` (whole hours), ending with the current hour.
    pub fn split(now: Millis, span: Millis, len: usize) -> Grid {
        let step = (span / len as Millis).max(HOUR) / HOUR * HOUR;
        Grid { start: floor_hour(now) + HOUR - step * len as Millis, step, len }
    }

    pub fn end(&self) -> Millis {
        self.start + self.step * self.len as Millis
    }

    pub fn index(&self, t: Millis) -> Option<usize> {
        if t < self.start || t >= self.end() {
            return None;
        }
        Some(((t - self.start) / self.step) as usize)
    }

    pub fn bucket(&self) -> Bucket {
        if self.step >= DAY { Bucket::Day } else { Bucket::Hour }
    }

    /// Sums `(hour, count)` into buckets, with `None` for buckets with no alive hour.
    pub fn fill(&self, counts: impl IntoIterator<Item = (Millis, i64)>, alive: &HashSet<Millis>) -> Vec<Option<u32>> {
        let mut out: Vec<Option<u32>> = vec![None; self.len];
        for h in alive {
            if let Some(i) = self.index(*h) {
                out[i] = Some(0);
            }
        }
        for (h, c) in counts {
            if let Some(i) = self.index(h) {
                let v = out[i].unwrap_or(0);
                out[i] = Some(v.saturating_add(c.clamp(0, u32::MAX as i64) as u32));
            }
        }
        out
    }

    /// Plain sums with 0 for empty buckets, for KPI trends.
    pub fn sums(&self, counts: impl IntoIterator<Item = (Millis, i64)>) -> Vec<f64> {
        let mut out = vec![0.0; self.len];
        for (h, c) in counts {
            if let Some(i) = self.index(h) {
                out[i] += c as f64;
            }
        }
        out
    }

    pub fn series(&self, counts: Vec<Option<u32>>) -> TimeSeries {
        TimeSeries { bucket: self.bucket(), start: IsoDate::from_millis(self.start), counts }
    }
}

/// Hourly counts and alive hours per key (issue or project), fetched once for a page.
#[derive(Default)]
pub(crate) struct Hourly {
    pub counts: HashMap<String, Vec<(Millis, i64)>>,
}

impl Hourly {
    pub fn of(&self, key: &str) -> impl Iterator<Item = (Millis, i64)> + '_ {
        self.counts.get(key).into_iter().flatten().copied()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hours_and_days() {
        let now = 10 * DAY + 5 * HOUR + 30 * 60_000;
        let g = Grid::hours_ending(now, 24);
        assert_eq!(g.end(), 10 * DAY + 6 * HOUR);
        assert_eq!(g.index(now), Some(23));
        let d = Grid::days_ending(now, 14);
        assert_eq!(d.start, -3 * DAY);
        assert_eq!(d.index(now), Some(13));
    }

    #[test]
    fn no_data_is_not_zero() {
        let g = Grid { start: 0, step: HOUR, len: 3 };
        let alive: HashSet<Millis> = [0, HOUR].into_iter().collect();
        assert_eq!(g.fill([(0, 4)], &alive), vec![Some(4), Some(0), None]);
    }

    #[test]
    fn split_covers_the_span() {
        let now = 100 * DAY + 30 * 60_000;
        let g = Grid::split(now, 7 * DAY, 12);
        assert_eq!(g.step, 14 * HOUR);
        assert_eq!(g.end(), floor_hour(now) + HOUR);
    }
}
