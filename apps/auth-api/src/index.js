import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool, waitForDB, ensureUserTable } from './db.js';

const app = express();
const port = Number(process.env.PORT) || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

function signUser(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

await waitForDB();
await ensureUserTable();

app.post('/auth/register', asyncHandler(async (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'email, name, password are required' });
  }
  const hash = await bcrypt.hash(password, 10);
  let user;
  try {
    const q = await pool.query(
      'INSERT INTO users(email, name, password_hash) VALUES($1,$2,$3) RETURNING id, email, name, created_at',
      [email.toLowerCase(), name, hash]
    );
    user = q.rows[0];
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    throw e;
  }
  const token = signUser(user);
  res.json({ token, user });
}));

app.post('/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email, password are required' });
  }
  const q = await pool.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
  const user = q.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signUser(user);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
}));

app.get('/auth/me', (req, res) => {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token' });
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ user: { id: payload.sub, email: payload.email, name: payload.name } });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

app.listen(port, () => console.log('auth-api on :' + port));
