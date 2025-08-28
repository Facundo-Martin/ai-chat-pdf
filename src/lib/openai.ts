import { env } from "@/env";
import OpenAI from "openai";

class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate embeddings for the given text
   * @param text - Text to embed
   * @returns Array of embedding values
   */
  public async getEmbeddings(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create(
        {
          model: "text-embedding-3-small",
          input: text.replace(/\n/g, " "),
        },
        { maxRetries: 5 },
      );

      return response.data[0]?.embedding ?? [];
    } catch (error) {
      console.error("Error calling OpenAI embeddings API:", error);
      throw new Error(
        `Failed to generate embeddings: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export const openAIService = new OpenAIService();
