//! Mutation inputs and outcomes, mirroring `src/contract/actions.ts`.
//!
//! Every mutation has its own failure enum, so a handler can only return the failure
//! kinds the contract names for that operation, and the UI only ever sees those.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::domain::*;
use crate::ids::*;

/// The contract's `Result<T, F>`: `{ ok: true, value }` or
/// `{ ok: false, failure, message }`.
#[derive(Debug, Clone, PartialEq)]
pub enum Outcome<T, F> {
    Ok(T),
    Failed(F, String),
}

impl<T, F: Failure> Outcome<T, F> {
    /// A failure with its standard message.
    pub fn fail(f: F) -> Self {
        let msg = f.message().to_owned();
        Outcome::Failed(f, msg)
    }

    /// A failure with a message that says more than the standard one.
    pub fn fail_with(f: F, message: impl Into<String>) -> Self {
        Outcome::Failed(f, message.into())
    }
}

impl<T, F> Outcome<T, F> {
    pub fn map<U>(self, f: impl FnOnce(T) -> U) -> Outcome<U, F> {
        match self {
            Outcome::Ok(v) => Outcome::Ok(f(v)),
            Outcome::Failed(e, m) => Outcome::Failed(e, m),
        }
    }
}

impl<T: Serialize, F: Serialize> Serialize for Outcome<T, F> {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        match self {
            Outcome::Ok(v) => {
                let mut st = s.serialize_struct("Ok", 2)?;
                st.serialize_field("ok", &true)?;
                st.serialize_field("value", v)?;
                st.end()
            }
            Outcome::Failed(f, m) => {
                let mut st = s.serialize_struct("Failed", 3)?;
                st.serialize_field("ok", &false)?;
                st.serialize_field("failure", f)?;
                st.serialize_field("message", m)?;
                st.end()
            }
        }
    }
}

/// A named failure kind with the message bertha shows for it.
pub trait Failure: Copy + Serialize {
    fn message(self) -> &'static str;
}

/// Declares a failure enum: wire name and default message per kind.
macro_rules! failures {
    ($name:ident { $($variant:ident = $wire:literal : $msg:literal),+ $(,)? }) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
        #[ts(export, export_to = "src/api/generated/api.ts")]
        pub enum $name {
            $(#[serde(rename = $wire)] $variant),+
        }

        impl Failure for $name {
            fn message(self) -> &'static str {
                match self { $($name::$variant => $msg),+ }
            }
        }
    };
}

failures!(UpdateIssuesFailure {
    NotFound = "not_found": "That no longer exists. It may have been deleted with its project.",
    PermissionDenied = "permission_denied": "You don't have access to do that any more.",
    Conflict = "conflict": "Someone changed one of these issues a moment ago. Showing the current state.",
});
failures!(AddIssueNoteFailure {
    NotFound = "not_found": "That issue no longer exists. It may have been deleted with its project.",
});
failures!(CreateProjectFailure {
    NameTaken = "name_taken": "A project with that name already exists.",
    InvalidName = "invalid_name": "Use at least one letter or number.",
    KeyTaken = "key_taken": "Another project already uses that key. Pick another.",
    InvalidKey = "invalid_key": "Keys are 2 to 6 capital letters or digits, starting with a letter.",
});
failures!(UpdateProjectFailure {
    NameTaken = "name_taken": "A project with that name already exists.",
    InvalidName = "invalid_name": "Use at least one letter or number.",
    PermissionDenied = "permission_denied": "Only the owner can change a project. Nothing was changed.",
});
failures!(RotateIngestKeyFailure {
    PermissionDenied = "permission_denied": "Only the owner can rotate the key. Nothing was changed.",
});
failures!(DeleteProjectFailure {
    NameMismatch = "name_mismatch": "That doesn't match the project name.",
    PermissionDenied = "permission_denied": "Only the owner can delete a project. Nothing was deleted.",
});
failures!(SaveMonitorFailure {
    InvalidUrl = "invalid_url": "Enter a full URL, starting with https://",
    Unreachable = "unreachable": "The first check failed.",
});
failures!(DeleteMonitorFailure {
    NotFound = "not_found": "That monitor was already deleted.",
    PermissionDenied = "permission_denied": "Only the owner can delete a monitor. Nothing was deleted.",
});
failures!(CheckMonitorNowFailure {
    NotFound = "not_found": "That monitor no longer exists. It may have been deleted in another tab.",
});
failures!(SaveAlertRuleFailure {
    NoDestination = "no_destination": "Pick at least one destination.",
    NoTrigger = "no_trigger": "Pick at least one trigger.",
});
failures!(DeleteAlertRuleFailure {
    NotFound = "not_found": "That rule was already deleted.",
});
failures!(SaveDestinationFailure {
    InvalidEmail = "invalid_email": "That isn't a complete email address.",
    InvalidWebhook = "invalid_webhook": "Webhook URLs must start with https://",
});
failures!(TestDestinationFailure {
    DeliveryFailed = "delivery_failed": "The test alert wasn't delivered.",
});
failures!(DeleteDestinationFailure {
    NotFound = "not_found": "That destination was already deleted.",
});
failures!(MergeIssuesFailure {
    NotFound = "not_found": "One of those issues no longer exists. Nothing was merged.",
    DifferentProjects = "different_projects": "Only issues in the same project can be merged. Nothing was merged.",
});
failures!(ResendInviteFailure {
    NotFound = "not_found": "That invitation was revoked. Invite them again if they still need access.",
    AlreadyMember = "already_member": "They already accepted. Nothing was sent.",
});
failures!(CreateAccessTokenFailure {
    InvalidName = "invalid_name": "Name it after the agent or machine, like \"claude on laptop\".",
});
failures!(RevokeAccessTokenFailure {
    NotFound = "not_found": "That token was already revoked.",
});
failures!(SetAgentReportDoneFailure {
    NotFound = "not_found": "That report no longer exists.",
    PermissionDenied = "permission_denied": "Only the owner can mark reports done. Nothing was changed.",
});
failures!(InviteMemberFailure {
    AlreadyMember = "already_member": "They already have access.",
    InvalidEmail = "invalid_email": "That isn't a complete email address.",
});
failures!(UpdateMemberAccessFailure {
    PermissionDenied = "permission_denied": "Only the owner can change access. Nothing was changed.",
});
failures!(RemoveMemberFailure {
    CannotRemoveOwner = "cannot_remove_owner": "The owner can't be removed.",
});
failures!(AcceptInviteFailure {
    InviteExpired = "invite_expired": "This invitation expired. Invitations last 7 days.",
    InviteUsed = "invite_used": "This invitation was already accepted.",
});
failures!(SignInFailure {
    UnknownEmail = "unknown_email": "There's no account for that email.",
});

// ── Inputs ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub enum IssueChange {
    Resolve {
        /// Events from the release running now don't count as a regression.
        #[serde(
            rename = "inNextRelease",
            default,
            skip_serializing_if = "Option::is_none",
            with = "crate::domain::only_true"
        )]
        #[ts(optional, type = "true")]
        in_next_release: Option<bool>,
    },
    Ignore,
    Snooze {
        snooze: Snooze,
    },
    Reopen,
    Assign {
        #[serde(rename = "personId")]
        person_id: Option<MemberId>,
    },
}

/// What the client last saw of an issue it is changing. If the issue has moved on
/// since, `updateIssues` answers `conflict` instead of overwriting someone's triage.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct SeenIssue {
    pub id: IssueId,
    pub status: IssueStatus,
    pub assignee_id: Option<MemberId>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct UpdateIssuesInput {
    pub issue_ids: Vec<IssueId>,
    pub change: IssueChange,
    /// Optional: when present, enables conflict detection.
    #[serde(default)]
    #[ts(optional)]
    pub seen: Option<Vec<SeenIssue>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct NoteInput {
    pub body: Prose,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct CreateProjectInput {
    pub name: String,
    pub client: Option<String>,
    pub url: Option<String>,
    pub repo_url: Option<String>,
    pub runtimes: Vec<Runtime>,
    pub environments: Vec<Environment>,
    /// The issue id prefix; made from the name when absent. It can't change later.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub key: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct ProjectInput {
    pub name: String,
    pub client: Option<String>,
    pub url: Option<String>,
    pub repo_url: Option<String>,
    pub runtimes: Vec<Runtime>,
    pub environments: Vec<Environment>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct MergeIssuesInput {
    pub target_id: IssueId,
    pub source_ids: Vec<IssueId>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct DeleteProjectInput {
    pub confirm_name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct MonitorInput {
    #[serde(default)]
    #[ts(optional)]
    pub id: Option<MonitorId>,
    pub project_id: ProjectId,
    pub name: String,
    pub url: String,
    #[ts(type = "60 | 300 | 900")]
    pub interval_seconds: u32,
    pub paused: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct AlertRuleInput {
    #[serde(default)]
    #[ts(optional)]
    pub id: Option<AlertRuleId>,
    pub name: String,
    pub project_ids: ProjectIds,
    pub environments: Vec<Environment>,
    pub triggers: Vec<AlertTrigger>,
    pub spike: Option<Spike>,
    pub destination_ids: Vec<DestinationId>,
    pub enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub enum DestinationInput {
    Email {
        /// Set to edit that destination.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        id: Option<DestinationId>,
        address: String,
    },
    Webhook {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        id: Option<DestinationId>,
        label: String,
        url: String,
    },
}

impl DestinationInput {
    pub fn id(&self) -> Option<&DestinationId> {
        match self {
            DestinationInput::Email { id, .. } | DestinationInput::Webhook { id, .. } => id.as_ref(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct InviteInput {
    pub email: String,
    pub project_ids: Vec<ProjectId>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct CreateAccessTokenInput {
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct AgentReportDoneInput {
    pub done: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct MemberAccessInput {
    pub project_ids: Vec<ProjectId>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct SignInInput {
    pub email: String,
    /// Where to land after following the link. Only same-site paths are kept.
    #[serde(default)]
    #[ts(optional)]
    pub next: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct IssueQuery {
    pub filter: IssueFilter,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn outcome_matches_the_contract_shape() {
        let ok: Outcome<u32, SignInFailure> = Outcome::Ok(3);
        assert_eq!(serde_json::to_string(&ok).ok(), Some(r#"{"ok":true,"value":3}"#.into()));
        let failed: Outcome<u32, SignInFailure> = Outcome::fail(SignInFailure::UnknownEmail);
        assert_eq!(
            serde_json::to_string(&failed).ok(),
            Some(r#"{"ok":false,"failure":"unknown_email","message":"There's no account for that email."}"#.into())
        );
    }

    #[test]
    fn issue_change_parses_contract_json() {
        let c: IssueChange = serde_json::from_str(r#"{"kind":"assign","personId":null}"#).expect("parses");
        assert_eq!(c, IssueChange::Assign { person_id: None });
        let c: IssueChange =
            serde_json::from_str(r#"{"kind":"snooze","snooze":{"kind":"events","total":100,"remaining":100}}"#)
                .expect("parses");
        assert!(matches!(c, IssueChange::Snooze { .. }));
    }
}
