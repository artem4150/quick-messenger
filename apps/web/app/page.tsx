'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import TopBar from '@/components/TopBar';
import ChatList from '@/components/ChatList';


export default function Home() {
const { connect } = useAppStore();
const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;


useEffect(() => { if (token) connect(); }, [connect, token]);


return (
<main className="p-3">
<TopBar title="Messenger" right={
token
? <Link href="/auth/login" className="rounded-xl bg-zinc-800 px-3 py-1" onClick={() => {localStorage.removeItem('token'); location.reload();}}>Выйти</Link>
: <div className="flex gap-2"><Link href="/auth/login" className="rounded-xl bg-zinc-800 px-3 py-1">Войти</Link><Link href="/auth/register" className="rounded-xl bg-brand px-3 py-1">Регистрация</Link></div>
} />


{token ? (
<>
<ChatList />
<div className="mt-4 grid grid-cols-2 gap-3">
<Link href="/chat/general" className="rounded-2xl bg-zinc-900 p-4 text-center">General</Link>
<Link href="/chat/team" className="rounded-2xl bg-zinc-900 p-4 text-center">Team</Link>
</div>
</>
) : (
<div className="mt-6 rounded-2xl bg-zinc-900 p-4 text-sm opacity-80">Войдите, чтобы перейти к чатам и звонкам.</div>
)}
</main>
);
}