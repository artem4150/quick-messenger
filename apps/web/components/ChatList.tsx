'use client';
import Link from 'next/link';


export default function ChatList() {
const rooms = [
{ id: 'general', name: 'General' },
{ id: 'team', name: 'Team' },
];
return (
<ul className="divide-y divide-zinc-800 rounded-2xl bg-zinc-900">
{rooms.map(r => (
<li key={r.id} className="flex items-center justify-between p-4">
<Link href={`/chat/${r.id}`} className="font-medium">{r.name}</Link>
<Link href={`/call/${r.id}`} className="rounded-xl bg-zinc-800 px-3 py-1 text-sm">Call</Link>
</li>
))}
</ul>
);
}