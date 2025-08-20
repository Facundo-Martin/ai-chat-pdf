import { env } from "@/env";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

const response = await client.responses.create({
  model: "gpt-4o",
  instructions: "You are a coding assistant that talks like a pirate",
  input: "Are semicolons optional in JavaScript?",
});

console.log(response.output_text);

const embedding = await client.embeddings.create({
  model: "text-embedding-3-small",
  input: "Your text string goes here",
  encoding_format: "float",
});

console.log(embedding);

class OpenAIService {
  public async getEmbeddings(text: string) {
    try {
      const response = await client.embeddings.create(
        {
          model: "text-embedding-3-small",
          input: text.replace(/\n/g, " "),
        },
        { maxRetries: 5 },
      );

      return response.data;
    } catch (err) {
      console.error("Error calling openai embeddings API:", err);
      throw new Error();
    }
  }
}

export const openAIService = new OpenAIService();
