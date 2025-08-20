import { env } from "@/env";
import { Pinecone, type PineconeRecord } from "@pinecone-database/pinecone";
import { convertToAscii } from "@/lib/utils";

class PineconeService {
  private client: Pinecone;
  private indexName = "ai-chat-pdf"; // The name of our application in app.pinecone.io

  constructor() {
    this.client = new Pinecone({
      apiKey: env.PINECONE_API_KEY,
    });
  }

  /**
   * Get a namespace for a specific file
   * @param fileKey - Unique identifier for the file
   * @returns Pinecone namespace
   */
  public getNamespace(fileKey: string) {
    const index = this.client.index(this.indexName);
    return index.namespace(convertToAscii(fileKey));
  }

  /**
   * Store vectors in Pinecone
   * @param fileKey - File identifier for namespace
   * @param vectors - Array of vectors to store
   */
  public async upsertVectors(
    fileKey: string,
    vectors: PineconeRecord[],
  ): Promise<void> {
    try {
      const namespace = this.getNamespace(fileKey);

      console.log(`Inserting ${vectors.length} vectors into Pinecone`);
      await namespace.upsert(vectors);
      console.log("✅ Vectors successfully inserted");
    } catch (error) {
      console.error("Error upserting vectors to Pinecone:", error);
      throw new Error(
        `Failed to store vectors: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export const pineconeService = new PineconeService();
