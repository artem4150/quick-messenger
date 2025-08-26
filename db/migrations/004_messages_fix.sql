-- db/migrations/004_messages_fix.sql
CREATE TABLE IF NOT EXISTS messages (
  id        BIGSERIAL PRIMARY KEY,
  room_id   BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text      TEXT   NOT NULL,
  at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_messages_room_at ON messages(room_id, at DESC);
