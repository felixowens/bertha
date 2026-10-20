-- Tags the app sends with its events are rolled up per issue like the built-in ones, so
-- issue_tags takes any key. SQLite can't drop a CHECK, so the table is rebuilt.
CREATE TABLE issue_tags_new (
  issue_id TEXT NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  key      TEXT NOT NULL,
  value    TEXT NOT NULL,
  count    INTEGER NOT NULL,
  PRIMARY KEY (issue_id, key, value)
) STRICT, WITHOUT ROWID;

INSERT INTO issue_tags_new (issue_id, key, value, count) SELECT issue_id, key, value, count FROM issue_tags;
DROP TABLE issue_tags;
ALTER TABLE issue_tags_new RENAME TO issue_tags;
