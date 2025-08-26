// apps/signaling-server/src/db.ts
import pg from "pg";
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

/** Создаём недостающие таблицы (идемпотентно) */
export async function ensureSchema() {
  await pool.query(`
    -- базовые комнаты и сообщения
    CREATE TABLE IF NOT EXISTS rooms (
      id         TEXT PRIMARY KEY,
      title      TEXT,
      is_direct  BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id        TEXT PRIMARY KEY,
      room_id   TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL,
      text      TEXT NOT NULL,
      at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS messages_room_at_idx ON messages(room_id, at DESC);

    -- per-user состояние комнаты
    CREATE TABLE IF NOT EXISTS room_members (
      room_id    TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL,
      role       TEXT DEFAULT 'member',
      pinned     BOOLEAN DEFAULT FALSE,
      muted      BOOLEAN DEFAULT FALSE,
      unread     INTEGER DEFAULT 0,
      deleted_at TIMESTAMPTZ,
      PRIMARY KEY (room_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS room_members_user_id_idx ON room_members(user_id) WHERE deleted_at IS NULL;

    -- контакты (двусторонние, канонический порядок)
    CREATE TABLE IF NOT EXISTS contacts (
      a_user_id TEXT NOT NULL,
      b_user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (a_user_id, b_user_id)
    );

    -- приглашения
    CREATE TABLE IF NOT EXISTS invites (
      token      TEXT PRIMARY KEY,
      type       TEXT NOT NULL CHECK (type IN ('contact','room')),
      inviter_id TEXT NOT NULL,
      room_id    TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      expires_at TIMESTAMPTZ,
      used_at    TIMESTAMPTZ
    );
  `);
}

/** Список комнат пользователя с последним сообщением + состоянием участника */
export async function listRoomsForUser(userId: string) {
  const sql = `
  SELECT
    r.id,
    COALESCE(r.title, r.id) AS title,
    lm.last_message,
    EXTRACT(EPOCH FROM lm.last_at) * 1000 AS last_at,
    COALESCE(rm.unread, 0)  AS unread,
    COALESCE(rm.pinned, FALSE) AS pinned,
    COALESCE(rm.muted,  FALSE) AS muted
  FROM room_members rm
  JOIN rooms r ON r.id = rm.room_id
  LEFT JOIN LATERAL (
    SELECT m.text AS last_message, m.at AS last_at
    FROM messages m
    WHERE m.room_id = r.id
    ORDER BY m.at DESC
    LIMIT 1
  ) lm ON true
  WHERE rm.user_id = $1
    AND rm.deleted_at IS NULL
  ORDER BY
    COALESCE(rm.pinned, FALSE) DESC,
    COALESCE(lm.last_at, 'epoch'::timestamptz) DESC;
  `;
  const { rows } = await pool.query(sql, [userId]);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    last_message: r.last_message ?? null,
    last_at: r.last_at ?? null,
    unread: Number(r.unread ?? 0),
    pinned: !!r.pinned,
    muted: !!r.muted,
  }));
}

/** Найти пользователя по email (ожидаем таблицу users(email,id)) */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const q = await pool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
  return q.rows[0]?.id ?? null;
}

/** Канонический DM room id для пары пользователей */
export function canonicalDmId(a: string, b: string) {
  const [x, y] = [a, b].sort();
  return `dm:${x}:${y}`;
}

/** Убедиться, что комната существует */
export async function ensureRoom(roomId: string, params?: { title?: string; is_direct?: boolean }) {
  await pool.query(
    `INSERT INTO rooms (id, title, is_direct) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [roomId, params?.title ?? null, !!params?.is_direct]
  );
}

/** Убедиться, что участник есть (и не помечен удалённым) */
export async function upsertMember(roomId: string, userId: string) {
  await pool.query(
    `INSERT INTO room_members (room_id, user_id) VALUES ($1,$2)
     ON CONFLICT (room_id, user_id)
     DO UPDATE SET deleted_at = NULL`,
    [roomId, userId]
  );
}

/** Добавить пару в contacts (min,max) */
export async function addContactPair(u1: string, u2: string) {
  const [a, b] = [u1, u2].sort();
  await pool.query(
    `INSERT INTO contacts (a_user_id, b_user_id) VALUES ($1,$2)
     ON CONFLICT DO NOTHING`,
    [a, b]
  );
}

/** Инвайты */
export async function createInviteRow(token: string, type: "contact" | "room", inviter: string, roomId?: string, days = 30) {
  await pool.query(
    `INSERT INTO invites (token, type, inviter_id, room_id, expires_at)
     VALUES ($1,$2,$3,$4, now() + ($5 || ' days')::interval)`,
    [token, type, inviter, roomId ?? null, String(days)]
  );
}
export async function getInvite(token: string) {
  const { rows } = await pool.query(`SELECT * FROM invites WHERE token=$1 LIMIT 1`, [token]);
  return rows[0] ?? null;
}
export async function markInviteUsed(token: string) {
  await pool.query(`UPDATE invites SET used_at = now() WHERE token=$1 AND used_at IS NULL`, [token]);
}
export async function softDeleteRoomForUser(roomId: string, userId: string) {
  // Пытаемся пометить существующее участие как удалённое
  const r = await pool.query(
    `UPDATE room_members
       SET deleted_at = now()
     WHERE room_id = $1 AND user_id = $2`,
    [roomId, userId]
  );

  // Если строки не было (пользователь не числился участником), создадим запись
  // сразу в состоянии deleted — чтобы она гарантированно не всплывала в списке.
  if (r.rowCount === 0) {
    await pool.query(
      `INSERT INTO room_members (room_id, user_id, deleted_at)
       VALUES ($1, $2, now())
       ON CONFLICT (room_id, user_id)
       DO UPDATE SET deleted_at = EXCLUDED.deleted_at`,
      [roomId, userId]
    );
  }
}