import { openai } from "@ai-sdk/openai";
import { streamText, type UIMessage, convertToModelMessages } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  const result = streamText({
    model: openai("gpt-4o"), // Note: Honestly, I don't want to set openrouter so I'm hardcoding the model on the BE lol
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
