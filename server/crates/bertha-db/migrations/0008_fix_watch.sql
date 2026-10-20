-- Fixes that ship: bertha follows a fixed triage's PR or commit until a release contains
-- it, then resolves the issue. Fixed triages from before this have fix_state NULL; bertha
-- reads their fix text when it opens the database.
ALTER TABLE triages ADD COLUMN fix_pr INTEGER;
-- The commit the triage named, or the PR's merge commit once it merged.
ALTER TABLE triages ADD COLUMN fix_commit TEXT;
ALTER TABLE triages ADD COLUMN fix_state TEXT
  CHECK (fix_state IN ('waiting_merge', 'waiting_release', 'shipped', 'closed', 'unwatched'));
ALTER TABLE triages ADD COLUMN fix_merged_at INTEGER;
-- The release it shipped in.
ALTER TABLE triages ADD COLUMN fix_release TEXT;
-- What GitHub last answered when it couldn't be read; cleared once it can.
ALTER TABLE triages ADD COLUMN fix_problem TEXT;
ALTER TABLE triages ADD COLUMN fix_checked_at INTEGER;

CREATE INDEX triages_fix_waiting ON triages (fix_state) WHERE fix_state IN ('waiting_merge', 'waiting_release');

-- Events from releases first seen before this don't reopen a resolved issue: old builds.
ALTER TABLE issues ADD COLUMN resolved_from INTEGER;

-- A project's owner can turn GitHub watching off; its fixes are then marked shipped by hand.
ALTER TABLE projects ADD COLUMN watch_fixes INTEGER NOT NULL DEFAULT 1 CHECK (watch_fixes IN (0, 1));
