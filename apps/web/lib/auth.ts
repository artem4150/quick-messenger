'use client';
import { create } from 'zustand';


interface User { id: string | number; email: string; name: string }
interface AuthState {
user: User | null;
token: string | null;
login: (email: string, password: string) => Promise<boolean>;
register: (name: string, email: string, password: string) => Promise<boolean>;
logout: () => void;
}


const API = '/api';

export const useAuth = create<AuthState>((set) => ({
user: null,
token: null,
async login(email, password) {
const r = await fetch(`${API}/auth/login`, {
method: 'POST', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ email, password })
});
if (!r.ok) return false;
const data = await r.json();
localStorage.setItem('token', data.token);
set({ token: data.token, user: data.user });
return true;
},
async register(name, email, password) {
const r = await fetch(`${API}/auth/register`, {
method: 'POST', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ name, email, password })
});
if (!r.ok) return false;
const data = await r.json();
localStorage.setItem('token', data.token);
set({ token: data.token, user: data.user });
return true;
},
logout() { localStorage.removeItem('token'); set({ token: null, user: null }); }
}));