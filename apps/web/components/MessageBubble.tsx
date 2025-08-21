'use client';
import clsx from 'clsx';


export type Msg = { id: string; roomId: string; author: string; text: string; at: number };


export default function MessageBubble({ msg }: { msg: Msg }) {
const isMe = msg.author === 'me';
return (
<div className={clsx('w-full', isMe ? 'text-right' : 'text-left')}>
<div className={clsx('inline-block max-w-[80%] rounded-2xl px-3 py-2 text-sm', isMe ? 'bg-brand/20' : 'bg-zinc-800')}>
<div className="text-[11px] opacity-70">{isMe ? 'You' : msg.author}</div>
<div>{msg.text}</div>
</div>
</div>
);
}