import { findRelevantContent } from "@/lib/openai";
import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, chatId } = (await req.json()) as {
      messages: UIMessage[];
      chatId: number;
    };

    const result = streamText({
      model: openai("gpt-4o"),
      messages: convertToModelMessages(messages),
      stopWhen: stepCountIs(5),
      system: `You are a helpful assistant that analyzes PDF documents. 

CRITICAL INSTRUCTIONS:
1. ALWAYS use the searchDocument tool before answering any questions about the document
2. Only respond using information found through the search tool
3. If no relevant information is found, say "I couldn't find information about that in this document"
4. When you find relevant information, provide detailed and comprehensive answers
5. Quote directly from the document when helpful
6. Be thorough - if someone asks about programming languages, list ALL that you find

RESPONSE STYLE:
- Use bullet points for lists
- Be specific and comprehensive
- Quote exact text when relevant
- Organize information clearly`,
      tools: {
        searchDocument: tool({
          description: `get information from your knowledge base to answer questions.`,
          inputSchema: z.object({
            question: z
              .string()
              .describe("The user's question or search query"),
          }),
          execute: async ({ question }) =>
            findRelevantContent(question, chatId),
        }),
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
