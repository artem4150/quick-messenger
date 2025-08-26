import { Pool } from 'pg';
import { randomUUID } from 'crypto';
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function ensureDmRoom(userA: string, userB: string) {
  const [a, b] = userA < userB ? [userA, userB] : [userB, userA];
  // ищем room типа 'dm' с обоими участниками и без deleted_at
  const q = `
    WITH pair AS (
      SELECT $1::text AS a, $2::text AS b
    )
    SELECT r.id
    FROM rooms r
    JOIN room_members m1 ON m1.room_id=r.id AND m1.user_id=(SELECT a FROM pair) AND m1.deleted_at IS NULL
    JOIN room_members m2 ON m2.room_id=r.id AND m2.user_id=(SELECT b FROM pair) AND m2.deleted_at IS NULL
    WHERE r.type='dm'
    LIMIT 1
  `;
  const found = await pool.query(q, [a, b]);
  if (found.rowCount) return found.rows[0].id as string;

  const roomId = randomUUID();
  await pool.query(`INSERT INTO rooms (id, title, type) VALUES ($1,$2,'dm')`, [roomId, null]);
  await pool.query(`INSERT INTO room_members (room_id,user_id) VALUES ($1,$2),($1,$3)`, [roomId, a, b]);
  return roomId;
}

export async function softDeleteRoomForUser(roomId: string, userId: string) {
  await pool.query(
    `UPDATE room_members SET deleted_at=now(), unread=0 WHERE room_id=$1 AND user_id=$2`,
    [roomId, userId]
  );
}

export async function listRoomsForUser(userId: string) {
  const sql = `
    SELECT r.id, COALESCE(r.title, '') AS title, r.type,
           rm.pinned, rm.muted, rm.unread, rm.deleted_at,
           (SELECT text FROM messages WHERE room_id=r.id ORDER BY at DESC LIMIT 1) AS last_message,
           (SELECT EXTRACT(EPOCH FROM at)*1000 FROM messages WHERE room_id=r.id ORDER BY at DESC LIMIT 1) AS last_at
    FROM rooms r
    JOIN room_members rm ON rm.room_id=r.id
    WHERE rm.user_id=$1 AND rm.deleted_at IS NULL
    ORDER BY COALESCE((SELECT at FROM messages WHERE room_id=r.id ORDER BY at DESC LIMIT 1), r.created_at) DESC
    LIMIT 200
  `;
  const { rows } = await pool.query(sql, [userId]);
  return rows;
}
