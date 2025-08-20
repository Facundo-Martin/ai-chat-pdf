import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { ProcessedPDFDocument } from "@/types/pdf";
import {
  RecursiveCharacterTextSplitter,
  Document,
} from "@pinecone-database/doc-splitter";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function convertToAscii(inputString: string) {
  const asciiString = inputString.replace(/[^\x00-\x7F]+/g, "");
  return asciiString;
}

/**
 * Truncate string by byte length to avoid token limits
 * @param str - String to truncate
 * @param bytes - Maximum bytes
 * @returns Truncated string
 */
export function truncateStringByBytes(str: string, bytes: number): string {
  const encoder = new TextEncoder();
  return new TextDecoder("utf-8").decode(encoder.encode(str).slice(0, bytes));
}

/**
 * Split a PDF page into smaller chunks
 * @param page - Processed PDF page
 * @returns Array of split documents
 */
export async function splitPage(
  page: ProcessedPDFDocument,
): Promise<Document[]> {
  const splitter = new RecursiveCharacterTextSplitter();
  const pageContent = page.pageContent.replace(/\n/g, "");

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
