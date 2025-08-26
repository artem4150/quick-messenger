-- rooms: список комнат (общие и DM)
CREATE TABLE IF NOT EXISTS rooms (
  id         TEXT PRIMARY KEY,
  title      TEXT,
  is_direct  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- messages: сообщения (на будущее; listRoomsForUser берёт из неё last message)
CREATE TABLE IF NOT EXISTS messages (
  id        TEXT PRIMARY KEY,                 -- будем класть crypto.randomUUID() с фронта/сервера
  room_id   TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  text      TEXT NOT NULL,
  at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_room_at_idx ON messages(room_id, at DESC);
