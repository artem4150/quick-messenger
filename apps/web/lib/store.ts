'use client';

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import type { Msg } from '@/components/MessageBubble';

interface State {
  socket: Socket | null;
  messages: Msg[];
  connect: () => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (roomId: string, text: string) => void;
}

export const useAppStore = create<State>((set, get) => ({
  socket: null,
  messages: [],

  // важное: подключаемся к тому же origin (https://<ваш-url>) и используем путь /socket.io
  connect: () => {
    if (get().socket) return;

    const token =
      typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const s: Socket = io(undefined, {
      // undefined => текущий origin (работает через Caddy + cloudflared)
      path: '/socket.io',
      transports: ['websocket'],
      auth: token ? { token } : undefined,
      withCredentials: true,
    });

    s.on('connect', () => console.log('socket connected', s.id));
    s.on('connect_error', (err) =>
      console.warn('socket error', err.message)
    );
    s.on('chat:message', (msg: Msg) =>
      set((state) => ({ messages: [...state.messages, msg] }))
    );

    set({ socket: s });
  },

  joinRoom: (roomId) => get().socket?.emit('room:join', { roomId }),
  leaveRoom: (roomId) => get().socket?.emit('room:leave', { roomId }),

  sendMessage: (roomId, text) => {
    const msg: Msg = {
      id: crypto.randomUUID(),
      roomId,
      author: 'me',
      text,
      at: Date.now(),
    };
    set((state) => ({ messages: [...state.messages, msg] }));
    get().socket?.emit('chat:message', msg);
  },
}));
