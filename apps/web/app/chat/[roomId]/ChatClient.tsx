'use client';

import Link from 'next/link';
import { useEffect, useRef, useCallback } from 'react';

import TopBar from '@/components/TopBar';
import MessageBubble from '@/components/MessageBubble';
import { useAppStore } from '@/lib/store';

export default function ChatClient({ roomId }: { roomId: string }) {
  const connect = useAppStore(s => s.connect);
  const setCurrentRoom = useAppStore(s => s.setCurrentRoom);
  const markRead = useAppStore(s => s.markRead);
  const loadMore = useAppStore(s => s.loadMore);
  const msgs = useAppStore(s => s.messages[roomId] ?? []);
  const hasMore = useAppStore(s => s.hasMore[roomId] ?? true);

  // подключаемся
  useEffect(() => { connect(); }, [connect]);

  // выбираем комнату, отмечаем прочитано
  useEffect(() => {
    setCurrentRoom(roomId);
    markRead(roomId);
  }, [roomId, setCurrentRoom, markRead]);

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // скролл вниз на новые сообщения
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  // подгрузка вверх при достижении верха
  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !hasMore) return;
    if (el.scrollTop <= 24) {
      const prevHeight = el.scrollHeight;
      loadMore(roomId);
      // подождём микротик, потом компенсируем высоту (чтобы не прыгало)
      setTimeout(() => {
        const newHeight = el.scrollHeight;
        el.scrollTop = newHeight - prevHeight;
      }, 0);
    }
  }, [roomId, hasMore, loadMore]);

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        title={`#${roomId}`}
        right={
          <Link href={`/call/${roomId}`} className="rounded-xl bg-primary text-primary-foreground px-3 py-1">
            Call
          </Link>
        }
      />

      <div ref={listRef} onScroll={onScroll} className="flex-1 space-y-2 overflow-y-auto p-3">
        {/* sentinel сверху */}
        {hasMore ? <div className="text-tiny text-center text-foreground-500 py-1">Загружаю историю…</div> : null}

        {msgs.map(m => <MessageBubble key={m.id} msg={m} />)}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
