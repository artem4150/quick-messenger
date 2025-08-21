'use client';
import { useState } from 'react';
import { useAppStore } from '@/lib/store';


export default function MessageInput({ roomId }: { roomId: string }) {
const { sendMessage } = useAppStore();
const [text, setText] = useState('');
const onSend = () => {
if (!text.trim()) return;
sendMessage(roomId, text.trim());
setText('');
};
return (
<div className="sticky bottom-0 flex gap-2 border-t border-zinc-800 bg-neutral-950 p-3">
<input className="flex-1 rounded-xl bg-zinc-900 px-3 py-2 outline-none" placeholder="Сообщение" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key==='Enter' && onSend()} />
<button className="rounded-xl bg-brand px-4" onClick={onSend}>Send</button>
</div>
);
}