import { redirect } from "next/navigation";
import React from "react";
import { api } from "@/trpc/server";
import { ChatSidebar } from "@/components/chat-sidebar";
import PDFViewer from "@/components/pdf-viewer";
import { ChatComponent } from "@/components/chat-component";

type Props = {
  params: Promise<{ chatId: string }>;
};

export default async function ChatPage({ params }: Props) {
  const { chatId } = await params;
  const currentChat = await api.chat.get({ id: parseInt(chatId) });

  if (!currentChat) {
    redirect("/");
  }

  return (
    <div className="flex">
      <div className="hide-scrollbar h-screen flex-[5] overflow-y-scroll p-4">
        <PDFViewer pdfUrl={currentChat.pdfUrl} />
      </div>
      <div className="w-80 flex-[3] shrink-0 border-l-4 border-l-slate-200">
        <ChatComponent chatId={parseInt(chatId)} />
      </div>
    </div>
  );
}
