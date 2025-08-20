import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { s3Service } from "@/lib/s3-server";
import type { PDFMetadata, ProcessedPDFDocument } from "@/types/pdf";

import { join } from "path";
import { unlink } from "fs/promises";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { type Document as LangChainDocument } from "@langchain/core/documents";

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
      let filePath: string | null = null;

      try {
        // Step 1: Download the PDF from S3
        const object = await s3Service.getObject(input.fileKey);

        // Step 2: Write the object locally
        const fileName = `pdf-${Date.now()}.pdf`;
        filePath = join("/tmp", fileName);

        const writeStream = createWriteStream(filePath);
        await pipeline(object as NodeJS.ReadableStream, writeStream);

        console.log(`PDF downloaded and saved to: ${filePath}`);

        // Step 3: Load and parse PDF with LangChain
        const loader = new PDFLoader(filePath);
        const docs: LangChainDocument[] = await loader.load();

        console.log(`PDF parsed into ${docs.length} documents`);

        const processedDocs: ProcessedPDFDocument[] = docs.map((doc, index) => {
          console.log(`\n📄 Document ${index + 1}:`);
          console.log(`📝 Content (${doc.pageContent.length} characters):`);
          console.log(doc.pageContent);
          console.log(`📋 Metadata:`, doc.metadata);
          console.log("=".repeat(80));

          return {
            pageContent: doc.pageContent,
            metadata: doc.metadata as PDFMetadata,
            id: doc.id,
          };
        });

        // Log all the chunks
        docs.forEach((doc, index) => {
          console.log(`\n📄 Document ${index + 1}:`);
          console.log(`📝 Content (${doc.pageContent.length} characters):`);
          console.log(doc.pageContent);
          console.log(`📋 Metadata:`, doc.metadata);
          console.log("=".repeat(80)); // Separator line
        });

        // TODO: Add Pinecone vector storage logic
        const result = {
          success: true,
          documentCount: processedDocs.length,
          message: `Successfully processed ${processedDocs.length} document pages`,
          documents: processedDocs,
        };

        return result;
      } catch (error) {
        console.error("Error in loadIntoPinecone:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to process PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      } finally {
        // Cleanup temporary file
        if (filePath) {
          try {
            await unlink(filePath);
            console.log(`Temporary file ${filePath} cleaned up`);
          } catch (cleanupError) {
            console.warn("Failed to cleanup temporary file:", {
              path: filePath,
              error:
                cleanupError instanceof Error
                  ? cleanupError.message
                  : String(cleanupError),
            });
          }
        }
      }
    }),
});
