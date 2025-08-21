'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';


export default function Login() {
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [err, setErr] = useState('');
const router = useRouter();
const { login } = useAuth();


const onSubmit = async () => {
const ok = await login(email, password);
if (!ok) return setErr('Неверные данные');
router.push('/');
};


return (
<main className="mx-auto max-w-md p-4">
<h1 className="mb-4 text-2xl font-semibold">Вход</h1>
<input className="mb-2 w-full rounded-xl bg-zinc-900 px-3 py-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
<input className="mb-2 w-full rounded-xl bg-zinc-900 px-3 py-2" placeholder="Пароль" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
{err && <div className="mb-2 text-red-400">{err}</div>}
<button onClick={onSubmit} className="w-full rounded-xl bg-brand px-4 py-2">Войти</button>
</main>
);
}