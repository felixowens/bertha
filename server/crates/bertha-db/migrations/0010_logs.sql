-- Logs live in their own file (`<name>.logs.db`); here is only what a project keeps.
ALTER TABLE projects ADD COLUMN log_min_level TEXT NOT NULL DEFAULT 'info'
  CHECK (log_min_level IN ('debug', 'info', 'warning', 'error', 'fatal'));
ALTER TABLE projects ADD COLUMN log_retention_days INTEGER NOT NULL DEFAULT 14
  CHECK (log_retention_days BETWEEN 1 AND 90);

-- A `log_match` rule's search, as JSON: {"query", "minLevel", "count", "withinMinutes"}.
ALTER TABLE alert_rules ADD COLUMN log_match TEXT CHECK (log_match IS NULL OR json_valid(log_match));

-- Log lines name the event they were also reported as by the id the SDK gave it.
CREATE INDEX events_client_id ON events (client_id) WHERE client_id IS NOT NULL;
