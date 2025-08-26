export type UiMessage = {
  id: number;
  roomId: number;
  authorId: string; // ← ВСЕГДА строка
  text: string;
  at: number;       // ms timestamp
};

export function normalizeMessage(m: any): UiMessage {
  return {
    id: Number(m.id),
    roomId: Number(m.room_id ?? m.roomId),
    authorId: String(m.author_id ?? m.authorId),
    text: String(m.text ?? ""),
    at: Number(m.at),
  };
}