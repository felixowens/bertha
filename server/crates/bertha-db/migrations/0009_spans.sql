-- Spans the apps send over OTLP. Every span is kept about an hour; a trace an error
-- event names (events.trace_id) stays as long as that event does.
CREATE TABLE spans (
  project_id     TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  trace_id       TEXT NOT NULL,
  span_id        TEXT NOT NULL,
  parent_id      TEXT,
  service        TEXT NOT NULL,
  runtime        TEXT NOT NULL CHECK (runtime IN ('browser', 'server', 'edge')),
  name           TEXT NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('server', 'client', 'internal', 'producer', 'consumer')),
  -- Microseconds since the epoch.
  start_us       INTEGER NOT NULL,
  duration_us    INTEGER NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('ok', 'error', 'unset')),
  status_message TEXT,
  -- A JSON object of string values.
  attributes     TEXT NOT NULL DEFAULT '{}',
  received_at    INTEGER NOT NULL,
  PRIMARY KEY (project_id, trace_id, span_id)
) WITHOUT ROWID;

CREATE INDEX spans_trace ON spans (trace_id);
CREATE INDEX spans_received ON spans (received_at);
