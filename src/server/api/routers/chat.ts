import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { chats } from "@/server/db/schema";
import { s3Service } from "@/lib/s3-server";

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
        const newChat = await ctx.db
          .insert(chats)
          .values({
            userId,
            fileKey: input.fileKey,
            pdfName: input.fileName,
            pdfUrl,
          })
          .returning();

        return newChat[0];
      } catch (error) {
        console.error("Failed to create chat:", error);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create chat",
        });
      }
    }),
});
