import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

const app = express();

const ORIGIN = process.env.CORS_ORIGIN || '*';
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || '';

app.use(cors({ origin: ORIGIN, credentials: true }));

const server = http.createServer(app);
const io = new Server(server, {
  path: '/socket.io',
  cors: { origin: ORIGIN, credentials: true },
});

io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  // (опционально) валидация JWT, если передаётся в handshake.auth.token
  const token = (socket.handshake.auth as any)?.token;
  if (JWT_SECRET && token) {
    try {
      jwt.verify(token, JWT_SECRET);
    } catch (e) {
      console.warn('invalid token, disconnect', socket.id);
      socket.disconnect(true);
      return;
    }
  }

  // Общая функция назначения ролей и ready, когда в комнате ровно 2 участника
  const maybeAssignRoles = (roomId: string) => {
    const room = io.sockets.adapter.rooms.get(roomId) || new Set<string>();
    const ids = Array.from(room).sort(); // детерминируем порядок
    console.log(`[room ${roomId}] members:`, ids);
    if (ids.length === 2) {
      const [offerer, answerer] = ids;
      console.log(`[roles ${roomId}] offerer=${offerer} answerer=${answerer}`);
      io.to(offerer).emit('webrtc:role', { role: 'offerer', roomId });
      io.to(answerer).emit('webrtc:role', { role: 'answerer', roomId });
      io.to(roomId).emit('webrtc:ready', { roomId });
    } else if (ids.length > 2) {
      // ограничим комнату двумя участниками
      socket.leave(roomId);
      io.to(socket.id).emit('webrtc:full', { roomId });
    }
  };

  // Правильный join
  socket.on('room:join', ({ roomId }: { roomId: string }) => {
    if (!roomId) return;
    socket.join(roomId);
    console.log('[room:join]', roomId, 'by', socket.id);
    maybeAssignRoles(roomId);
  });

  socket.on('room:leave', ({ roomId }: { roomId: string }) => {
    if (!roomId) return;
    socket.leave(roomId);
    console.log('[room:leave]', roomId, 'by', socket.id);
  });

  // Алиас для обратной совместимости: webrtc:join реально выполняет join
  socket.on('webrtc:join', ({ roomId }: { roomId: string }) => {
    if (!roomId) return;
    socket.join(roomId);
    console.log('[webrtc:join -> join]', roomId, 'by', socket.id);
    maybeAssignRoles(roomId);
  });

  // Чат
  socket.on('chat:message', (msg: { roomId: string }) => {
    if (!msg?.roomId) return;
    socket.to(msg.roomId).emit('chat:message', msg);
  });

  // Сигналинг
  socket.on('webrtc:offer', ({ roomId, sdp }: { roomId: string; sdp: string }) => {
    if (!roomId || !sdp) return;
    socket.to(roomId).emit('webrtc:offer', { sdp });
  });

  socket.on('webrtc:answer', ({ roomId, sdp }: { roomId: string; sdp: string }) => {
    if (!roomId || !sdp) return;
    socket.to(roomId).emit('webrtc:answer', { sdp });
  });

  socket.on('webrtc:ice', ({ roomId, candidate }: { roomId: string; candidate: RTCIceCandidateInit }) => {
    if (!roomId || !candidate) return;
    socket.to(roomId).emit('webrtc:ice', { candidate });
  });

  socket.on('disconnect', () => {
    console.log('client disconnected', socket.id);
  });
});

server.listen(PORT, () => console.log(`Signaling on :${PORT}`));
