import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { chats } from "@/server/db/schema";
import { s3Service } from "@/lib/s3-server";
import { eq, desc, and } from "drizzle-orm";
import PDF from "pdf-parse";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export const chatRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        fileKey: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.userId;
      const pdfUrl = s3Service.getPublicUrl(input.fileKey);

      try {
        // 1. Get PDF from S3
        const pdfStream = await s3Service.getObject(input.fileKey);
        const pdfBuffer = await streamToBuffer(
          pdfStream as NodeJS.ReadableStream,
        );

        // 2. Parse PDF buffer
        const pdfData = await PDF(pdfBuffer);

        // 3. Extract & clean text
        const pdfContent = pdfData.text
          .replace(/\s+/g, " ")
          .replace(/\n\s*\n/g, "\n")
          .trim();

        if (!pdfContent || pdfContent.length < 50) {
          throw new Error(
            "PDF appears to be empty or contains no extractable text",
          );
        }

        // 4. Create chat record
        const [newChat] = await ctx.db
          .insert(chats)
          .values({
            userId,
            fileKey: input.fileKey,
            pdfName: input.fileName,
            pdfUrl,
            content: pdfContent,
          })
          .returning();

        if (!newChat) {
          throw new Error("Failed to create chat record");
        }

        return newChat;
      } catch (error) {
        console.error("Failed to create chat:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to create chat",
        });
      }
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.userId;

      try {
        const chat = await ctx.db
          .select()
          .from(chats)
          .where(and(eq(chats.id, input.id), eq(chats.userId, userId)))
          .limit(1);

        if (chat.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Chat not found",
          });
        }

        return chat[0];
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Failed to fetch chat:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch chat",
        });
      }
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.userId;

    try {
      const userChats = await ctx.db
        .select()
        .from(chats)
        .where(eq(chats.userId, userId))
        .orderBy(desc(chats.created_at));

      return userChats;
    } catch (error) {
      console.error("Failed to fetch user chats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch chats",
      });
    }
  }),
});
