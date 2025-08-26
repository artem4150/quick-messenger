"use client";
import { create } from "zustand";
import { io, Socket } from "socket.io-client";

/* ===== Types ===== */
export type Msg = {
  id: string;
  roomId: string;
  authorId: string;
  authorName: string;
  text: string;
  at: number;
};

export type RoomRow = {
  id: string;
  title: string;
  lastMessage?: string | null;
  lastAt?: number | null;
  unread?: number;
  pinned?: boolean;
  muted?: boolean;
  typing?: boolean;
};

function sortRooms(obj: Record<string, RoomRow>): string[] {
  return Object.values(obj)
    .sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const at = a.lastAt ?? 0;
      const bt = b.lastAt ?? 0;
      return bt - at;
    })
    .map((r) => r.id);
}

/* ===== Store ===== */
type State = {
  [x: string]: any;
  socket: Socket | null;

  rooms: Record<string, RoomRow>;
  roomOrder: string[];
  currentRoomId: string | null;

  messages: Record<string, Msg[]>;
  cursors: Record<string, number | null>; // oldest message.at for pagination up
  hasMore: Record<string, boolean>;
  peerReadAt: Record<string, number>; // roomId -> last peer readAt

  connect: () => void;

  /** HTTP: pull actual list (excludes soft-deleted) */
  requestRooms: () => Promise<void>;

  setCurrentRoom: (roomId: string) => void;

  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;

  loadMore: (roomId: string) => void;

  sendMessage: (roomId: string, text: string) => void;
  markRead: (roomId: string) => void;
  setTyping: (roomId: string, typing: boolean) => void;

  pinRoom: (roomId: string, pin: boolean) => void;
  muteRoom: (roomId: string, mute: boolean) => void;

  /** HTTP soft-delete for current user (room disappears persistently) */
  deleteRoom: (roomId: string) => Promise<void>;

  /** Contacts & Invites (HTTP) */
  addContactByEmail: (email: string) => Promise<string | null>; // returns dm roomId
  createInvite: (
    type: "contact" | "room",
    roomId?: string
  ) => Promise<{ url: string; token: string } | null>;
  acceptInvite: (token: string) => Promise<string | null>;
};

const API_BASE =
  process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4000";

export const useAppStore = create<State>((set, get) => ({
  socket: null,

  rooms: {},
  roomOrder: [],
  currentRoomId: null,

  messages: {},
  cursors: {},
  hasMore: {},
  peerReadAt: {},

  connect: () => {
    if (get().socket) return;
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const s = io(API_BASE, {
      transports: ["websocket"],
      withCredentials: true,
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      path: "/socket.io",
    });

    s.on("connect", async () => {
      console.log("socket connected", s.id);
      // подтянуть список комнат (HTTP, чтобы исключить soft-deleted)
      await get().requestRooms();
      // ре-join текущей
      const current = get().currentRoomId;
      if (current) s.emit("room:join", { roomId: current });
    });

    s.on("connect_error", (e) => console.warn("socket error", e.message));

    /* --- realtime updates (push from server) --- */

    // точечные патчи по комнате
    s.on(
      "rooms:update",
      ({ roomId, patch }: { roomId: string; patch: Partial<RoomRow> }) => {
        set((state) => {
          const prev = state.rooms[roomId] || { id: roomId, title: roomId };
          const next = { ...prev, ...patch };
          const rooms = { ...state.rooms, [roomId]: next };
          return { rooms, roomOrder: sortRooms(rooms) };
        });
      }
    );

    // сервер просит убрать комнату (например, удалена другими условиями)
    s.on("rooms:remove", ({ roomId }: { roomId: string }) => {
      set((state) => {
        const rooms = { ...state.rooms };
        delete rooms[roomId];
        const messages = { ...state.messages };
        delete messages[roomId];
        const cursors = { ...state.cursors };
        delete cursors[roomId];
        const hasMore = { ...state.hasMore };
        delete hasMore[roomId];
        const peerReadAt = { ...state.peerReadAt };
        delete peerReadAt[roomId];
        const roomOrder = sortRooms(rooms);
        const currentRoomId = state.currentRoomId === roomId ? null : state.currentRoomId;
        return { rooms, messages, cursors, hasMore, peerReadAt, roomOrder, currentRoomId };
      });
    });

    // история (первая страница и догрузка вверх)
    s.on(
      "chat:history",
      ({
        roomId,
        messages,
        nextBeforeAt,
        hasMore,
      }: {
        roomId: string;
        messages: Msg[];
        nextBeforeAt?: number | null;
        hasMore?: boolean;
      }) => {
        set((state) => {
          const existing = state.messages[roomId] ?? [];
          const isPaging =
            (nextBeforeAt ?? null) !== null && existing.length > 0;
          const merged = isPaging ? [...messages, ...existing] : messages;

          return {
            messages: { ...state.messages, [roomId]: merged },
            cursors: {
              ...state.cursors,
              [roomId]: nextBeforeAt ?? (merged.length ? merged[0].at : null),
            },
            hasMore: { ...state.hasMore, [roomId]: !!hasMore },
          };
        });
      }
    );

    // входящие сообщения
    s.on("chat:message", (m: Msg) => {
      set((state) => {
        const list = state.messages[m.roomId] ?? [];
        const next = [...list, m];
        const isCurrent = state.currentRoomId === m.roomId;
        const rooms = {
          ...state.rooms,
          [m.roomId]: {
            ...(state.rooms[m.roomId] || { id: m.roomId, title: m.roomId }),
            lastMessage: m.text,
            lastAt: m.at,
            unread: isCurrent
              ? 0
              : (state.rooms[m.roomId]?.unread ?? 0) + 1,
          },
        };
        return {
          messages: { ...state.messages, [m.roomId]: next },
          rooms,
          roomOrder: sortRooms(rooms),
        };
      });
    });

    // typing + авто-отключение через 3s
    const typingTimers: Record<string, any> = {};
    s.on(
      "chat:typing",
      ({ roomId, typing }: { roomId: string; typing: boolean }) => {
        set((state) => {
          const prev = state.rooms[roomId] || { id: roomId, title: roomId };
          const rooms = { ...state.rooms, [roomId]: { ...prev, typing } };
          return { rooms, roomOrder: sortRooms(rooms) };
        });
        if (typing) {
          clearTimeout(typingTimers[roomId]);
          typingTimers[roomId] = setTimeout(() => {
            set((state) => {
              const prev = state.rooms[roomId];
              if (!prev) return {};
              const rooms = {
                ...state.rooms,
                [roomId]: { ...prev, typing: false },
              };
              return { rooms };
            });
          }, 3000);
        }
      }
    );

    // read receipts от собеседника
    s.on(
      "room:read",
      ({ roomId, userId, at }: { roomId: string; userId: string; at: number }) => {
        set((state) => ({
          peerReadAt: {
            ...state.peerReadAt,
            [roomId]: Math.max(state.peerReadAt[roomId] ?? 0, at ?? 0),
          },
        }));
      }
    );

    set({ socket: s });
  },

  /* ---------- HTTP: список комнат ---------- */
  requestRooms: async () => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const r = await fetch(`${API_BASE}/api/rooms`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    }).catch(() => null);
    if (!r || !r.ok) return;
    const data = await r.json();
    const map: Record<string, RoomRow> = {};
    const order: string[] = [];
    for (const row of (data.rooms ?? []) as RoomRow[]) {
      map[row.id] = row;
      order.push(row.id);
    }
    set({ rooms: map, roomOrder: sortRooms(map) });
  },

  setCurrentRoom: (roomId) => {
    set({ currentRoomId: roomId });
    get().socket?.emit("room:join", { roomId });
    get().socket?.emit("chat:read", { roomId });
    // если ещё не загружали историю — запросим первую страницу
    if (!(get().messages[roomId]?.length)) {
      get().socket?.emit("chat:history:get", { roomId, limit: 50 });
    }
  },

  joinRoom: (roomId) => get().socket?.emit("room:join", { roomId }),
  leaveRoom: (roomId) => get().socket?.emit("room:leave", { roomId }),

  loadMore: (roomId) => {
    const cursor = get().cursors[roomId];
    const more = get().hasMore[roomId];
    if (more === false) return;
    get().socket?.emit("chat:history:get", {
      roomId,
      beforeAt: cursor ?? undefined,
      limit: 50,
    });
  },

  sendMessage: (roomId, text) => {
    const msg: Msg = {
      id: crypto.randomUUID(),
      roomId,
      authorId: "me",
      authorName: "me",
      text,
      at: Date.now(),
    };
    get().socket?.emit("chat:message", msg);
    set((state) => {
      const list = state.messages[roomId] ?? [];
      const next = [...list, msg];
      const rooms = {
        ...state.rooms,
        [roomId]: {
          ...(state.rooms[roomId] || { id: roomId, title: roomId }),
          lastMessage: msg.text,
          lastAt: msg.at,
          unread: 0,
        },
      };
      return {
        messages: { ...state.messages, [roomId]: next },
        rooms,
        roomOrder: sortRooms(rooms),
      };
    });
  },

  markRead: (roomId) => get().socket?.emit("chat:read", { roomId }),
  setTyping: (roomId, typing) =>
    get().socket?.emit("chat:typing", { roomId, typing }),

  pinRoom: (roomId, pin) => get().socket?.emit("room:pin", { roomId, pin }),
  muteRoom: (roomId, mute) => get().socket?.emit("room:mute", { roomId, mute }),

  /* ---------- HTTP: soft delete ---------- */
  deleteRoom: async (roomId) => {
    // оптимистично скрываем локально
    set((state) => {
      const rooms = { ...state.rooms };
      delete rooms[roomId];
      const messages = { ...state.messages };
      delete messages[roomId];
      const cursors = { ...state.cursors };
      delete cursors[roomId];
      const hasMore = { ...state.hasMore };
      delete hasMore[roomId];
      const peerReadAt = { ...state.peerReadAt };
      delete peerReadAt[roomId];
      const roomOrder = sortRooms(rooms);
      const currentRoomId =
        state.currentRoomId === roomId ? null : state.currentRoomId;
      return {
        rooms,
        messages,
        cursors,
        hasMore,
        peerReadAt,
        roomOrder,
        currentRoomId,
      };
    });

    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    await fetch(`${API_BASE}/api/rooms/${roomId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    }).catch(() => {});
  },

  /* ---------- Contacts / Invites (HTTP) ---------- */
  addContactByEmail: async (email) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const r = await fetch(`${API_BASE}/api/contacts/add-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ email }),
      credentials: "include",
    }).catch(() => null);
    if (!r || !r.ok) return null;
    const { roomId } = await r.json();
    await get().requestRooms();
    return roomId as string;
  },

  createInvite: async (type, roomId) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const r = await fetch(`${API_BASE}/api/invites/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ type, roomId }),
      credentials: "include",
    }).catch(() => null);
    if (!r || !r.ok) return null;
    const data = await r.json();
    return { url: data.url as string, token: data.token as string };
  },

  acceptInvite: async (tokenStr) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const r = await fetch(`${API_BASE}/api/invites/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ token: tokenStr }),
      credentials: "include",
    }).catch(() => null);
    if (!r || !r.ok) return null;
    const { roomId } = await r.json();
    await get().requestRooms();
    return roomId as string;
  },
}));
