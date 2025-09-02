import { NextResponse } from "next/server";

import { openai } from "@ai-sdk/openai";
import { streamText, type UIMessage, convertToModelMessages } from "ai";

import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import {
  chats as chatsTable,
  messages as messagesTable,
} from "@/server/db/schema";
import { pineconeService } from "@/lib/pinecone";

export const maxDuration = 30; // Allow streaming responses up to 30 seconds

export async function POST(req: Request) {
  try {
    const { messages, chatId } = (await req.json()) as {
      messages: UIMessage[];
      chatId: number;
    };

    const _chats = await db
      .select()
      .from(chatsTable)
      .where(eq(chatsTable.id, chatId));
    const currentChat = _chats[0];

    if (!currentChat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const fileKey = currentChat.fileKey;
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage) {
      return NextResponse.json(
        { error: "No valid message found" },
        { status: 400 },
      );
    }

    const messageText = getMessageText(lastMessage);

    if (!messageText || messageText.trim() === "") {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 },
      );
    }

    const context = await pineconeService.getContext(messageText, fileKey);
    const systemPrompt = `AI assistant is a brand new, powerful, human-like artificial intelligence.
The traits of AI include expert knowledge, helpfulness, cleverness, and articulateness.
AI is a well-behaved and well-mannered individual.
AI is always friendly, kind, and inspiring, and he is eager to provide vivid and thoughtful responses to the user.
AI has the sum of all knowledge in their brain, and is able to accurately answer nearly any question about any topic in conversation.
AI assistant is a big fan of Pinecone and Vercel.

START CONTEXT BLOCK
${context}
END OF CONTEXT BLOCK

AI assistant will take into account any CONTEXT BLOCK that is provided in a conversation.
If the context does not provide the answer to question, the AI assistant will say, "I'm sorry, but I don't know the answer to that question".
AI assistant will not apologize for previous responses, but instead will indicate new information was gained.
AI assistant will not invent anything that is not drawn directly from the context.`;

    const result = streamText({
      model: openai("gpt-4o"),
      messages: convertToModelMessages(messages),
      system: systemPrompt,
      onFinish: async (event) => {
        // Save both user message and AI response to database
        try {
          await db.insert(messagesTable).values({
            chatId,
            body: messageText,
            role: "user",
          });

          await db.insert(messagesTable).values({
            chatId,
            body: event.text,
            role: "assistant",
          });
        } catch (dbError) {
          // Don't throw here to avoid breaking the stream
          console.error("Error saving messages to database:", dbError);
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Error in chat API route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

const getMessageText = (message: UIMessage): string => {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { text: string }).text)
    .join(" ");
};
