import { redirect } from "next/navigation";
import React from "react";
import { api } from "@/trpc/server";

type Props = {
  params: Promise<{ chatId: string }>;
};

export default async function ChatPage({ params }: Props) {
  const { chatId } = await params;

  let currentChat;
  try {
    currentChat = await api.chat.get({ id: parseInt(chatId) });
  } catch (error) {
    console.error("Failed to fetch chat:", error);
    return redirect("/");
  }

  return (
    <div className="flex max-h-screen overflow-scroll">
      <div className="flex max-h-screen w-full overflow-scroll">
        {/* chat sidebar */}
        <div className="max-w-xs flex-[1]">
          {/* <ChatSideBar chatId={parseInt(chatId)} isPro={isPro} /> */}
        </div>
        {/* pdf viewer */}
        <div className="max-h-screen flex-[5] overflow-scroll p-4">
          {/* <PDFViewer pdf_url={currentChat.pdfUrl} /> */}
        </div>
        {/* chat component */}
        <div className="flex-[3] border-l-4 border-l-slate-200">
          {/* <ChatComponent chatId={parseInt(chatId)} /> */}
        </div>
      </div>
    </div>
  );
}
