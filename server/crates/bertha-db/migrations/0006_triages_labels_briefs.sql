-- Triages: one go at an issue, by a person or their agent, and what came of it. The
-- person is a snapshot, like activity, so a triage outlives its author's access.
CREATE TABLE triages (
  id           TEXT PRIMARY KEY,
  issue_id     TEXT NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  member_id    TEXT NOT NULL,
  member_name  TEXT NOT NULL,
  member_email TEXT NOT NULL,
  -- The access token's name when an agent started it.
  via          TEXT,
  started_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  -- Null while it's going on.
  outcome      TEXT CHECK (outcome IN ('fixed', 'not_a_bug', 'cant_fix', 'needs_data', 'abandoned')),
  found        TEXT,
  tried        TEXT,
  fix          TEXT,
  -- The release the issue was on when the triage started.
  release      TEXT
) STRICT;

CREATE INDEX triages_issue ON triages (issue_id, started_at DESC);
-- At most one triage going on per issue.
CREATE UNIQUE INDEX triages_active ON triages (issue_id) WHERE outcome IS NULL;

-- Labels people and agents put on issues. Lowercase; created by using them.
CREATE TABLE issue_labels (
  issue_id TEXT NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  label    TEXT NOT NULL,
  PRIMARY KEY (issue_id, label)
) STRICT, WITHOUT ROWID;

CREATE INDEX issue_labels_label ON issue_labels (label, issue_id);

-- What anyone triaging the project should know: the stack, hosting, known noise.
ALTER TABLE projects ADD COLUMN brief TEXT;
