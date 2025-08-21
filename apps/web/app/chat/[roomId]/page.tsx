'use client';
import { useParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import TopBar from '@/components/TopBar';
import MessageBubble from '@/components/MessageBubble';
import MessageInput from '@/components/MessageInput';
import { useAppStore } from '@/lib/store';
import Link from 'next/link';


export default function ChatRoom() {
const { roomId } = useParams<{ roomId: string }>();
const { messages, joinRoom, leaveRoom } = useAppStore();
const bottomRef = useRef<HTMLDivElement>(null);


useEffect(() => { joinRoom(roomId!); return () => leaveRoom(roomId!); }, [roomId, joinRoom, leaveRoom]);
useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);


return (
<main className="flex h-dvh flex-col">
<TopBar title={`#${roomId}`} right={<Link href={`/call/${roomId}`} className="rounded-xl bg-brand px-3 py-1">Call</Link>} />
<div className="flex-1 space-y-2 overflow-y-auto p-3">
{messages.filter(m=>m.roomId===roomId).map(m => (
<MessageBubble key={m.id} msg={m} />
))}
<div ref={bottomRef} />
</div>
<MessageInput roomId={roomId!} />
</main>
);
}