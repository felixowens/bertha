//! What agents report about bertha itself, for the owner to read in Settings → Agents.

use bertha_core::api::{Outcome, SetAgentReportDoneFailure};
use bertha_core::domain::{AgentReport, AgentReportKind, Person, ReportIssue};
use bertha_core::ids::{AgentReportId, IssueId, MemberId, ProjectId};
use bertha_core::random;
use bertha_core::time::{HOUR, IsoDate};

use crate::scope::Viewer;
use crate::writes::issues::NOTE_LIMIT;
use crate::{Db, Error, Result};

/// A summary is one line in a list.
pub const SUMMARY_LIMIT: usize = 200;
const TOOL_LIMIT: usize = 60;
/// An agent stuck in a loop can't bury the list.
pub const REPORTS_PER_HOUR: i64 = 30;

/// A report as an agent sends it. `issue_id` is already resolved and visible to it.
pub struct NewReport<'a> {
    pub kind: AgentReportKind,
    pub summary: &'a str,
    pub details: &'a str,
    pub tool: Option<&'a str>,
    pub issue_id: Option<&'a str>,
    pub version: &'a str,
}

impl Db {
    /// Records a report from the agent asking. Only agents report: a browser session is
    /// refused.
    pub async fn add_agent_report(&self, viewer: &Viewer, r: &NewReport<'_>) -> Result<AgentReport> {
        let via = viewer
            .agent()
            .ok_or_else(|| Error::Invalid("Reports come from agents, through an access token.".to_owned()))?;
        let summary = r.summary.trim();
        if summary.is_empty() {
            return Err(Error::Invalid("Say in the summary what got in your way. Nothing was sent.".to_owned()));
        }
        if summary.chars().count() > SUMMARY_LIMIT {
            return Err(Error::Invalid(format!(
                "Keep the summary to {SUMMARY_LIMIT} characters and put the rest in details. Nothing was sent."
            )));
        }
        let details = r.details.trim();
        if details.chars().count() > NOTE_LIMIT {
            return Err(Error::Invalid(format!("Keep the details to {NOTE_LIMIT} characters. Nothing was sent.")));
        }
        let tool = r.tool.map(str::trim).filter(|t| !t.is_empty());
        if tool.is_some_and(|t| t.chars().count() > TOOL_LIMIT) {
            return Err(Error::Invalid(
                "tool is the name of one bertha tool, like get_issue. Nothing was sent.".to_owned(),
            ));
        }
        let now = self.now();
        let since = now - HOUR;
        let member = viewer.id().0.as_str();
        let recent = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM agent_reports WHERE member_id = ? AND created_at > ?",
            member,
            since
        )
        .fetch_one(&self.read)
        .await?;
        if recent >= REPORTS_PER_HOUR {
            return Err(Error::Invalid(format!(
                "You've sent {REPORTS_PER_HOUR} reports in the last hour. bertha kept them; send more later."
            )));
        }
        let id = AgentReportId(random::id("ar"));
        let person = viewer.person();
        let kind = r.kind.as_str();
        sqlx::query!(
            "INSERT INTO agent_reports
               (id, kind, summary, details, tool, issue_id, version, member_id, member_name, member_email, via, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id.0,
            kind,
            summary,
            details,
            tool,
            r.issue_id,
            r.version,
            member,
            person.name,
            person.email,
            via,
            now
        )
        .execute(&self.write)
        .await?;
        let issue = match r.issue_id {
            Some(issue_id) => sqlx::query_scalar!("SELECT short_id FROM issues WHERE id = ?", issue_id)
                .fetch_optional(&self.read)
                .await?
                .map(|short_id| ReportIssue { id: IssueId(issue_id.to_owned()), short_id }),
            None => None,
        };
        Ok(AgentReport {
            id,
            kind: r.kind,
            summary: summary.to_owned(),
            details: details.to_owned(),
            tool: tool.map(str::to_owned),
            issue,
            version: r.version.to_owned(),
            by: person,
            via: via.to_owned(),
            at: IsoDate::from_millis(now),
            done: false,
        })
    }

    /// Newest first: every report for the owner, the viewer's own agents' otherwise. An
    /// issue the viewer can't see (any more) is left off its report.
    pub async fn agent_reports(&self, viewer: &Viewer) -> Result<Vec<AgentReport>> {
        let everyone = viewer.is_owner();
        let member = viewer.id().0.as_str();
        let rows = sqlx::query!(
            r#"SELECT r.id, r.kind, r.summary, r.details, r.tool, r.version, r.member_id, r.member_name,
                      r.member_email, r.via, r.done_at, r.created_at,
                      i.id AS "issue_id?", i.short_id AS "short_id?", i.project_id AS "project_id?"
               FROM agent_reports r LEFT JOIN issues i ON i.id = r.issue_id
               WHERE ? OR r.member_id = ?
               ORDER BY r.created_at DESC, r.id DESC
               LIMIT 500"#,
            everyone,
            member
        )
        .fetch_all(&self.read)
        .await?;
        rows.into_iter()
            .map(|r| {
                let kind = match r.kind.as_str() {
                    "problem" => AgentReportKind::Problem,
                    "request" => AgentReportKind::Request,
                    other => return Err(Error::Corrupt(format!("agent report kind {other}"))),
                };
                let issue = match (r.issue_id, r.short_id, r.project_id) {
                    (Some(id), Some(short_id), Some(project)) if viewer.can_see(&ProjectId(project.clone())) => {
                        Some(ReportIssue { id: IssueId(id), short_id })
                    }
                    _ => None,
                };
                Ok(AgentReport {
                    id: AgentReportId(r.id),
                    kind,
                    summary: r.summary,
                    details: r.details,
                    tool: r.tool,
                    issue,
                    version: r.version,
                    by: Person { id: MemberId(r.member_id), name: r.member_name, email: r.member_email },
                    via: r.via,
                    at: IsoDate::from_millis(r.created_at),
                    done: r.done_at.is_some(),
                })
            })
            .collect()
    }

    /// Owner only: marks a report dealt with, or open again.
    pub async fn set_agent_report_done(
        &self,
        viewer: &Viewer,
        report_id: &str,
        done: bool,
    ) -> Result<Outcome<(), SetAgentReportDoneFailure>> {
        if !viewer.is_owner() {
            return Ok(Outcome::fail(SetAgentReportDoneFailure::PermissionDenied));
        }
        let at = done.then(|| self.now());
        let changed = sqlx::query!(
            "UPDATE agent_reports SET done_at = CASE WHEN ?1 IS NULL THEN NULL ELSE COALESCE(done_at, ?1) END WHERE id = ?2",
            at,
            report_id
        )
        .execute(&self.write)
        .await?;
        Ok(if changed.rows_affected() == 0 {
            Outcome::fail(SetAgentReportDoneFailure::NotFound)
        } else {
            Outcome::Ok(())
        })
    }
}
