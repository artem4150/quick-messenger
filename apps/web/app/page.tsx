'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Avatar, Badge, Button, Card, CardBody, Chip, Divider, Input, ScrollShadow, Tooltip,
  Dropdown, DropdownMenu, DropdownItem, DropdownTrigger, Modal, ModalBody, ModalContent, ModalHeader, ModalFooter, Tabs, Tab
} from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

/* --- inline icons --- */
const IconChats=(p:any)=>(<svg viewBox="0 0 24 24" width="20" height="20" {...p}><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 3v-3H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>);
const IconUser =(p:any)=>(<svg viewBox="0 0 24 24" width="20" height="20" {...p}><path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5C21 16.5 17 14 12 14Z"/></svg>);
const IconCall =(p:any)=>(<svg viewBox="0 0 24 24" width="20" height="20" {...p}><path fill="currentColor" d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11.6 11.6 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17.6 17.6 0 0 1 3 7a1 1 0 0 1 1-1h3.46a1 1 0 0 1 1 1 11.6 11.6 0 0 0 .58 3.6 1 1 0 0 1-.24 1Z"/></svg>);
const IconVideo=(p:any)=>(<svg viewBox="0 0 24 24" width="20" height="20" {...p}><path fill="currentColor" d="M15 8.5V7a2 2 0 0 0-2-2H5A2 2 0 0 0 3 7v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1.5l4 2.5V6z"/></svg>);
const IconSearch=(p:any)=>(<svg viewBox="0 0 24 24" width="18" height="18" {...p}><path fill="currentColor" d="M10 18a8 8 0 1 1 5.29-14l4.86 4.86-1.41 1.41-4.86-4.86A6 6 0 1 0 10 16a6 6 0 0 0 3.87-1.4l1.47 1.47A8 8 0 0 1 10 18Z"/></svg>);
const IconMore =(p:any)=>(<svg viewBox="0 0 24 24" width="18" height="18" {...p}><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>);
const IconAttach=(p:any)=>(<svg viewBox="0 0 24 24" width="18" height="18" {...p}><path fill="currentColor" d="M7 12.5V7a5 5 0 0 1 10 0v8a3.5 3.5 0 1 1-7 0V8h2v7a1.5 1.5 0 1 0 3 0V7a3 3 0 0 0-6 0v5.5a5.5 5.5 0 1 0 11 0V8h2v4.5a7.5 7.5 0 1 1-15 0Z"/></svg>);
const IconEmoji =(p:any)=>(<svg viewBox="0 0 24 24" width="18" height="18" {...p}><path fill="currentColor" d="M12 22A10 10 0 1 1 22 12 10 10 0 0 1 12 22Zm-4-9a1 1 0 1 0-1-1 1 1 0 0 0 1 1Zm8 0a1 1 0 1 0-1-1 1 1 0 0 0 1 1ZM7.5 14.5a5.5 5.5 0 0 0 9 0l-1.67-1a3.5 3.5 0 0 1-5.66 0Z"/></svg>);
const IconSend =(p:any)=>(<svg viewBox="0 0 24 24" width="18" height="18" {...p}><path fill="currentColor" d="M2 12L22 2l-4.8 20-5.23-6.1L2 12Zm7.6 1.2 3.68 4.29L18 6.5 6.93 11.6l2.67 1.6Z"/></svg>);
const IconSettings=(p:any)=>(<svg viewBox="0 0 24 24" width="20" height="20" {...p}><path fill="currentColor" d="M19.14 12.94a7.8 7.8 0 0 0 0-1.88l2.11-1.65a1 1 0 0 0 .24-1.32l-2-3.46a1 1 0 0 0-1.23-.44l-2.49 1a7.6 7.6 0 0 0-1.63-.95L13.6 1.5A1 1 0 0 0 12.66 1h-3.3a1 1 0 0 0-1 .5L7.07 4.24a7.6 7.6 0 0 0-1.63.95l-2.49-1a1 1 0 0 0-1.23.44l-2 3.46a1 1 0 0 0 .24 1.32L2.07 11a7.8 7.8 0 0 0 0 1.88l-2.11 1.65a1 1 0 0 0-.24 1.32l2 3.46a1 1 0 0 0 1.23.44l2.49-1a7.6 7.6 0 0 0 1.63.95l1.29 2.74a1 1 0 0 0 1 .5h3.3a1 1 0 0 0 .94-.56l1.29-2.68a7.6 7.6 0 0 0 1.63-.95l2.49 1a1 1 0 0 0 1.23-.44l2-3.46a1 1 0 0 0-.24-1.32ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z"/></svg>);

function Sidebar({onNew}:{onNew:()=>void}) {
  return (
    <aside className="w-[72px] shrink-0 h-full flex flex-col items-center justify-between bg-content2/60 backdrop-blur border-r">
      <div className="flex flex-col items-center gap-3 pt-4">
        <Tooltip content="Чаты"><Button isIconOnly variant="light"><IconChats/></Button></Tooltip>
        <Tooltip content="Личные"><Button isIconOnly variant="light"><IconUser/></Button></Tooltip>
        <Tooltip content="Звонки"><Button isIconOnly variant="light"><IconCall/></Button></Tooltip>
        <Divider className="w-10 my-2"/>
        <Button color="primary" variant="flat" isIconOnly onPress={onNew}>+</Button>
      </div>
      <div className="flex flex-col items-center gap-3 pb-3">
        <Tooltip content="Настройки"><Button isIconOnly variant="light"><IconSettings/></Button></Tooltip>
        <Avatar size="sm" name="A" />
      </div>
    </aside>
  );
}

function ChatList({
  width, query, onSearch, onSelect,
}:{
  width:number;
  query:string;
  onSearch:(q:string)=>void;
  onSelect:(id:string)=>void;
}) {
  const rooms = useAppStore(s => s.rooms);
  const order = useAppStore(s => s.roomOrder);
  const currentId = useAppStore(s => s.currentRoomId);

  const filteredIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return order;
    return order.filter(id => {
      const r = rooms[id];
      if (!r) return false;
      return (r.title ?? '').toLowerCase().includes(q) || (r.lastMessage ?? '').toLowerCase().includes(q);
    });
  }, [order, rooms, query]);

  return (
    <section style={{width}} className="shrink-0 h-full flex flex-col border-r bg-content1">
      <div className="p-3">
        <Input
          radius="lg"
          placeholder="Поиск"
          startContent={<IconSearch className="text-foreground-400" />}
          value={query}
          onValueChange={onSearch}
        />
      </div>
      <div className="flex-1 min-h-0">
        <ScrollShadow className="h-full">
          <ul className="px-1">
            {filteredIds.map((id) => {
              const c = rooms[id];
              if (!c) return null;
              return (
                <li key={id}>
                  <div className={[
                    'w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors group',
                    currentId===id ? 'bg-primary/10' : 'hover:bg-content2/60'
                  ].join(' ')}>
                    <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={()=>onSelect(id)}>
                      <Badge
                        isInvisible={!c.pinned}
                        content="★"
                        size="sm"
                        color="warning"
                        placement="bottom-right"
                        variant="solid"
                      >
                        <Avatar radius="lg" name={(c.title || '•').slice(0,1)} size="md"/>
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate max-w-[180px]">{c.title || 'Без имени'}</span>
                          <span className="ml-auto text-tiny text-foreground-500">
                            {c.lastAt ? new Date(c.lastAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-small text-foreground-500 truncate max-w-[220px]">
                            {c.typing ? 'печатает…' : (c.lastMessage ?? '')}
                          </span>
                          {c.unread ? <Chip size="sm" color="primary" variant="solid">{c.unread}</Chip> : null}
                        </div>
                      </div>
                    </button>

                    {/* Контекстное меню */}
                    <Dropdown>
                      <DropdownTrigger>
                        <Button isIconOnly size="sm" variant="light" className="opacity-0 group-hover:opacity-100" onClick={(e)=>e.stopPropagation()}>
                          <IconMore/>
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="Chat actions"
                        onAction={(key) => {
                          const { pinRoom, muteRoom, deleteRoom } = useAppStore.getState();
                          if (key === 'pin') pinRoom(id, !(rooms[id]?.pinned));
                          if (key === 'mute') muteRoom(id, true);
                          if (key === 'unmute') muteRoom(id, false);
                          if (key === 'delete') deleteRoom(id); // ← серверное soft delete
                        }}
                      >
                        <DropdownItem key="pin">{rooms[id]?.pinned ? 'Unpin' : 'Pin'}</DropdownItem>
                        {!rooms[id]?.muted ? (
                          <DropdownItem key="mute">Mute</DropdownItem>
                        ) : (
                          <DropdownItem key="unmute">Unmute</DropdownItem>
                        )}
                        <DropdownItem key="delete" className="text-danger" color="danger">
                          Delete
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollShadow>
      </div>
    </section>
  );
}

function ChatHeader() {
  const router = useRouter();
  const currentId = useAppStore(s => s.currentRoomId);
  const room = useAppStore(s => (currentId ? s.rooms[currentId] : null));

  return (
    <div className="h-16 shrink-0 flex items-center gap-3 px-4 border-b bg-content1">
      <Avatar name={(room?.title || '—').slice(0,1)} size="sm" />
      <div className="flex flex-col min-w-0">
        <span className="font-medium truncate">{room?.title || '—'}</span>
        <span className="text-tiny text-foreground-500">{room?.typing ? 'печатает…' : 'онлайн'}</span>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Tooltip content="Аудио">
          <Button isIconOnly variant="light" isDisabled={!currentId} onPress={()=> currentId && router.push(`/call/${currentId}`)}>
            <IconCall/>
          </Button>
        </Tooltip>
        <Tooltip content="Видео">
          <Button isIconOnly variant="light" isDisabled={!currentId} onPress={()=> currentId && router.push(`/call/${currentId}`)}>
            <IconVideo/>
          </Button>
        </Tooltip>
        <Tooltip content="Поиск"><Button isIconOnly variant="light"><IconSearch/></Button></Tooltip>
        <Tooltip content="Ещё"><Button isIconOnly variant="light"><IconMore/></Button></Tooltip>
      </div>
    </div>
  );
}

function Bubble({ author, text, at }:{author:'me'|'peer'; text:string; at:number}) {
  const mine = author === 'me';
  return (
    <div className={['w-full flex', mine?'justify-end':'justify-start'].join(' ')}>
      <Card radius="lg" className={['max-w-[70%]', mine?'bg-primary text-primary-foreground':'bg-content2'].join(' ')}>
        <CardBody className="px-3 py-2">
          <div className="whitespace-pre-wrap break-words">{text}</div>
          <div className={['text-tiny mt-1 opacity-80', mine?'text-primary-foreground':'text-foreground-500'].join(' ')}>
            {new Date(at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Composer() {
  const [text, setText] = useState('');
  const send = useAppStore(s => s.sendMessage);
  const setTyping = useAppStore(s => s.setTyping);
  const roomId = useAppStore(s => s.currentRoomId);
  const typingTimer = useRef<any>(null);

  const onSend = () => {
    const t = text.trim();
    if (!t || !roomId) return;
    send(roomId, t);
    setText('');
    setTyping(roomId, false);
  };

  const onInput = (v: string) => {
    setText(v);
    if (!roomId) return;
    setTyping(roomId, true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => roomId && setTyping(roomId, false), 1200);
  };

  return (
    <div className="h-[72px] shrink-0 p-3 border-t bg-content1">
      <div className="flex items-end gap-2 h-full">
        <Button isIconOnly variant="light"><IconAttach/></Button>
        <Input
          radius="lg"
          className="flex-1"
          placeholder="Сообщение…"
          value={text}
          onValueChange={onInput}
          startContent={<IconEmoji className="text-foreground-400" />}
          onKeyDown={(e)=>{ if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
        />
        <Button color="primary" radius="lg" startContent={<IconSend/>} onPress={onSend} isDisabled={!roomId}>
          Отправить
        </Button>
      </div>
    </div>
  );
}

export default function DesktopHome() {
  const {
    connect, requestRooms, setCurrentRoom, markRead, loadMore,
    currentRoomId, messages, roomOrder, hasMore,
    addContactByEmail, createInvite, acceptInvite
  } = useAppStore();

  // socket + периодическое обновление заголовков
  useEffect(() => {
    connect();
    requestRooms();
    const id = setInterval(() => requestRooms(), 10_000);
    return () => clearInterval(id);
  }, [connect, requestRooms]);

  // по умолчанию открываем первую комнату
  useEffect(() => {
    if (!currentRoomId && roomOrder.length) setCurrentRoom(roomOrder[0]);
  }, [currentRoomId, roomOrder, setCurrentRoom]);

  // поиск
  const [query, setQuery] = useState('');

  // ресайзер списка чатов
  const [listW, setListW] = useState(360);
  const dragging = useRef(false);
  const onMouseDown = () => { dragging.current = true; };
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const w = Math.max(280, Math.min(460, e.clientX - 72));
    setListW(Math.round(w));
  };
  const onMouseUp = () => { dragging.current = false; };

  // сообщения текущей комнаты
  const msgs = currentRoomId ? (messages[currentRoomId] ?? []) : [];
  const listRef = useRef<HTMLDivElement>(null);

  // автоскролл вниз при новых
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [currentRoomId, msgs.length]);

  // подгрузка вверх
  const canLoadMore = currentRoomId ? (hasMore[currentRoomId] ?? false) : false;
  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !currentRoomId || !canLoadMore) return;
    if (el.scrollTop <= 24) {
      const prevH = el.scrollHeight;
      loadMore(currentRoomId);
      setTimeout(() => { el.scrollTop = el.scrollHeight - prevH; }, 0);
    }
  }, [currentRoomId, canLoadMore, loadMore]);

  // Модалка «Добавить»
  const [addOpen, setAddOpen] = useState(false);
  const [tab, setTab] = useState<'email'|'link'>('email');
  const [email, setEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string>('');
  const [inviteToken, setInviteToken] = useState<string>('');
  const [pasteToken, setPasteToken] = useState('');

  const submitEmail = async () => {
    const e = email.trim();
    if (!e) return;
    const roomId = await addContactByEmail(e);
    if (roomId) {
      setAddOpen(false);
      setEmail('');
      setCurrentRoom(roomId);
      markRead(roomId);
    }
  };

  const makeInvite = async () => {
    const res = await createInvite('contact');
    if (res) {
      setInviteUrl(res.url || '');
      setInviteToken(res.token || '');
    }
  };

  const acceptByToken = async () => {
    const token = pasteToken.trim().replace(/^https?:\/\/[^/]+\/invite\//,'');
    if (!token) return;
    const roomId = await acceptInvite(token);
    if (roomId) {
      setAddOpen(false);
      setPasteToken('');
      setCurrentRoom(roomId);
      markRead(roomId);
    }
  };

  const selectRoom = (id: string) => {
    setCurrentRoom(id);
    markRead(id);
  };

  return (
    <div className="fixed inset-0 min-w-[1024px] flex bg-content1 text-foreground overflow-hidden"
         onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
      <aside className="w-[72px] shrink-0 h-full flex">
        <Sidebar onNew={()=> setAddOpen(true)} />
      </aside>

      <ChatList width={listW} query={query} onSearch={setQuery} onSelect={selectRoom} />

      <div onMouseDown={onMouseDown} className="w-[3px] cursor-col-resize bg-divider hover:bg-primary/50 transition-colors" />

      <section className="flex-1 min-w-0 h-full flex flex-col bg-content1">
        <ChatHeader />
        <div className="flex-1 min-h-0">
          <ScrollShadow ref={listRef as any} className="h-full px-4 py-4 flex flex-col gap-2" onScroll={onScroll}>
            {canLoadMore ? (
              <div className="text-tiny text-center text-foreground-500 py-1">Загружаю историю…</div>
            ) : null}
            {msgs.map(m => (
              <Bubble key={m.id} author={m.authorId==='me'?'me':'peer'} text={m.text} at={m.at} />
            ))}
          </ScrollShadow>
        </div>
        <Composer />
      </section>

      {/* Add Modal */}
      <Modal isOpen={addOpen} onOpenChange={setAddOpen}>
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>Добавить</ModalHeader>
              <ModalBody>
                <Tabs selectedKey={tab} onSelectionChange={(k)=>setTab(k as any)}>
                  <Tab key="email" title="По e-mail">
                    <div className="flex gap-2">
                      <Input
                        label="E-mail пользователя"
                        value={email}
                        onValueChange={setEmail}
                        onKeyDown={(e)=>{ if (e.key==='Enter') submitEmail(); }}
                      />
                      <Button color="primary" onPress={submitEmail}>Добавить</Button>
                    </div>
                    <div className="text-tiny text-foreground-500">
                      Найдём пользователя по e-mail и создадим личный чат.
                    </div>
                  </Tab>
                  <Tab key="link" title="Пригласительная ссылка">
                    <div className="space-y-2">
                      <Button variant="flat" onPress={makeInvite}>Сгенерировать ссылку</Button>
                      {inviteUrl ? (
                        <Input label="Ссылка" value={inviteUrl} isReadOnly />
                      ) : null}
                      <Divider />
                      <Input
                        label="Вставьте ссылку или токен"
                        placeholder="https://.../invite/<token> или <token>"
                        value={pasteToken}
                        onValueChange={setPasteToken}
                        onKeyDown={(e)=>{ if (e.key==='Enter') acceptByToken(); }}
                      />
                      <Button color="primary" onPress={acceptByToken}>Принять приглашение</Button>
                    </div>
                  </Tab>
                </Tabs>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={()=>onClose()}>Закрыть</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
