import Link from "next/link";
import type { SelectChat } from "@/server/db/schema";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { MessageCircle, PlusCircle } from "lucide-react";

type Props = {
  chats: SelectChat[];
  chatId: number;
};

export const ChatSidebar = ({ chats, chatId }: Props) => {
  return (
    <div className="h-screen w-full overflow-hidden bg-gray-900 p-4 text-gray-200">
      <Link href="/">
        <Button className="w-full border border-dashed border-white">
          <PlusCircle className="mr-2 size-4" />
          New Chat
        </Button>
      </Link>

      <div className="hide-scrollbar mt-4 flex max-h-screen flex-col gap-2 overflow-y-scroll pb-20">
        {chats.map((chat) => (
          <Link key={chat.id} href={`/chat/${chat.id}`}>
            <div
              className={cn("flex items-center rounded-lg p-3 text-slate-300", {
                "bg-blue-600 text-white": chat.id === chatId,
                "hover:text-white": chat.id !== chatId,
              })}
            >
              <MessageCircle className="mr-2" />
              <p className="w-full truncate overflow-hidden text-sm text-ellipsis whitespace-nowrap">
                {chat.pdfName}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
