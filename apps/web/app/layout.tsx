import '../styles/globals.css';
import type { ReactNode } from 'react';


export default function RootLayout({ children }: { children: ReactNode }) {
return (
    <html lang="ru" className="h-full w-full">
      <body className="h-dvh w-dvw overflow-hidden bg-content1 text-foreground">
        {children}
      </body>
    </html>
);
}