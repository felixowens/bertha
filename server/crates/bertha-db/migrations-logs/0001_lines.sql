-- Log lines, in their own file beside the main database. Projects live in the main
-- file, so nothing here has a foreign key: deleting a project deletes its lines by hand.

-- Levels are numbers so "this level and above" is a range: 0 debug, 1 info, 2 warning,
-- 3 error, 4 fatal.
CREATE TABLE lines (
  id          INTEGER PRIMARY KEY,
  project_id  TEXT NOT NULL,
  -- When the app logged it, in milliseconds.
  at          INTEGER NOT NULL,
  level       INTEGER NOT NULL CHECK (level BETWEEN 0 AND 4),
  message     TEXT NOT NULL,
  -- A JSON object of string values.
  fields      TEXT NOT NULL DEFAULT '{}',
  service     TEXT,
  release     TEXT,
  environment TEXT NOT NULL CHECK (environment IN ('production', 'staging', 'development')),
  trace_id    TEXT,
  span_id     TEXT,
  -- The `bertha.event_id` the line was sent with: an event's id, or the id its SDK gave it.
  event_ref   TEXT,
  pattern_id  TEXT NOT NULL,
  -- Roughly what the line takes on disk, for the size cap.
  bytes       INTEGER NOT NULL
) STRICT;

CREATE INDEX lines_project_at ON lines (project_id, at, id);
CREATE INDEX lines_at ON lines (at);
CREATE INDEX lines_trace ON lines (trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX lines_pattern ON lines (pattern_id, at);

CREATE VIRTUAL TABLE lines_fts USING fts5 (message, content = 'lines', content_rowid = 'id');

CREATE TRIGGER lines_insert AFTER INSERT ON lines BEGIN
  INSERT INTO lines_fts (rowid, message) VALUES (new.id, new.message);
  INSERT INTO usage (project_id, lines, bytes) VALUES (new.project_id, 1, new.bytes)
    ON CONFLICT (project_id) DO UPDATE SET lines = lines + 1, bytes = bytes + excluded.bytes;
END;

CREATE TRIGGER lines_delete AFTER DELETE ON lines BEGIN
  INSERT INTO lines_fts (lines_fts, rowid, message) VALUES ('delete', old.id, old.message);
  UPDATE usage SET lines = lines - 1, bytes = bytes - old.bytes WHERE project_id = old.project_id;
END;

-- What each project keeps, so settings needn't count every line.
CREATE TABLE usage (
  project_id TEXT PRIMARY KEY,
  lines      INTEGER NOT NULL,
  bytes      INTEGER NOT NULL
) STRICT, WITHOUT ROWID;

-- Messages with the varying parts replaced. `id` hashes the project and template.
CREATE TABLE patterns (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  template   TEXT NOT NULL,
  -- The worst level seen.
  level      INTEGER NOT NULL,
  first_seen INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL
) STRICT, WITHOUT ROWID;

CREATE INDEX patterns_project ON patterns (project_id);

-- Lines per minute, pattern and level: the volume strip and the patterns' cells read
-- this when there's no search.
CREATE TABLE minutes (
  project_id TEXT NOT NULL,
  minute     INTEGER NOT NULL,
  pattern_id TEXT NOT NULL,
  level      INTEGER NOT NULL,
  lines      INTEGER NOT NULL,
  PRIMARY KEY (project_id, minute, pattern_id, level)
) STRICT, WITHOUT ROWID;

CREATE INDEX minutes_pattern ON minutes (pattern_id, minute);

-- Lines bertha didn't keep, per project and UTC day: `rate` past the per-minute cap at
-- ingest, `size` deleted early past the size cap.
CREATE TABLE drops (
  project_id TEXT NOT NULL,
  day        INTEGER NOT NULL,
  rate       INTEGER NOT NULL DEFAULT 0,
  size       INTEGER NOT NULL DEFAULT 0,
  -- The first rate drop that day.
  since      INTEGER,
  PRIMARY KEY (project_id, day)
) STRICT, WITHOUT ROWID;
