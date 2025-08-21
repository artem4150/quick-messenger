import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors());
const httpServer = createServer(app);

const PORT = Number(process.env.PORT || 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

const io = new Server(httpServer, {
  cors: { origin: [CORS_ORIGIN], methods: ['GET','POST'] }
});

// JWT‑middleware на соединение
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || (socket.handshake.headers.authorization?.toString().replace('Bearer ', '') ?? '');
    if (!token) return next(new Error('no_token'));
    const payload = jwt.verify(token, JWT_SECRET) as any;
    (socket as any).user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch (e) {
    next(new Error('invalid_token'));
  }
});

io.on('connection', (socket) => {
  const user = (socket as any).user;
  console.log('client connected', socket.id, user?.email);

  socket.on('room:join', ({ roomId }) => socket.join(roomId));
  socket.on('room:leave', ({ roomId }) => socket.leave(roomId));

  socket.on('chat:message', (msg) => {
    // Опционально: проставить автора с сервера
    msg.author = user?.name || 'user';
    socket.to(msg.roomId).emit('chat:message', msg);
  });

  socket.on('webrtc:offer', ({ roomId, sdp }) => socket.to(roomId).emit('webrtc:offer', { sdp }));
  socket.on('webrtc:answer', ({ roomId, sdp }) => socket.to(roomId).emit('webrtc:answer', { sdp }));
  socket.on('webrtc:ice', ({ roomId, candidate }) => socket.to(roomId).emit('webrtc:ice', { candidate }));

  socket.on('disconnect', () => console.log('client disconnected', socket.id));
});

httpServer.listen(PORT, () => console.log('Signaling on :' + PORT));