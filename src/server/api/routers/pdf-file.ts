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

import {
  Document,
  RecursiveCharacterTextSplitter,
} from "@pinecone-database/doc-splitter";
import { openAIService } from "@/lib/openai";

import md5 from "md5";
import type { PineconeRecord } from "@pinecone-database/pinecone";
import { pc } from "@/lib/pinecone";
import { convertToAscii } from "@/lib/utils";

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
        const pages: LangChainDocument[] = await loader.load();

        console.log(`PDF parsed into ${pages.length} pages`);

        const processedDocs: ProcessedPDFDocument[] = pages.map(
          (doc, index) => {
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
          },
        );

        // Log all the chunks
        processedDocs.forEach((doc, index) => {
          console.log(`\n📄 Document ${index + 1}:`);
          console.log(`📝 Content (${doc.pageContent.length} characters):`);
          console.log(doc.pageContent);
          console.log(`📋 Metadata:`, doc.metadata);
          console.log("=".repeat(80)); // Separator line
        });

        // Split and segment the pdf
        const documents = await Promise.all(
          processedDocs.map((page) => prepareDocument(page)),
        );

        // Vectorize and embed individual documents
        const vectors = await Promise.all(documents.flat().map(embedDocument));

        // Upload to pinecone
        const pineconeIndex = pc.index("chatpdf");
        const namespace = pineconeIndex.namespace(
          convertToAscii(input.fileKey),
        );

        console.log("inserting vectors into pinecone");
        await namespace.upsert(vectors);

        return documents[0];
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

async function embedDocument(doc: Document) {
  try {
    const embeddings = await openAIService.getEmbeddings(doc.pageContent);
    const hash = md5(doc.pageContent);

    // TODO: Fix this
    return {
      id: hash,
      values: embeddings as number[],
      metadata: {
        text: doc.metadata.text,
        pageNumber: doc.metadata.pageNumber,
      },
    } as PineconeRecord;
  } catch (error) {
    console.log("error embedding document", error);
    throw error;
  }
}

async function prepareDocument(page: ProcessedPDFDocument) {
  const pageContent = page.pageContent.replace(/\n/g, "");
  // split the docs
  const splitter = new RecursiveCharacterTextSplitter();
  const docs = await splitter.splitDocuments([
    new Document({
      pageContent,
      metadata: {
        pageNumber: page.metadata.loc.pageNumber,
        text: truncateStringByBytes(pageContent, 36000),
      },
    }),
  ]);
  return docs;
}

export const truncateStringByBytes = (str: string, bytes: number) => {
  const encoder = new TextEncoder();
  return new TextDecoder("utf-8").decode(encoder.encode(str).slice(0, bytes));
};
