'use client';
import { create } from 'zustand';

interface User { id: string | number; email?: string; name: string }
interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

// Базовый адрес твоего auth-api (можно оставить /api, если настроен прокси)
const API_BASE =
  process.env.NEXT_PUBLIC_AUTH_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||   // ← fallback на твой ENV в compose
  '/api';   
async function setSessionCookie(token: string) {
  await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    // важно: cookie ставит сервер; тут просто запрос
  });
}

async function clearSessionCookie() {
  await fetch('/api/session', { method: 'DELETE' });
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,

  async login(email, password) {
    const r = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) return false;
    const data = await r.json(); // { token, user }
    if (!data?.token) return false;

    // 1) сохраняем токен локально (для запросов с клиента, если нужно)
    localStorage.setItem('token', data.token);
    set({ token: data.token, user: data.user || null });

    // 2) ставим HttpOnly cookie для middleware
    await setSessionCookie(data.token);

    return true;
  },

  async register(name, email, password) {
    const r = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    
    if (!r.ok) return false;
    const data = await r.json();
    if (!data?.token) return false;

    localStorage.setItem('token', data.token);
    set({ token: data.token, user: data.user || null });

    await setSessionCookie(data.token);

    return true;
  },

  async logout() {
    localStorage.removeItem('token');
    set({ token: null, user: null });
    await clearSessionCookie();
    // После этого middleware не пустит на приватные страницы и редиректнет на /login
  },
}));
