'use client';

import React from 'react';
import { Card, CardBody, Progress, Chip } from '@heroui/react';

type Props = {
  localLevel: number;   // 0..1
  remoteLevel: number;  // 0..1
  className?: string;
};

export default function VUMeter({ localLevel, remoteLevel, className }: Props) {
  const localPct = Math.min(100, Math.round(localLevel * 100));
  const remotePct = Math.min(100, Math.round(remoteLevel * 100));
  const localSpeaking = localPct > 25;
  const remoteSpeaking = remotePct > 25;

  return (
    <Card radius="lg" className={className}>
      <CardBody className="gap-3">
        <div className="flex items-center gap-3">
          <div className="min-w-16 text-sm font-medium">Вы</div>
          <Progress
            aria-label="Local level"
            value={localPct}
            className="flex-1"
            color={localSpeaking ? 'success' : 'default'}
          />
          <Chip size="sm" color={localSpeaking ? 'success' : 'default'} variant="flat">
            {localPct}%
          </Chip>
        </div>

        <div className="flex items-center gap-3">
          <div className="min-w-16 text-sm font-medium">Собеседник</div>
          <Progress
            aria-label="Remote level"
            value={remotePct}
            className="flex-1"
            color={remoteSpeaking ? 'success' : 'default'}
          />
          <Chip size="sm" color={remoteSpeaking ? 'success' : 'default'} variant="flat">
            {remotePct}%
          </Chip>
        </div>
      </CardBody>
    </Card>
  );
}
