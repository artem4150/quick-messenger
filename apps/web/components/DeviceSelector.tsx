'use client';

import React from 'react';
import { Select, SelectItem, type Selection } from '@heroui/react';

export type MediaDevice = { deviceId: string; label: string };

type Props = {
  cameras: MediaDevice[];
  microphones: MediaDevice[];
  camId?: string | null;
  micId?: string | null;
  onChangeCam: (id: string) => void;
  onChangeMic: (id: string) => void;
  className?: string;
};

export default function DeviceSelector({
  cameras,
  microphones,
  camId,
  micId,
  onChangeCam,
  onChangeMic,
  className,
}: Props) {
  return (
    <div className={['grid grid-cols-2 gap-3', className || ''].join(' ')}>
      <Select
        label="Камера"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={camId ? new Set([camId]) : new Set()}
        onSelectionChange={(keys: Selection) => {
          const id = Array.from(keys)[0] as string | undefined;
          if (id) onChangeCam(id);
        }}
      >
        {cameras.map((d) => (
          <SelectItem key={d.deviceId} textValue={d.label}>
            {d.label || 'Камера'}
          </SelectItem>
        ))}
      </Select>

      <Select
        label="Микрофон"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={micId ? new Set([micId]) : new Set()}
        onSelectionChange={(keys: Selection) => {
          const id = Array.from(keys)[0] as string | undefined;
          if (id) onChangeMic(id);
        }}
      >
        {microphones.map((d) => (
          <SelectItem key={d.deviceId} textValue={d.label}>
            {d.label || 'Микрофон'}
          </SelectItem>
        ))}
      </Select>
    </div>
  );
}
