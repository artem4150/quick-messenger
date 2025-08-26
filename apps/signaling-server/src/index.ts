// apps/signaling-server/src/index.ts
import express from "express";
import cors, { CorsOptions } from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
// ⚠️ ESM: локальные импорты с .js
import { pool } from "./db.js";
import { listRoomsForUser, softDeleteRoomForUser } from "./db.js";
import { requireAuth } from "./httpAuth.js";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

/** Разрешаем localhost и *.trycloudflare.com + то, что явно задано в CORS_ORIGIN (через запятую). */
const allowOrigin = (origin?: string) => {
  if (!origin) return true; // curl / same-origin
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    if (u.hostname.endsWith("trycloudflare.com")) return true;
    const envList = (process.env.CORS_ORIGIN ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (envList.includes(origin)) return true;
  } catch {}
  return false;
};

const corsOptions: CorsOptions = {
  origin(origin, cb) {
    if (allowOrigin(origin)) return cb(null, true); // echo back origin (не "*")
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // preflight

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin(origin, cb) {
      if (allowOrigin(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  },
  path: "/socket.io",
});

// ---------- SOCKET AUTH ----------
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

// ----------------------- HTTP (под префиксом /sg/*) -----------------------
app.get("/sg/health", (_req, res) => res.json({ ok: true }));

// список комнат для текущего пользователя
app.get("/sg/rooms", requireAuth, async (req: any, res) => {
  try {
    const rows = await listRoomsForUser(req.userId);
    const mapped = rows.map((r: any) => ({
      id: r.id,
      title: r.title || r.id,
      lastMessage: r.last_message ?? null,
      lastAt: r.last_at ? Number(r.last_at) : null,
      unread: r.unread ?? 0,
      pinned: !!r.pinned,
      muted: !!r.muted,
      typing: false,
    }));
    res.json(mapped);
  } catch (e) {
    console.error("GET /sg/rooms failed", e);
    res.status(500).json({ error: "ROOMS_FAILED" });
  }
});

// добавить контакт по email (двусторонняя запись в contacts по canonical-порядку)
app.post("/sg/contacts/add-email", requireAuth, async (req: any, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ error: "EMAIL_REQUIRED" });

    // предполагаем, что таблица users есть в той же БД (auth-api её создаёт)
    const u = await pool.query<{ id: string; email: string; name?: string }>(
      `SELECT id, email, name FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`,
      [email]
    );
    if (!u.rows.length) return res.status(404).json({ error: "USER_NOT_FOUND" });

    const me = req.userId as string;
    const other = u.rows[0].id;
    if (me === other) return res.status(400).json({ error: "SELF_FORBIDDEN" });

    const [a, b] = me < other ? [me, other] : [other, me];
    await pool.query(
      `INSERT INTO contacts(a_user_id, b_user_id) VALUES($1,$2)
       ON CONFLICT (a_user_id, b_user_id) DO NOTHING`,
      [a, b]
    );

    res.json({ ok: true, contact: { id: other, email: u.rows[0].email, name: u.rows[0].name ?? null } });
  } catch (e) {
    console.error("POST /sg/contacts/add-email", e);
    res.status(500).json({ error: "ADD_CONTACT_FAILED" });
  }
});

// создать инвайт (type: 'contact' | 'room')
app.post("/sg/invites/create", requireAuth, async (req: any, res) => {
  try {
    const { type, roomId, ttlDays = 7 } = req.body as {
      type: "contact" | "room";
      roomId?: string;
      ttlDays?: number;
    };
    if (type !== "contact" && type !== "room") {
      return res.status(400).json({ error: "BAD_TYPE" });
    }
    if (type === "room" && !roomId) {
      return res.status(400).json({ error: "ROOM_ID_REQUIRED" });
    }

    const token = uuid();
    const expires = new Date(Date.now() + Math.max(1, Number(ttlDays)) * 24 * 3600 * 1000);

    await pool.query(
      `INSERT INTO invites(token, type, inviter_id, room_id, expires_at)
       VALUES($1,$2,$3,$4,$5)`,
      [token, type, req.userId, roomId ?? null, expires.toISOString()]
    );

    const origin = (req.headers.origin as string) || "";
    const url = origin ? `${origin.replace(/\/$/, "")}/invite/${token}` : null;

    res.json({ ok: true, token, url, expiresAt: expires.toISOString() });
  } catch (e) {
    console.error("POST /sg/invites/create", e);
    res.status(500).json({ error: "CREATE_INVITE_FAILED" });
  }
});


// ----------------------------- SOCKET.IO -----------------------------------
io.on("connection", (socket) => {
  const userId = (socket.data as any).userId as string;
  console.log("client connected", socket.id, "user:", userId);

  // список комнат (по запросу клиента)
  socket.on("rooms:list", async () => {
    try {
      const rows = await listRoomsForUser(userId);
      const mapped = rows.map((r: any) => ({
        id: r.id,
        title: r.title || r.id,
        lastMessage: r.last_message ?? null,
        lastAt: r.last_at ? Number(r.last_at) : null,
        unread: r.unread ?? 0,
        pinned: !!r.pinned,
        muted: !!r.muted,
        typing: false,
      }));
      socket.emit("rooms:list", mapped);
    } catch (e) {
      console.error("rooms:list failed", e);
      socket.emit("rooms:list", []);
    }
  });

  // pin/mute/delete
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
      await softDeleteRoomForUser(roomId, userId);
      socket.emit("rooms:remove", { roomId });
    } catch (e) {
      console.error("room:delete", e);
    }
  });

  // join/leave + роль
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

  // чат
  socket.on("chat:typing", ({ roomId, typing }) => {
    socket.to(roomId).emit("chat:typing", { roomId, typing: !!typing });
  });

  socket.on("chat:read", ({ roomId }) => {
    socket.to(roomId).emit("room:read", { roomId, userId, at: Date.now() });
  });

  socket.on("chat:history:get", async ({ roomId }) => {
    socket.emit("chat:history", { roomId, messages: [], nextBeforeAt: null, hasMore: false });
  });

  // сигналинг
  socket.on("webrtc:offer", ({ roomId, sdp }) => socket.to(roomId).emit("webrtc:offer", { sdp }));
  socket.on("webrtc:answer", ({ roomId, sdp }) => socket.to(roomId).emit("webrtc:answer", { sdp }));
  socket.on("webrtc:ice", ({ roomId, candidate }) => socket.to(roomId).emit("webrtc:ice", { candidate }));

  // для обратной совместимости
  socket.on("webrtc:join", ({ roomId }) => socket.emit("room:join", { roomId }));

  socket.on("chat:message", (msg) => {
    socket.to(msg.roomId).emit("chat:message", msg);
  });

  socket.on("disconnect", () => console.log("client disconnected", socket.id));
});

httpServer.listen(PORT, () => console.log("Signaling on :" + PORT));
