import '../styles/globals.css';
import type { ReactNode } from 'react';


export default function RootLayout({ children }: { children: ReactNode }) {
return (
<html lang="ru">
<body className="min-h-dvh bg-neutral-950 text-neutral-50">
<div className="mx-auto max-w-md">{children}</div>
</body>
</html>
);
}