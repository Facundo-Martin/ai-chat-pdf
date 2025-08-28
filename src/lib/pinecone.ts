// lib/pinecone.ts
import { env } from "@/env";
import { Pinecone, type PineconeRecord } from "@pinecone-database/pinecone";
import { type Document } from "@pinecone-database/doc-splitter";
import { convertToAscii, splitPage } from "@/lib/utils";
import { openAIService } from "@/lib/openai";
import type { ProcessedPDFDocument } from "@/types/pdf";
import md5 from "md5";

class PineconeService {
  private client: Pinecone;
  private indexName = "chatpdf";

  constructor() {
    this.client = new Pinecone({
      apiKey: env.PINECONE_API_KEY,
    });
  }

  public getNamespace(fileKey: string) {
    const index = this.client.index(this.indexName);
    return index.namespace(convertToAscii(fileKey));
  }

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

  public async processAndStoreVectors(
    fileKey: string,
    pages: ProcessedPDFDocument[],
  ): Promise<{ vectorCount: number }> {
    console.log(`🔄 Processing ${pages.length} pages...`);

    // 1. Split pages into chunks
    const allDocuments = await Promise.all(pages.map(splitPage));
    const flatDocuments = allDocuments.flat();
    console.log(`📄 Split into ${flatDocuments.length} chunks`);

    // 2. Generate embeddings object for storage (PineconeRecord)
    const vectors = await Promise.all(
      flatDocuments.map((doc) => this.embedDocument(doc)),
    );
    console.log(`🔢 Generated ${vectors.length} embeddings`);

    // Store in Pinecone DB
    await this.upsertVectors(fileKey, vectors);

    return { vectorCount: vectors.length };
  }

  /**
   * Generate embeddings for a document and create a Pinecone record
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
