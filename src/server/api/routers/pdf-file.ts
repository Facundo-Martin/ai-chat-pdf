import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { s3Service } from "@/lib/s3-server";
import { pineconeService } from "@/lib/pinecone";
import { processPDFFromS3 } from "@/lib/pdf-processor";

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

  loadIntoPinecone: protectedProcedure
    .input(
      z.object({
        fileKey: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // Step 1: Download from S3
        const s3Object = await s3Service.getObject(input.fileKey);

        // Step 2: Process PDF (download locally + parse + format)
        const processedDocs = await processPDFFromS3(s3Object);

        // Step 3: Process and store in Pinecone
        const result = await pineconeService.processAndStoreVectors(
          input.fileKey,
          processedDocs,
        );

        return {
          success: true,
          documentCount: processedDocs.length,
          vectorCount: result.vectorCount,
          message: `Successfully processed ${processedDocs.length} pages into ${result.vectorCount} vectors`,
        };
      } catch (error) {
        console.error("❌ Error processing PDF:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to process PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),
});
