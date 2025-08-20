import { join } from "path";
import { unlink } from "fs/promises";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { type Document as LangChainDocument } from "@langchain/core/documents";
import { type StreamingBlobPayloadOutputTypes } from "@smithy/types";
import type { PDFMetadata, ProcessedPDFDocument } from "@/types/pdf";

export async function processPDFFromS3(
  s3Object: StreamingBlobPayloadOutputTypes,
): Promise<ProcessedPDFDocument[]> {
  let filePath: string | null = null;

  try {
    // Write file from S3 locally
    const fileName = `pdf-${Date.now()}.pdf`;
    filePath = join("/tmp", fileName);

    const writeStream = createWriteStream(filePath);
    await pipeline(s3Object as NodeJS.ReadableStream, writeStream);
    console.log(`📥 PDF saved locally: ${filePath}`);

    // Parse with LangChain
    const loader = new PDFLoader(filePath);
    const pages: LangChainDocument[] = await loader.load();
    console.log(`📄 PDF parsed into ${pages.length} pages`);

    // Format documents
    const processedDocs: ProcessedPDFDocument[] = pages.map((doc) => ({
      pageContent: doc.pageContent,
      metadata: doc.metadata as PDFMetadata,
      id: doc.id,
    }));

    return processedDocs;
  } catch (error) {
    console.error("Error processing PDF:", error);
    throw new Error(
      `Failed to process PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  } finally {
    if (filePath) {
      try {
        await unlink(filePath);
        console.log(`🗑️ Temporary file cleaned up: ${filePath}`);
      } catch (cleanupError) {
        console.warn("Failed to cleanup temporary file:", cleanupError);
      }
    }
  }
}
