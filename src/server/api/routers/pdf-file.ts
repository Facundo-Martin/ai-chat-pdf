import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { s3Service } from "@/lib/s3-server";
import { embeddings } from "@/server/db/schema";
import { embedPDFContent } from "@/lib/openai";

export const pdfFileRouter = createTRPCRouter({
  // Get presigned URL for uploading PDF
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        fileType: z.literal("application/pdf"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { fileName, fileType } = input;
      const userId = ctx.user.userId;

      try {
        const { url, fields, key } = await s3Service.createPresignedPost(
          fileName,
          fileType,
          userId,
        );

        return {
          uploadUrl: url,
          fields,
          fileKey: key,
        };
      } catch (error) {
        console.error("Failed to generate upload URL:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate upload URL",
        });
      }
    }),

  embed: protectedProcedure
    .input(
      z.object({
        chatId: z.number().min(1),
        content: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const embeddingData = await embedPDFContent(input.content);

        if (embeddingData.length === 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No embeddings generated from content",
          });
        }

        await ctx.db.insert(embeddings).values(
          embeddingData.map((embedding) => ({
            chatId: input.chatId,
            content: embedding.content,
            embedding: embedding.embedding,
          })),
        );

        console.log(
          `Stored ${embeddingData.length} embeddings for chat ${input.chatId}`,
        );

        return {
          success: true,
          embeddingCount: embeddingData.length,
        };
      } catch (error) {
        console.error("Error generating embeddings:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to generate embeddings: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),
});
