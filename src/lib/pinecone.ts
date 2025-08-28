// lib/pinecone.ts
import { env } from "@/env";
import { Pinecone, type PineconeRecord } from "@pinecone-database/pinecone";
import { type Document } from "@pinecone-database/doc-splitter";
import { convertToAscii, splitPage } from "@/lib/utils";
import { openAIService } from "@/lib/openai";
import type { ProcessedPDFDocument } from "@/types/pdf";
import md5 from "md5";

/**
 * Service for managing Pinecone vector database operations.
 * Handles document processing, embedding generation, and vector storage.
 */
class PineconeService {
  private client: Pinecone;
  private indexName = "chatpdf";

  constructor() {
    this.client = new Pinecone({
      apiKey: env.PINECONE_API_KEY,
    });
  }

  /**
   * Get a Pinecone namespace for a specific file.
   * Uses ASCII conversion to ensure valid namespace names.
   *
   * @param fileKey - Unique identifier for the file
   * @returns Pinecone namespace instance
   */
  public getNamespace(fileKey: string) {
    const index = this.client.index(this.indexName);
    return index.namespace(convertToAscii(fileKey));
  }

  /**
   * Store vectors in Pinecone database.
   *
   * @param fileKey - File identifier used for namespace
   * @param vectors - Array of vectors to store
   * @throws Error if vector storage fails
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

  /**
   * Process PDF pages into vectors and store them in Pinecone.
   * This is the main method that orchestrates the entire pipeline:
   * 1. Split pages into smaller chunks
   * 2. Generate embeddings for each chunk
   * 3. Store vectors in Pinecone
   *
   * @param fileKey - File identifier for namespace organization
   * @param pages - Array of processed PDF pages
   * @returns Object containing the number of vectors created
   * @throws Error if any step of the processing fails
   */
  public async processAndStoreVectors(
    fileKey: string,
    pages: ProcessedPDFDocument[],
  ): Promise<{ vectorCount: number }> {
    try {
      console.log(`🔄 Processing ${pages.length} pages...`);

      // 1. Split pages into chunks
      const allDocuments = await Promise.all(pages.map(splitPage));
      const flatDocuments = allDocuments.flat();
      console.log(`📄 Split into ${flatDocuments.length} chunks`);

      // 2. Generate embeddings for each document chunk
      const vectors = await Promise.all(
        flatDocuments.map((doc) => this.embedDocument(doc)),
      );
      console.log(`🔢 Generated ${vectors.length} embeddings`);

      // 3. Store vectors in Pinecone
      await this.upsertVectors(fileKey, vectors);

      return { vectorCount: vectors.length };
    } catch (error) {
      console.error("Error in processAndStoreVectors:", error);
      throw new Error(
        `Failed to process and store vectors: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Generate embeddings for a document chunk and create a Pinecone record.
   * Creates a unique ID using MD5 hash of the content to prevent duplicates.
   *
   * @param doc - Document chunk to embed
   * @returns Pinecone record with embeddings and metadata
   * @throws Error if embedding generation fails
   * @private
   */
  private async embedDocument(doc: Document): Promise<PineconeRecord> {
    try {
      const embeddings = await openAIService.getEmbeddings(doc.pageContent);
      const hash = md5(doc.pageContent);

      return {
        id: hash,
        values: embeddings,
        metadata: {
          text: doc.metadata.text as string,
          pageNumber: doc.metadata.pageNumber as number,
        },
      };
    } catch (error) {
      console.error("Error embedding document:", error);
      throw new Error(
        `Failed to embed document: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export const pineconeService = new PineconeService();
