import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { s3Service } from "@/lib/s3-server";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

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
        const { url, fields, key } = await s3Service.getUploadPresignedUrl(
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
});
