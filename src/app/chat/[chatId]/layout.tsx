import { api } from "@/trpc/server";
import { ChatSidebar } from "@/components/chat-sidebar";

export default async function ChatLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ chatId?: string }>;
}) {
  const allChats = await api.chat.getAll();
  const { chatId } = await params;

  return (
    <div className="flex w-full">
      <div className="max-w-xs flex-[1]">
        <ChatSidebar chatId={parseInt(chatId ?? "0")} chats={allChats} />
      </div>
      <div className="flex-[8]">{children}</div>
    </div>
  );
}
