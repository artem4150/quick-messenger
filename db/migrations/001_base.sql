-- db/migrations/001_base.sql
-- per-user состояние комнаты: soft delete, mute, pin, unread
CREATE TABLE IF NOT EXISTS room_members (
  room_id   TEXT NOT NULL,
  user_id   TEXT NOT NULL,
  role      TEXT DEFAULT 'member',
  pinned    BOOLEAN DEFAULT FALSE,
  muted     BOOLEAN DEFAULT FALSE,
  unread    INTEGER DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS room_members_user_id_idx
  ON room_members(user_id) WHERE deleted_at IS NULL;

-- контакты (двусторонние), canonical порядок (min,max)
CREATE TABLE IF NOT EXISTS contacts (
  a_user_id TEXT NOT NULL,
  b_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (a_user_id, b_user_id)
);

-- приглашения (контакты или инвайт в комнату)
CREATE TABLE IF NOT EXISTS invites (
  token      TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('contact','room')),
  inviter_id TEXT NOT NULL,
  room_id    TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  used_at    TIMESTAMPTZ
);
