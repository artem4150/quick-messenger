'use client';
import Link from 'next/link';


export default function TopBar({ title, right }: { title: string; right?: React.ReactNode }) {
return (
<header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-neutral-950/80 p-3 backdrop-blur">
<Link href="/" className="text-lg font-semibold">{title}</Link>
<div className="flex items-center gap-2">{right}</div>
</header>
);
}