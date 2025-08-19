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

  async getUploadPresignedUrl(
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

      return { url, fields, key };
    } catch (error) {
      console.error("Error creating presigned URL:", error);
      throw new Error("Failed to create upload URL");
    }
  }
}

export const s3Service = new S3Service();

async function testS3Service() {
  try {
    console.log("🧪 Testing S3 Service...");

    const result = await s3Service.getUploadPresignedUrl(
      "test-document.pdf",
      "application/pdf",
      "test-user-123",
    );

    console.log("✅ Success! Generated presigned URL:");
    console.log("📁 File Key:", result.key);
    console.log("🔗 Upload URL:", result.url);
    console.log("📋 Form Fields:", result.fields);
    console.log("⏰ URL expires in 5 minutes");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

await testS3Service();
