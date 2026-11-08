-- An incident left open on a monitor that isn't down (paused, or edited and checked up
-- while it was down) blocked the next one from opening. It ended when the state moved.
UPDATE incidents SET resolved_at = (
  SELECT MAX(incidents.started_at, m.since) FROM monitors m WHERE m.id = incidents.monitor_id
)
WHERE resolved_at IS NULL
  AND monitor_id IN (SELECT id FROM monitors WHERE state != 'down');

