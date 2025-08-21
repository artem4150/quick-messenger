import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const app = express();
const port = process.env.PORT || 5001;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

async function waitForDB(maxAttempts = 30, delayMs = 2000) {
for (let i = 1; i <= maxAttempts; i++) {
try {
await pool.query('SELECT 1');
console.log('DB connection OK');
return;
} catch (e) {
console.log(`DB not ready (${i}/${maxAttempts})…`, e.code || e.message);
await new Promise(r => setTimeout(r, delayMs));
}
}
console.error('DB is not reachable, exiting');
process.exit(1);
}


await waitForDB();

// Инициализация таблицы пользователей при старте
await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );
`);

function signUser(user) {
  return jwt.sign({ sub: String(user.id), email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
}

app.post('/auth/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password) return res.status(400).json({ error: 'email, name, password are required' });
    const hash = await bcrypt.hash(password, 10);
    const q = await pool.query('INSERT INTO users(email, name, password_hash) VALUES($1,$2,$3) RETURNING id, email, name, created_at', [email.toLowerCase(), name, hash]);
    const user = q.rows[0];
    const token = signUser(user);
    res.json({ token, user });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email, password are required' });
    const q = await pool.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
    const user = q.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signUser(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/auth/me', (req, res) => {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token' });
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ user: { id: payload.sub, email: payload.email, name: payload.name } });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

app.listen(port, () => console.log('auth-api on :' + port));