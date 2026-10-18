-- no-transaction
-- Several monitors per project, repo links, resolve in next release, merged issues and
-- a delivery log. Rebuilding `monitors` needs foreign keys off (a DROP would otherwise
-- cascade into checks and incidents), and that pragma only takes effect outside a
-- transaction, so this migration opens its own.

PRAGMA foreign_keys = OFF;

BEGIN;

CREATE TABLE monitors_new (
  id                   TEXT PRIMARY KEY,
  project_id           TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  url                  TEXT NOT NULL,
  interval_seconds     INTEGER NOT NULL CHECK (interval_seconds IN (60, 300, 900)),
  paused               INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0, 1)),
  state                TEXT NOT NULL CHECK (state IN ('up', 'down', 'degraded', 'paused')),
  since                INTEGER NOT NULL,
  latest_response_ms   INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  next_check_at        INTEGER NOT NULL,
  created_at           INTEGER NOT NULL
) STRICT;

INSERT INTO monitors_new SELECT id, project_id, name, url, interval_seconds, paused, state, since,
  latest_response_ms, consecutive_failures, next_check_at, created_at FROM monitors;
DROP TABLE monitors;
ALTER TABLE monitors_new RENAME TO monitors;
CREATE INDEX monitors_project ON monitors (project_id, created_at);

-- Where the code lives, so commits on releases can link to it.
ALTER TABLE projects ADD COLUMN repo_url TEXT;

-- Set by "resolve in the next release": events still tagged with this version are the
-- old code running out, not a regression.
ALTER TABLE issues ADD COLUMN resolved_in_release TEXT;

-- Fingerprints of issues merged into another one. New events with one of these land
-- on `issue_id`.
CREATE TABLE issue_aliases (
  project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  fingerprint BLOB NOT NULL,
  issue_id    TEXT NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, fingerprint)
) STRICT, WITHOUT ROWID;

CREATE INDEX issue_aliases_issue ON issue_aliases (issue_id);

-- When a delivery was last tried, for the alerts page's history.
ALTER TABLE alert_deliveries ADD COLUMN tried_at INTEGER;
UPDATE alert_deliveries SET tried_at = created_at WHERE attempts > 0;
CREATE INDEX alert_deliveries_tried ON alert_deliveries (tried_at DESC) WHERE tried_at IS NOT NULL;

COMMIT;

PRAGMA foreign_keys = ON;
