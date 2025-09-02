import { cn } from "@/lib/utils";
import type { UIMessage } from "ai";
import { Loader2, User, Bot } from "lucide-react";

type Props = {
  isLoading: boolean;
  messages: UIMessage[];
};

const MessageList = ({ messages, isLoading }: Props) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Thinking...</span>
        </div>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground text-sm">
          No messages yet. Start a conversation!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-2">
      {messages.map((message) => {
        const content = Array.isArray(message.parts)
          ? message.parts.join("")
          : message.parts || message.content || "";

        return (
          <div
            key={message.id}
            className={cn("flex gap-3", {
              "justify-end": message.role === "user",
              "justify-start": message.role === "assistant",
            })}
          >
            {message.role === "assistant" && (
              <div className="bg-primary/10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
                <Bot className="text-primary h-4 w-4" />
              </div>
            )}

            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
                {
                  "bg-primary text-primary-foreground ml-auto":
                    message.role === "user",
                  "bg-muted text-foreground": message.role === "assistant",
                },
              )}
            >
              <div className="break-words whitespace-pre-wrap">{content}</div>
            </div>

            {message.role === "user" && (
              <div className="bg-primary/10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
                <User className="text-primary h-4 w-4" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MessageList;
