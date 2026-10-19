-- What agents report about bertha itself: problems it caused them, and features they
-- wanted. The member's name and email are copied, so a report outlives their access.
CREATE TABLE agent_reports (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('problem', 'request')),
  summary      TEXT NOT NULL,
  details      TEXT NOT NULL,
  tool         TEXT,
  issue_id     TEXT REFERENCES issues (id) ON DELETE SET NULL,
  version      TEXT NOT NULL,
  member_id    TEXT NOT NULL,
  member_name  TEXT NOT NULL,
  member_email TEXT NOT NULL,
  via          TEXT NOT NULL,
  done_at      INTEGER,
  created_at   INTEGER NOT NULL
) STRICT;

CREATE INDEX agent_reports_created ON agent_reports (created_at DESC);
CREATE INDEX agent_reports_member ON agent_reports (member_id, created_at DESC);
CREATE INDEX agent_reports_issue ON agent_reports (issue_id);
