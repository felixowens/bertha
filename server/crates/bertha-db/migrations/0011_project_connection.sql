-- A project is connected once anything arrives with its key, not only an error: the
-- first thing's time and kind, and the release last heard from by heartbeat or event.
ALTER TABLE projects ADD COLUMN connected_at INTEGER;
ALTER TABLE projects ADD COLUMN connected_via TEXT
  CHECK (connected_via IN ('event', 'heartbeat', 'logs', 'traces', 'sourcemaps', 'deploy'));
ALTER TABLE projects ADD COLUMN running_release TEXT;
ALTER TABLE projects ADD COLUMN running_environment INTEGER CHECK (running_environment IN (1, 2, 4));
ALTER TABLE projects ADD COLUMN running_seen_at INTEGER;

-- From what's still stored. Log lines live in another file, so a project that has only
-- sent logs connects on its next batch.
WITH arrivals (project_id, at, via) AS (
  SELECT id, first_event_at, 'event' FROM projects WHERE first_event_at IS NOT NULL
  UNION ALL
  SELECT project_id, MIN(created_at), source FROM releases GROUP BY project_id, source
  UNION ALL
  SELECT project_id, MIN(uploaded_at), 'sourcemaps' FROM sourcemaps GROUP BY project_id
  UNION ALL
  SELECT project_id, MIN(received_at), 'traces' FROM spans GROUP BY project_id
)
UPDATE projects SET (connected_at, connected_via) =
  (SELECT a.at, a.via FROM arrivals a WHERE a.project_id = projects.id ORDER BY a.at, a.via LIMIT 1);

UPDATE projects SET (running_release, running_environment, running_seen_at) =
  (SELECT r.version, r.environment, r.deployed_at FROM releases r
   WHERE r.project_id = projects.id AND r.source IN ('heartbeat', 'event')
   ORDER BY r.deployed_at DESC LIMIT 1);
