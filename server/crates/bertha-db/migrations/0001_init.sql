-- bertha schema. Times are Unix milliseconds (INTEGER). Environment and runtime sets
-- are bitmasks: production 1, staging 2, development 4; browser 1, server 2, edge 4.

-- ── People and sessions ─────────────────────────────────────────────────

CREATE TABLE members (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role         TEXT NOT NULL CHECK (role IN ('owner', 'collaborator')),
  -- The owner sees every project; collaborators see member_projects.
  all_projects INTEGER NOT NULL DEFAULT 0 CHECK (all_projects IN (0, 1)),
  invited_by   TEXT REFERENCES members (id) ON DELETE SET NULL,
  joined_at    INTEGER,
  created_at   INTEGER NOT NULL
) STRICT;

-- At most one owner.
CREATE UNIQUE INDEX members_one_owner ON members (role) WHERE role = 'owner';

CREATE TABLE projects (
  id             TEXT PRIMARY KEY,
  key            TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  name_norm      TEXT NOT NULL UNIQUE,
  client         TEXT,
  url            TEXT,
  runtimes       INTEGER NOT NULL,
  environments   INTEGER NOT NULL,
  -- Public: ships in browser bundles. Can only send events.
  ingest_key     TEXT NOT NULL UNIQUE,
  -- Secret, for CI: uploads source maps and records deploys.
  upload_key     TEXT NOT NULL UNIQUE,
  first_event_at INTEGER,
  last_event_at  INTEGER,
  next_short_seq INTEGER NOT NULL DEFAULT 1,
  created_at     INTEGER NOT NULL
) STRICT;

CREATE TABLE member_projects (
  member_id  TEXT NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  PRIMARY KEY (member_id, project_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX member_projects_project ON member_projects (project_id);

-- One-time links: sign-in (15 minutes) and invitations (7 days). Only hashes are kept.
CREATE TABLE tokens (
  hash       BLOB PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('sign_in', 'invite')),
  member_id  TEXT NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  next_path  TEXT,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER,
  created_at INTEGER NOT NULL
) STRICT;

CREATE INDEX tokens_member ON tokens (member_id, kind);

CREATE TABLE sessions (
  hash         BLOB PRIMARY KEY,
  member_id    TEXT NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
) STRICT;

CREATE INDEX sessions_member ON sessions (member_id);

-- ── Releases, issues and events ─────────────────────────────────────────

CREATE TABLE releases (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  version        TEXT NOT NULL,
  environment    INTEGER NOT NULL CHECK (environment IN (1, 2, 4)),
  deployed_at    INTEGER NOT NULL,
  commit_sha     TEXT,
  commit_message TEXT,
  commit_author  TEXT,
  created_at     INTEGER NOT NULL,
  UNIQUE (project_id, version, environment)
) STRICT;

CREATE INDEX releases_project ON releases (project_id, deployed_at DESC);

CREATE TABLE issues (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  short_seq        INTEGER NOT NULL,
  -- Project key + base-36 sequence, e.g. KILN-4F.
  short_id         TEXT NOT NULL,
  fingerprint      BLOB NOT NULL,
  type             TEXT NOT NULL,
  message          TEXT NOT NULL,
  culprit          TEXT,
  level            TEXT NOT NULL CHECK (level IN ('fatal', 'error', 'warning')),
  status           TEXT NOT NULL CHECK (status IN ('unresolved', 'resolved', 'ignored', 'snoozed')),
  snooze_until     INTEGER,
  snooze_total     INTEGER,
  snooze_remaining INTEGER,
  assignee_id      TEXT REFERENCES members (id) ON DELETE SET NULL,
  first_seen       INTEGER NOT NULL,
  last_seen        INTEGER NOT NULL,
  event_count      INTEGER NOT NULL DEFAULT 0,
  user_count       INTEGER NOT NULL DEFAULT 0,
  environments     INTEGER NOT NULL DEFAULT 0,
  first_release    TEXT,
  regressed_in     TEXT,
  regressed_at     INTEGER,
  resolved_at      INTEGER,
  -- Bumped on every triage change; lets updates detect concurrent edits.
  version          INTEGER NOT NULL DEFAULT 0,
  UNIQUE (project_id, fingerprint),
  UNIQUE (project_id, short_seq),
  CHECK ((status = 'snoozed') = (snooze_until IS NOT NULL OR snooze_total IS NOT NULL))
) STRICT;

CREATE INDEX issues_project_last ON issues (project_id, last_seen DESC);
CREATE INDEX issues_status_last ON issues (status, last_seen DESC);
CREATE INDEX issues_assignee ON issues (assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX issues_snooze_until ON issues (snooze_until) WHERE snooze_until IS NOT NULL;
CREATE INDEX issues_first_release ON issues (project_id, first_release);
CREATE INDEX issues_regressed_in ON issues (project_id, regressed_in) WHERE regressed_in IS NOT NULL;

-- Events per issue per hour: every chart and KPI reads this, never the events table.
CREATE TABLE issue_hourly (
  issue_id TEXT NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  hour     INTEGER NOT NULL,
  count    INTEGER NOT NULL,
  PRIMARY KEY (issue_id, hour)
) STRICT, WITHOUT ROWID;

CREATE INDEX issue_hourly_hour ON issue_hourly (hour);

-- Hours in which a project was known to be alive (an event or an SDK heartbeat).
-- A chart bucket with no activity is "no data" (null), not zero.
CREATE TABLE project_hours (
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  hour       INTEGER NOT NULL,
  PRIMARY KEY (project_id, hour)
) STRICT, WITHOUT ROWID;

CREATE TABLE issue_users (
  issue_id  TEXT NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  user_hash BLOB NOT NULL,
  PRIMARY KEY (issue_id, user_hash)
) STRICT, WITHOUT ROWID;

CREATE TABLE issue_tags (
  issue_id TEXT NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  key      TEXT NOT NULL CHECK (key IN ('url', 'browser', 'os', 'release', 'environment', 'user')),
  value    TEXT NOT NULL,
  count    INTEGER NOT NULL,
  PRIMARY KEY (issue_id, key, value)
) STRICT, WITHOUT ROWID;

-- Distinct values seen per tag key. Value rows are capped per key, so this can exceed
-- the number of rows in issue_tags.
CREATE TABLE issue_tag_keys (
  issue_id       TEXT NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  key            TEXT NOT NULL,
  distinct_count INTEGER NOT NULL,
  PRIMARY KEY (issue_id, key)
) STRICT, WITHOUT ROWID;

CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  issue_id    TEXT NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  -- Client-generated id, for dropping retried sends.
  client_id   TEXT,
  received_at INTEGER NOT NULL,
  -- The stored event (contract `Event` minus id/issueId), deflate-compressed JSON.
  payload     BLOB NOT NULL
) STRICT;

CREATE INDEX events_issue ON events (issue_id, received_at DESC);
CREATE INDEX events_received ON events (received_at);
CREATE UNIQUE INDEX events_client ON events (issue_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE activity (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id TEXT NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  at       INTEGER NOT NULL,
  -- The contract `Activity` as JSON, people as snapshots of who they were at the time.
  data     TEXT NOT NULL CHECK (json_valid(data))
) STRICT;

CREATE INDEX activity_issue ON activity (issue_id, at DESC);

CREATE TABLE sourcemaps (
  project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  debug_id    TEXT NOT NULL,
  file        TEXT NOT NULL,
  release     TEXT,
  -- Deflate-compressed source map JSON.
  data        BLOB NOT NULL,
  uploaded_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, debug_id)
) STRICT;

CREATE INDEX sourcemaps_release ON sourcemaps (project_id, release);

-- ── Uptime ──────────────────────────────────────────────────────────────

CREATE TABLE monitors (
  id                   TEXT PRIMARY KEY,
  project_id           TEXT NOT NULL UNIQUE REFERENCES projects (id) ON DELETE CASCADE,
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

CREATE TABLE checks (
  monitor_id  TEXT NOT NULL REFERENCES monitors (id) ON DELETE CASCADE,
  at          INTEGER NOT NULL,
  ok          INTEGER NOT NULL CHECK (ok IN (0, 1)),
  degraded    INTEGER NOT NULL DEFAULT 0 CHECK (degraded IN (0, 1)),
  http_status INTEGER,
  response_ms INTEGER,
  error       TEXT,
  region      TEXT NOT NULL,
  -- After 7 days, runs of good checks are folded into one row per hour; this is how
  -- many checks the row stands for, so uptime stays a true ratio.
  samples     INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (monitor_id, at)
) STRICT, WITHOUT ROWID;

CREATE TABLE incidents (
  id            TEXT PRIMARY KEY,
  monitor_id    TEXT NOT NULL REFERENCES monitors (id) ON DELETE CASCADE,
  started_at    INTEGER NOT NULL,
  resolved_at   INTEGER,
  cause         TEXT NOT NULL,
  failed_checks INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE INDEX incidents_monitor ON incidents (monitor_id, started_at DESC);
CREATE UNIQUE INDEX incidents_one_open ON incidents (monitor_id) WHERE resolved_at IS NULL;

-- ── Alerts ──────────────────────────────────────────────────────────────

CREATE TABLE alert_destinations (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('email', 'webhook')),
  address    TEXT,
  label      TEXT,
  url        TEXT,
  created_at INTEGER NOT NULL,
  CHECK ((kind = 'email' AND address IS NOT NULL) OR (kind = 'webhook' AND url IS NOT NULL AND label IS NOT NULL))
) STRICT;

CREATE TABLE alert_rules (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  -- JSON: "all" or ["p_…"].
  project_ids     TEXT NOT NULL CHECK (json_valid(project_ids)),
  environments    INTEGER NOT NULL,
  -- JSON array of trigger names.
  triggers        TEXT NOT NULL CHECK (json_valid(triggers)),
  spike_events    INTEGER,
  spike_minutes   INTEGER,
  -- JSON array of destination ids.
  destination_ids TEXT NOT NULL CHECK (json_valid(destination_ids)),
  enabled         INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  last_fired_at   INTEGER,
  created_at      INTEGER NOT NULL
) STRICT;

-- Outbox: one row per alert per destination, retried with backoff.
CREATE TABLE alert_deliveries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id         TEXT REFERENCES alert_rules (id) ON DELETE CASCADE,
  destination_id  TEXT NOT NULL REFERENCES alert_destinations (id) ON DELETE CASCADE,
  -- The rendered alert as JSON.
  alert           TEXT NOT NULL CHECK (json_valid(alert)),
  status          TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  last_error      TEXT,
  created_at      INTEGER NOT NULL
) STRICT;

CREATE INDEX alert_deliveries_due ON alert_deliveries (next_attempt_at) WHERE status = 'pending';

-- So a storm of events sends one alert per rule and subject, not hundreds.
CREATE TABLE alert_cooldowns (
  rule_id TEXT NOT NULL REFERENCES alert_rules (id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  until   INTEGER NOT NULL,
  PRIMARY KEY (rule_id, subject)
) STRICT, WITHOUT ROWID;
