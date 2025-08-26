'use client';

import React from 'react';
import { Card, CardBody } from '@heroui/react';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
export type Msg = import('@/lib/store').Msg;

const Check = ({ double }: { double?: boolean }) => (
  <span className="ml-1 text-xs align-middle opacity-80">{double ? '✓✓' : '✓'}</span>
);

export default function MessageBubble({ msg }: { msg: Msg }) {
  const me = useAuth((s) => s.user);
  const mine = String(me?.id) === msg.authorId;
  const peerSeenAt = useAppStore((s) => s.peerReadAt[msg.roomId] ?? 0);
  const seen = mine && peerSeenAt >= msg.at;

  const avatar = (
    <div
      className={[
        'w-8 h-8 rounded-full flex items-center justify-center font-bold mx-2',
        mine ? 'bg-primary text-primary-foreground' : 'bg-content3 text-foreground',
      ].join(' ')}
    >
      {msg.authorName?.[0]?.toUpperCase()}
    </div>
  );

  return (
    <div
      className={[
        'w-full flex items-end',
        mine ? 'justify-end flex-row-reverse' : 'justify-start',
      ].join(' ')}
    >
      {avatar}
      <Card
        radius="lg"
        className={[
          'max-w-[70%]',
          mine ? 'bg-primary text-primary-foreground' : 'bg-content2',
        ].join(' ')}
      >
        <CardBody className="px-3 py-2">
          <div className="whitespace-pre-wrap break-words">{msg.text}</div>
          <div
            className={[
              'text-tiny mt-1 opacity-80',
              mine ? 'text-primary-foreground' : 'text-foreground-500',
            ].join(' ')}
          >
            {new Date(msg.at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {mine ? <Check double={seen} /> : null}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
