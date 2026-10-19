-- What announced a release: a deploy from CI, a running process (heartbeat), or only an
-- event naming it. For the last two, deployed_at is when bertha first saw it.
ALTER TABLE releases ADD COLUMN source TEXT NOT NULL DEFAULT 'deploy'
  CHECK (source IN ('deploy', 'heartbeat', 'event'));

-- Before this, a deploy from CI came with commit details (the message may be empty).
-- An event set none and started the release at the event's own time; a heartbeat set
-- at most the sha and started it at the heartbeat's.
UPDATE releases SET source = 'event'
  WHERE commit_message IS NULL AND commit_sha IS NULL AND deployed_at = created_at
    AND EXISTS (SELECT 1 FROM events e JOIN issues i ON i.id = e.issue_id
                 WHERE i.project_id = releases.project_id AND e.received_at = releases.deployed_at);
UPDATE releases SET source = 'heartbeat'
  WHERE source = 'deploy' AND commit_message IS NULL
    AND (commit_sha IS NOT NULL OR deployed_at = created_at);

-- A release named by its full commit sha is that commit.
UPDATE releases SET commit_sha = version
  WHERE commit_sha IS NULL AND length(version) IN (40, 64) AND version NOT GLOB '*[^0-9a-f]*';

-- The W3C trace an event happened in, for finding the other side of a page load or
-- request (the browser's error and the API's, say).
ALTER TABLE events ADD COLUMN trace_id TEXT;
CREATE INDEX events_trace ON events (trace_id) WHERE trace_id IS NOT NULL;
