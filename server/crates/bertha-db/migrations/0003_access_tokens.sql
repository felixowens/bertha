-- Personal access tokens: an agent reaches /mcp as the member who made one. Only the
-- SHA-256 of the secret is kept. Removing a member removes their tokens.

CREATE TABLE access_tokens (
  id           TEXT PRIMARY KEY,
  hash         BLOB NOT NULL UNIQUE,
  member_id    TEXT NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  last_used_at INTEGER,
  created_at   INTEGER NOT NULL
) STRICT;

CREATE INDEX access_tokens_member ON access_tokens (member_id, created_at DESC);
