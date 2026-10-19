//! Newtype ids, so a project id can't be passed where an issue id is expected.
//! On the wire they are plain strings.

use std::fmt;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

macro_rules! id {
    ($name:ident, $prefix:literal) => {
        #[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
        #[serde(transparent)]
        #[ts(export, export_to = "src/api/generated/api.ts")]
        pub struct $name(pub String);

        impl $name {
            pub const PREFIX: &'static str = $prefix;

            /// A fresh random id, e.g. `p_7k2m9x4q1d`.
            pub fn generate() -> Self {
                Self(crate::random::id($prefix))
            }

            pub fn as_str(&self) -> &str {
                &self.0
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str(&self.0)
            }
        }

        impl From<String> for $name {
            fn from(s: String) -> Self {
                Self(s)
            }
        }

        impl From<&str> for $name {
            fn from(s: &str) -> Self {
                Self(s.to_owned())
            }
        }
    };
}

id!(ProjectId, "p");
id!(IssueId, "i");
id!(EventId, "e");
id!(ReleaseId, "r");
id!(MonitorId, "mon");
id!(IncidentId, "inc");
id!(MemberId, "m");
id!(AlertRuleId, "a");
id!(DestinationId, "d");
id!(AccessTokenId, "at");
id!(AgentReportId, "ar");
