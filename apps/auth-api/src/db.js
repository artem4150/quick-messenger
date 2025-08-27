import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

export async function waitForDB(maxAttempts = 30, delayMs = 2000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('DB connection OK');
      return;
    } catch (e) {
      console.log(`DB not ready (${i}/${maxAttempts})…`, e.code || e.message);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  console.error('DB is not reachable, exiting');
  process.exit(1);
}

export async function ensureUserTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}
