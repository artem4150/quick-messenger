'use client';

import React from 'react';
import { Button } from '@heroui/react';

type Props = {
  sharing: boolean;
  onToggle: () => void;
  className?: string;
};

function MonitorIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H13v2h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2H5a2 2 0 0 1-2-2V5Z" fill="currentColor"/>
    </svg>
  );
}
function MonitorStopIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H13v2h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2H5a2 2 0 0 1-2-2V5Z" fill="currentColor"/>
      <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export default function ShareButton({ sharing, onToggle, className }: Props) {
  return (
    <Button
      radius="full"
      color={sharing ? 'danger' : 'primary'}
      variant="solid"
      startContent={sharing ? <MonitorStopIcon /> : <MonitorIcon />}
      onPress={onToggle}
      className={className}
    >
      {sharing ? 'Остановить экран' : 'Поделиться экраном'}
    </Button>
  );
}
