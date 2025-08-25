'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardBody, Button, Chip } from '@heroui/react';

export type PeerStats = {
  outKbps: { audio: number; video: number; total: number };
  inKbps:  { audio: number; video: number; total: number };
  rttMs?: number;
  fps?: number;
  packetsLostIn?: number;
  packetsLostOut?: number;
};

type Props = {
  stats: PeerStats | null;
  className?: string;
};

export default function StatsOverlay({ stats, className }: Props) {
  const [open, setOpen] = useState(true);

  if (!stats) return null;

  return (
    <div className={["fixed right-3 bottom-3 z-50", className || ""].join(" ")}>
      <Card radius="lg" shadow="lg" className="min-w-[260px]">
        <CardHeader className="flex justify-between items-center py-3 px-4">
          <div className="text-sm font-semibold">Call Stats</div>
          <Button size="sm" variant="flat" onPress={() => setOpen(v => !v)}>
            {open ? 'Скрыть' : 'Показать'}
          </Button>
        </CardHeader>
        {open && (
          <CardBody className="gap-2 py-3 px-4 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground-500">Исх. битрейт</span>
              <span>{Math.round(stats.outKbps.total)} kbps</span>
            </div>
            <div className="flex justify-between pl-3 text-foreground-500">
              <span>Аудио</span><span>{Math.round(stats.outKbps.audio)} kbps</span>
            </div>
            <div className="flex justify-between pl-3 text-foreground-500">
              <span>Видео</span><span>{Math.round(stats.outKbps.video)} kbps</span>
            </div>

            <div className="flex justify-between mt-1">
              <span className="text-foreground-500">Вх. битрейт</span>
              <span>{Math.round(stats.inKbps.total)} kbps</span>
            </div>
            <div className="flex justify-between pl-3 text-foreground-500">
              <span>Аудио</span><span>{Math.round(stats.inKbps.audio)} kbps</span>
            </div>
            <div className="flex justify-between pl-3 text-foreground-500">
              <span>Видео</span><span>{Math.round(stats.inKbps.video)} kbps</span>
            </div>

            <div className="flex justify-between mt-1">
              <span className="text-foreground-500">RTT</span>
              <span>{stats.rttMs ? Math.round(stats.rttMs) : '-'} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-500">FPS (исх.)</span>
              <span>{stats.fps ?? '-'}</span>
            </div>

            <div className="flex gap-2 pt-1">
              <Chip size="sm" variant="flat" color="warning">
                lost in: {stats.packetsLostIn ?? 0}
              </Chip>
              <Chip size="sm" variant="flat" color="warning">
                lost out: {stats.packetsLostOut ?? 0}
              </Chip>
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
