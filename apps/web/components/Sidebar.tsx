'use client';

import { useMemo, useState } from 'react';
import { Button, Dropdown, DropdownMenu, DropdownItem, DropdownTrigger, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { useAppStore } from '@/lib/store';

type Room = import('@/lib/store').RoomRow;

export default function Sidebar() {
  const {
    rooms, roomOrder, currentRoomId,
    setCurrentRoom, createRoom, pinRoom, muteRoom, deleteRoom,
  } = useAppStore(s => ({
    rooms: s.rooms,
    roomOrder: s.roomOrder,
    currentRoomId: s.currentRoomId,
    setCurrentRoom: s.setCurrentRoom,
    createRoom: s.createRoom,
    pinRoom: s.pinRoom,
    muteRoom: s.muteRoom,
    deleteRoom: s.deleteRoom,
  }));

  const orderedRooms = useMemo<Room[]>(() => roomOrder.map(id => rooms[id]).filter(Boolean), [roomOrder, rooms]);

  // ------ New Chat modal ------
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  const submitNew = async () => {
    const t = title.trim();
    if (!t) return;
    await createRoom(t);
    setTitle('');
    setOpen(false);
  };

  return (
    <aside className="flex h-dvh w-[320px] flex-col border-r border-divider bg-content1">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="text-lg font-semibold">Чаты</div>
        <Button size="sm" color="primary" onPress={() => setOpen(true)}>+ Новый</Button>
      </div>

      {/* Search (пока заглушка) */}
      <div className="px-3 pb-2">
        <Input size="sm" placeholder="Поиск" />
      </div>

      {/* Rooms list */}
      <div className="flex-1 overflow-y-auto">
        {orderedRooms.map(room => {
          const active = room.id === currentRoomId;
          return (
            <div
              key={room.id}
              className={[
                'group flex items-center gap-2 px-3 py-2 cursor-pointer',
                active ? 'bg-primary/10' : 'hover:bg-content2'
              ].join(' ')}
              onClick={() => setCurrentRoom(room.id)}
            >
              {/* Аватар-заглушка */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-content3 text-sm font-medium">
                {room.title?.slice(0, 2) || '👤'}
              </div>

              {/* Title + last message */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate font-medium">{room.title}</div>
                  {room.pinned ? <span className="text-xs opacity-70">📌</span> : null}
                  {room.muted ? <span className="text-xs opacity-70">🔕</span> : null}
                  {room.typing ? <span className="text-xs text-warning">печатает…</span> : null}
                </div>
                <div className="truncate text-xs text-foreground-500">
                  {room.lastMessage || 'Нет сообщений'}
                </div>
              </div>

              {/* Unread badge */}
              {room.unread ? (
                <div className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {room.unread}
                </div>
              ) : null}

              {/* Kebab + Dropdown */}
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    size="sm"
                    variant="light"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    ⋯
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="room actions"
                  onAction={(key) => {
                    if (key === 'pin') pinRoom(room.id, !room.pinned);
                    if (key === 'mute') muteRoom(room.id, !room.muted);
                    if (key === 'delete') deleteRoom(room.id);
                  }}
                >
                  <DropdownItem key="pin">{room.pinned ? 'Unpin' : 'Pin'}</DropdownItem>
                  <DropdownItem key="mute">{room.muted ? 'Unmute' : 'Mute'}</DropdownItem>
                  <DropdownItem key="delete" className="text-danger" color="danger">
                    Delete
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          );
        })}
      </div>

      {/* New Chat Modal */}
      <Modal isOpen={open} onOpenChange={setOpen}>
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>Новый чат</ModalHeader>
              <ModalBody>
                <Input
                  autoFocus
                  label="Название"
                  value={title}
                  onValueChange={setTitle}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitNew(); }}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={() => onClose()}>Отмена</Button>
                <Button color="primary" onPress={submitNew}>Создать</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </aside>
  );
}
