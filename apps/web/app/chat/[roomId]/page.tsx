import ChatClient from './ChatClient';

type PageProps = {
  params: { roomId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function Page({ params }: PageProps) {
  return <ChatClient roomId={params.roomId} />;
}
