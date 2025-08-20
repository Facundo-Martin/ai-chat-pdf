"server-only";

import { env } from "@/env";

import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

const s3Client = new S3Client({
  region: env.AWS_S3_REGION,
  credentials: {
    accessKeyId: env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_S3_SECRET_ACCESS_KEY,
  },
});

export class S3Service {
  private bucketName = env.AWS_S3_BUCKET_NAME;
  private region = env.AWS_S3_REGION;

  async createPresignedPost(
    fileName: string,
    fileType: string,
    userId: string,
  ) {
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `uploads/${userId}/${Date.now()}-${sanitizedFileName}`;

    try {
      const { url, fields } = await createPresignedPost(s3Client, {
        Bucket: this.bucketName,
        Key: key,
        Conditions: [
          ["content-length-range", 1024, 10485760], // 1KB min, 10MB max
          ["eq", "$Content-Type", fileType],
          ["eq", "$key", key],
        ],
        Fields: {
          "Content-Type": fileType,
          "x-amz-meta-user-id": userId,
          "x-amz-meta-upload-time": new Date().toISOString(),
          "x-amz-meta-app": "chatpdf",
          "x-amz-server-side-encryption": "AES256",
        },
        Expires: 300, // 5 minutes
      });

      return {
        url,
        fields,
        key,
      };
    } catch (error) {
      console.error("Error creating presigned post:", error);
      throw new Error("Failed to create upload URL");
    }
  }

  // Helper method to get public URL from key
  getPublicUrl(key: string): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }
}

export const s3Service = new S3Service();
