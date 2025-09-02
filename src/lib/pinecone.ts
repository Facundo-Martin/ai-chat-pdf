import { env } from "@/env";
import { Pinecone, type PineconeRecord } from "@pinecone-database/pinecone";
import { type Document } from "@pinecone-database/doc-splitter";
import { convertToAscii, splitPage } from "@/lib/utils";
import { openAIService } from "@/lib/openai";
import type { ProcessedPDFDocument } from "@/types/pdf";
import md5 from "md5";

/**
 * Metadata structure for stored vectors
 */
type VectorMetadata = {
  text: string;
  pageNumber: number;
};

/**
 * Service for managing Pinecone vector database operations.
 * Handles document processing, embedding generation, vector storage, and context retrieval.
 * Automatically creates the required index on initialization.
 */
class PineconeService {
  private client: Pinecone;
  private indexName = "ai-chat-pdf";

  constructor() {
    this.client = new Pinecone({
      apiKey: env.PINECONE_API_KEY,
    });

    // Create index immediately on service initialization
    this.createIndex().catch((error) => {
      console.error("Failed to initialize Pinecone index:", error);
    });
  }

  /**
   * Create the Pinecone index if it doesn't exist.
   * Uses OpenAI text-embedding-3-small dimensions (1536) and cosine similarity.
   * This method is called once during service initialization.
   *
   * @private
   * @throws Error if index creation fails
   */
  private async createIndex(): Promise<void> {
    try {
      await this.client.describeIndex(this.indexName);
      console.log(`Index "${this.indexName}" already exists`);
    } catch (error) {
      console.error(error);
      console.log(`Creating index "${this.indexName}"...`);

      await this.client.createIndex({
        name: this.indexName,
        dimension: 1536, // OpenAI text-embedding-3-small dimensions
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1",
          },
        },
        waitUntilReady: true,
      });

      console.log(`Index "${this.indexName}" created successfully`);
    }
  }

  /**
   * Get a Pinecone namespace for a specific file.
   * Uses ASCII conversion to ensure valid namespace names.
   * Assumes the index already exists (created during initialization).
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
      console.log("Vectors successfully inserted");
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
      console.log(`Processing ${pages.length} pages...`);

      // 1. Split pages into chunks
      const allDocuments = await Promise.all(pages.map(splitPage));
      const flatDocuments = allDocuments.flat();
      console.log(`Split into ${flatDocuments.length} chunks`);

      // 2. Generate embeddings for each document chunk
      const vectors = await Promise.all(
        flatDocuments.map((doc) => this.embedDocument(doc)),
      );
      console.log(`Generated ${vectors.length} embeddings`);

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
   * Query vectors similar to the provided embeddings.
   *
   * @param embeddings - Query vector embeddings
   * @param fileKey - File identifier for namespace
   * @param topK - Number of top matches to return (default: 5)
   * @param scoreThreshold - Minimum similarity score threshold (default: 0.7)
   * @returns Array of matching vectors with metadata
   * @throws Error if query fails
   */
  public async getMatchesFromEmbeddings(
    embeddings: number[],
    fileKey: string,
    topK = 5,
    scoreThreshold = 0.7,
  ) {
    try {
      const namespace = this.getNamespace(fileKey);

      const queryResult = await namespace.query({
        topK,
        vector: embeddings,
        includeMetadata: true,
      });

      // Filter matches by score threshold
      const qualifyingMatches = (queryResult.matches || []).filter(
        (match) => match.score && match.score > scoreThreshold,
      );

      return qualifyingMatches;
    } catch (error) {
      console.error("Error querying embeddings:", error);
      throw new Error(
        `Failed to get matches from embeddings: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get relevant context for a query by finding similar document chunks.
   * This is the main method for retrieval-augmented generation (RAG).
   *
   * @param query - User's query text
   * @param fileKey - File identifier for namespace
   * @param options - Optional configuration
   * @param options.topK - Number of top matches to retrieve (default: 5)
   * @param options.scoreThreshold - Minimum similarity score (default: 0.7)
   * @param options.maxContextLength - Maximum context string length (default: 3000)
   * @returns Relevant context string for the query
   * @throws Error if context retrieval fails
   */
  public async getContext(
    query: string,
    fileKey: string,
    options: {
      topK?: number;
      scoreThreshold?: number;
      maxContextLength?: number;
    } = {},
  ): Promise<string> {
    try {
      const {
        topK = 5,
        scoreThreshold = 0.7,
        maxContextLength = 3000,
      } = options;

      console.log(`Getting context for query: "${query}"`);

      // 1. Generate embeddings for the query
      const queryEmbeddings = await openAIService.getEmbeddings(query);

      // 2. Find similar document chunks
      const matches = await this.getMatchesFromEmbeddings(
        queryEmbeddings,
        fileKey,
        topK,
        scoreThreshold,
      );

      console.log(`Found ${matches.length} qualifying matches`);

      // 3. Extract and combine text from matches
      const docs = matches.map(
        (match) => (match.metadata as VectorMetadata).text,
      );

      // 4. Join and truncate context
      const context = docs.join("\n").substring(0, maxContextLength);

      return context;
    } catch (error) {
      console.error("Error getting context:", error);
      throw new Error(
        `Failed to get context: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get detailed context with metadata for debugging or advanced use cases.
   * Returns both the context string and detailed match information.
   *
   * @param query - User's query text
   * @param fileKey - File identifier for namespace
   * @param options - Optional configuration (same as getContext)
   * @returns Object containing context string and detailed matches
   */
  public async getDetailedContext(
    query: string,
    fileKey: string,
    options: {
      topK?: number;
      scoreThreshold?: number;
      maxContextLength?: number;
    } = {},
  ) {
    try {
      const {
        topK = 5,
        scoreThreshold = 0.7,
        maxContextLength = 3000,
      } = options;

      const queryEmbeddings = await openAIService.getEmbeddings(query);
      const matches = await this.getMatchesFromEmbeddings(
        queryEmbeddings,
        fileKey,
        topK,
        scoreThreshold,
      );

      const docs = matches.map(
        (match) => (match.metadata as VectorMetadata).text,
      );
      const context = docs.join("\n").substring(0, maxContextLength);

      return {
        context,
        matches: matches.map((match) => ({
          score: match.score,
          pageNumber: (match.metadata as VectorMetadata).pageNumber,
          text: (match.metadata as VectorMetadata).text,
        })),
        totalMatches: matches.length,
      };
    } catch (error) {
      console.error("Error getting detailed context:", error);
      throw new Error(
        `Failed to get detailed context: ${error instanceof Error ? error.message : "Unknown error"}`,
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
