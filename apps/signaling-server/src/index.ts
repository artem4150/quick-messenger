// apps/signaling-server/src/index.ts
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { pool } from "./db.js";
import { requireAuth } from "./httpAuth.js";

const app = express();
app.use(express.json());

// Если ходишь напрямую (минуя rewrites) — включи CORS под свой домен
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);

const httpServer = createServer(app);

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// ---------------- WS ----------------
const io = new Server(httpServer, {
  cors: { origin: [CORS_ORIGIN], methods: ["GET", "POST"] },
  path: "/socket.io",
});

io.use((socket, next) => {
  try {
    const token = (socket.handshake.auth as any)?.token;
    if (!token) return next(new Error("NO_TOKEN"));
    const payload = jwt.verify(token, JWT_SECRET) as any;
    (socket.data as any).userId = payload.sub || payload.id || payload.userId;
    if (!(socket.data as any).userId) return next(new Error("BAD_TOKEN"));
    next();
  } catch {
    next(new Error("BAD_TOKEN"));
  }
});

// ---------- helpers ----------
async function getUserByEmail(email: string) {
  const r = await pool.query(
    `SELECT id, email, name FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`,
    [email]
  );
  return r.rows[0] || null;
}

function dmRoomIdFor(a: string, b: string) {
  const [x, y] = [a, b].sort();
  return `dm_${x}_${y}`;
}

// ---------- HTTP API (/api/*) ----------
app.get("/api/health", (_req, res) => res.json({ ok: true }));


// история сообщений комнаты (последние 50 по времени)
app.get("/api/rooms/:roomId/messages", requireAuth, async (req: any, res) => {
  const userId = Number(req.userId);
  const roomId = Number(req.params.roomId);

  // проверим, что пользователь член комнаты
  const m = await pool.query(
    `SELECT 1 FROM room_members WHERE room_id=$1 AND user_id=$2 AND deleted_at IS NULL LIMIT 1`,
    [roomId, userId]
  );
  if (m.rowCount === 0) return res.status(403).json({ error: "NOT_A_MEMBER" });

  const q = await pool.query(
    `SELECT
       id,
       room_id,
       author_id::text AS author_id,                           -- ВАЖНО: строкой
       text,
       EXTRACT(EPOCH FROM at) * 1000 AS at                     -- ms для фронта
     FROM messages
     WHERE room_id = $1
     ORDER BY at DESC
     LIMIT 50`,
    [roomId]
  );

  // отдаём по возрастанию времени (удобнее рисовать)
  const rows = q.rows.reverse();
  res.json(rows);
});

// отправить сообщение в комнату
app.post("/api/rooms/:roomId/messages", requireAuth, async (req: any, res) => {
  const userId = Number(req.userId);
  const roomId = Number(req.params.roomId);
  const { text } = req.body ?? {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: "EMPTY" });

  // членство
  const m = await pool.query(
    `SELECT 1 FROM room_members WHERE room_id=$1 AND user_id=$2 AND deleted_at IS NULL LIMIT 1`,
    [roomId, userId]
  );
  if (m.rowCount === 0) return res.status(403).json({ error: "NOT_A_MEMBER" });

  const ins = await pool.query(
    `INSERT INTO messages (room_id, author_id, text)
     VALUES ($1, $2, $3)
     RETURNING
       id,
       room_id,
       author_id::text AS author_id,                            -- строкой
       text,
       EXTRACT(EPOCH FROM at) * 1000 AS at`,
    [roomId, userId, text]
  );

  const msg = ins.rows[0];

  // если у вас есть WebSocket/Socket.IO — рассылаем в комнату
  try {
    io?.to(`room:${roomId}`).emit("message:new", msg);
  } catch {}

  res.status(201).json(msg);
});






// Список комнат пользователя
app.get("/api/rooms", requireAuth, async (req: any, res) => {
  const userId = req.userId as string;
  try {
const q = await pool.query(
  `
  SELECT
    r.id,
    COALESCE(r.title, r.id) AS title,
    lm.last_message,
    EXTRACT(EPOCH FROM COALESCE(lm.last_at, r.created_at)) * 1000 AS last_at,
    COALESCE(rm.unread, 0)      AS unread,
    COALESCE(rm.pinned, FALSE)  AS pinned,
    COALESCE(rm.muted,  FALSE)  AS muted
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
    COALESCE(lm.last_at, r.created_at) DESC
  `,
  [userId]
);


    const rooms = q.rows.map((r) => ({
      id: r.id,
      title: r.title,
      lastMessage: r.last_message ?? null,
      lastAt: r.last_at ? Number(r.last_at) : null,
      unread: r.unread ?? 0,
      pinned: !!r.pinned,
      muted: !!r.muted,
      typing: false,
    }));

    res.json(rooms);
  } catch (e) {
    console.error("GET /api/rooms failed:", e);
    res.status(500).json({ error: "ROOMS_FAILED" });
  }
});

// Добавить контакт по email -> создать/вернуть DM-комнату
app.post("/api/contacts/add-email", requireAuth, async (req: any, res) => {
  const inviterId = req.userId as string;
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: "NO_EMAIL" });

  try {
    const other = await getUserByEmail(email);
    if (!other) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (other.id === inviterId)
      return res.status(400).json({ error: "SELF_NOT_ALLOWED" });

    const [a, b] = [inviterId, other.id].sort();
    await pool.query(
      `INSERT INTO contacts(a_user_id,b_user_id)
       VALUES ($1,$2) ON CONFLICT (a_user_id,b_user_id) DO NOTHING`,
      [a, b]
    );

    const roomId = dmRoomIdFor(inviterId, other.id);
    await pool.query(
      `INSERT INTO rooms(id, title, created_at)
       VALUES ($1, $2, now())
       ON CONFLICT (id) DO NOTHING`,
      [roomId, other.name || other.email || "DM"]
    );

    await pool.query(
      `INSERT INTO room_members(room_id,user_id)
       VALUES ($1,$2) ON CONFLICT (room_id,user_id) DO NOTHING`,
      [roomId, inviterId]
    );
    await pool.query(
      `INSERT INTO room_members(room_id,user_id)
       VALUES ($1,$2) ON CONFLICT (room_id,user_id) DO NOTHING`,
      [roomId, other.id]
    );

    res.json({ roomId });
  } catch (e: any) {
    console.error("POST /api/contacts/add-email failed:", e);
    // мягкие ответы вместо 500 для частых кейсов
    if (e.code === "23505") return res.status(200).json({ ok: true });
    if (e.code === "22P02") return res.status(400).json({ error: "BAD_INPUT" });
    return res.status(500).json({ error: "ADD_CONTACT_FAILED" });
  }
});

// Создать инвайт (contact | room)
app.post("/api/invites/create", requireAuth, async (req: any, res) => {
  const inviterId = req.userId as string;
  const { type, roomId } = req.body as {
    type?: "contact" | "room";
    roomId?: string;
  };

  if (!type || !["contact", "room"].includes(type))
    return res.status(400).json({ error: "BAD_TYPE" });

  try {
    if (type === "room") {
      if (!roomId) return res.status(400).json({ error: "NO_ROOM" });
      // проверим, что юзер — член комнаты
      const r = await pool.query(
        `SELECT 1 FROM room_members WHERE room_id=$1 AND user_id=$2 AND deleted_at IS NULL LIMIT 1`,
        [roomId, inviterId]
      );
      if (!r.rowCount) return res.status(403).json({ error: "NOT_A_MEMBER" });
    }

    const token = randomUUID();
    const expiresAtDays = 7;
    await pool.query(
      `INSERT INTO invites(token, type, inviter_id, room_id, created_at, expires_at)
       VALUES ($1,$2,$3,$4, now(), now() + INTERVAL '${expiresAtDays} days')`,
      [token, type, inviterId, roomId ?? null]
    );

    // Можно вернуть абсолютный URL, если задашь PUBLIC_BASE_URL
    const publicBase = process.env.PUBLIC_BASE_URL || "";
    const url = publicBase ? `${publicBase}/invite/${token}` : token;

    res.json({ token, url });
  } catch (e) {
    console.error("POST /api/invites/create failed:", e);
    res.status(500).json({ error: "INVITE_CREATE_FAILED" });
  }
});

// Принять инвайт
app.post("/api/invites/accept", requireAuth, async (req: any, res) => {
  const userId = req.userId as string;
  const { token } = req.body as { token?: string };
  if (!token) return res.status(400).json({ error: "NO_TOKEN" });

  try {
    const r = await pool.query(
      `SELECT token, type, inviter_id, room_id,
              (expires_at IS NULL OR expires_at > now()) AS valid,
              used_at
       FROM invites WHERE token = $1 LIMIT 1`,
      [token]
    );
    if (!r.rowCount) return res.status(400).json({ error: "BAD_TOKEN" });
    const inv = r.rows[0];
    if (!inv.valid) return res.status(400).json({ error: "EXPIRED" });
    if (inv.used_at) return res.status(400).json({ error: "USED" });

    let roomId: string | null = null;

    if (inv.type === "contact") {
      const otherId = inv.inviter_id as string;
      if (otherId === userId)
        return res.status(400).json({ error: "SELF_NOT_ALLOWED" });

      const [a, b] = [userId, otherId].sort();
      await pool.query(
        `INSERT INTO contacts(a_user_id,b_user_id)
         VALUES ($1,$2) ON CONFLICT (a_user_id,b_user_id) DO NOTHING`,
        [a, b]
      );

      roomId = dmRoomIdFor(userId, otherId);
      await pool.query(
        `INSERT INTO rooms(id, title, created_at)
         VALUES ($1, $2, now())
         ON CONFLICT (id) DO NOTHING`,
        [roomId, "DM"]
      );
      await pool.query(
        `INSERT INTO room_members(room_id,user_id)
         VALUES ($1,$2) ON CONFLICT (room_id,user_id) DO NOTHING`,
        [roomId, userId]
      );
      await pool.query(
        `INSERT INTO room_members(room_id,user_id)
         VALUES ($1,$2) ON CONFLICT (room_id,user_id) DO NOTHING`,
        [roomId, otherId]
      );
    } else {
      // type === 'room'
      roomId = inv.room_id as string;
      if (!roomId) return res.status(400).json({ error: "NO_ROOM_IN_INVITE" });

      await pool.query(
        `INSERT INTO room_members(room_id,user_id)
         VALUES ($1,$2) ON CONFLICT (room_id,user_id) DO UPDATE SET deleted_at=NULL`,
        [roomId, userId]
      );
    }

    await pool.query(`UPDATE invites SET used_at = now() WHERE token=$1`, [
      token,
    ]);

    return res.json({ roomId });
  } catch (e) {
    console.error("POST /api/invites/accept failed:", e);
    res.status(500).json({ error: "INVITE_ACCEPT_FAILED" });
  }
});

// --------- SOCKET (чат + сигналинг) ----------
io.on("connection", (socket) => {
  const userId = (socket.data as any).userId as string;
  console.log("client connected", socket.id, "user:", userId);

  socket.on("room:pin", async ({ roomId, pin }) => {
    try {
      await pool.query(
        `UPDATE room_members SET pinned = $3 WHERE room_id=$1 AND user_id=$2`,
        [roomId, userId, !!pin]
      );
      socket.emit("rooms:update", { roomId, patch: { pinned: !!pin } });
    } catch (e) {
      console.error("room:pin", e);
    }
  });

  socket.on("room:mute", async ({ roomId, mute }) => {
    try {
      await pool.query(
        `UPDATE room_members SET muted = $3 WHERE room_id=$1 AND user_id=$2`,
        [roomId, userId, !!mute]
      );
      socket.emit("rooms:update", { roomId, patch: { muted: !!mute } });
    } catch (e) {
      console.error("room:mute", e);
    }
  });

  socket.on("room:delete", async ({ roomId }) => {
    try {
      await pool.query(
        `UPDATE room_members SET deleted_at = now() WHERE room_id=$1 AND user_id=$2`,
        [roomId, userId]
      );
      socket.emit("rooms:remove", { roomId });
    } catch (e) {
      console.error("room:delete", e);
    }
  });

  socket.on("room:join", async ({ roomId }) => {
    await socket.join(roomId);
    const sockets = await io.in(roomId).fetchSockets();
    const role = sockets.length <= 1 ? "offerer" : "answerer";
    socket.emit("webrtc:role", { role });
    socket.emit("webrtc:ready");
    socket.to(roomId).emit("webrtc:ready");
  });

  socket.on("room:leave", async ({ roomId }) => {
    await socket.leave(roomId);
  });

  socket.on("chat:typing", ({ roomId, typing }) => {
    socket.to(roomId).emit("chat:typing", { roomId, typing: !!typing });
  });

  socket.on("chat:read", ({ roomId }) => {
    socket.to(roomId).emit("room:read", { roomId, userId, at: Date.now() });
  });

  socket.on("chat:history:get", async ({ roomId }) => {
    socket.emit("chat:history", {
      roomId,
      messages: [],
      nextBeforeAt: null,
      hasMore: false,
    });
  });

  socket.on("chat:message", (msg) => {
    socket.to(msg.roomId).emit("chat:message", msg);
  });

  socket.on("webrtc:offer", ({ roomId, sdp }) =>
    socket.to(roomId).emit("webrtc:offer", { sdp })
  );
  socket.on("webrtc:answer", ({ roomId, sdp }) =>
    socket.to(roomId).emit("webrtc:answer", { sdp })
  );
  socket.on("webrtc:ice", ({ roomId, candidate }) =>
    socket.to(roomId).emit("webrtc:ice", { candidate })
  );

  socket.on("disconnect", () => console.log("client disconnected", socket.id));
});

httpServer.listen(PORT, () => console.log("Signaling on :" + PORT));
