import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { and, cosineDistance, desc, eq, gt, sql } from "drizzle-orm";
import { embeddings } from "@/server/db/schema";
import { db } from "@/server/db";

const embeddingModel = openai.embedding("text-embedding-ada-002");

const generateChunks = (input: string): string[] => {
  return input
    .trim()
    .split(".")
    .filter((i) => i !== "" && i.length > 10);
};

// Generate embeddings for all chunks
export const embedPDFContent = async (
  value: string,
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const chunks = generateChunks(value);
  console.log(`Generated ${chunks.length} chunks from text`);

  if (chunks.length === 0) {
    throw new Error("No valid chunks generated from text");
  }

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  });

  return embeddings.map((e, i) => ({
    content: (chunks[i] ?? "").trim() + ".",
    embedding: e,
  }));
};

export const embedUserQuery = async (value: string): Promise<number[]> => {
  const input = value.replaceAll("\n", " ");
  const { embedding } = await embed({
    model: embeddingModel,
    value: input,
  });
  return embedding;
};

export const findRelevantContent = async (
  userQuery: string,
  chatId: number,
) => {
  const userQueryEmbedded = await embedUserQuery(userQuery);
  const similarity = sql<number>`1 - (${cosineDistance(
    embeddings.embedding,
    userQueryEmbedded,
  )})`;

  const results = await db
    .select({
      content: embeddings.content,
      similarity,
    })
    .from(embeddings)
    .where(and(eq(embeddings.chatId, chatId), gt(similarity, 0.5)))
    .orderBy(desc(similarity))
    .limit(4);

  console.log(
    `Found ${results.length} relevant chunks for query: "${userQuery}"`,
  );

  return results;
};
