"server-only";

import { env } from "@/env";

import {
  S3Client,
  GetObjectCommand,
  NoSuchKey,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

const s3Client = new S3Client({
  region: env.AWS_S3_REGION,
  credentials: {
    accessKeyId: env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_S3_SECRET_ACCESS_KEY,
  },
});

class S3Service {
  private bucketName = env.AWS_S3_BUCKET_NAME;
  private region = env.AWS_S3_REGION;

  /**
   * Creates a presigned POST for direct client-side file uploads to S3.
   *
   * This allows the frontend to upload files directly to S3 without routing through our server,
   * which provides several benefits:
   * - Reduces server bandwidth and processing load
   * - Faster uploads (direct to S3, no proxy through our server)
   * - Better scalability (S3 handles the upload traffic)
   * - Cost efficiency (no data transfer costs through our server)
   *
   * Presigned POST vs Presigned URL:
   * - POST: More secure with granular conditions (file size, type, metadata)
   * - POST: Can enforce specific form fields and validation rules
   * - POST: Better for HTML forms and multipart uploads
   * - URL: Simpler but less control over upload constraints
   *
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-presigned-post/
   * @see https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-HTTPPOSTConstructPolicy.html
   * @param fileName - Original file name (will be sanitized)
   * @param fileType - MIME type of the file (e.g., "application/pdf")
   * @param userId - User ID for organizing uploads and metadata
   * @returns Object containing upload URL, form fields, and the S3 key
   */
  public async createPresignedPost(
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

  /**
   * Retrieves an object from S3 by its key.
   *
   * @param key - The S3 object key (path within the bucket)
   * @returns Promise resolving to the object's body as a readable stream
   * @throws Error if the object doesn't exist or access is denied
   */
  public async getObject(key: string) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await s3Client.send(command);

      if (!response.Body) {
        throw new Error(`Object not found: ${key}`);
      }

      return response.Body;
    } catch (error) {
      if (error instanceof NoSuchKey) {
        console.error(
          `Error from S3 while getting object "${key}" from "${this.bucketName}". No such key exists.`,
        );
        throw new Error(`Object not found: ${key}`);
      } else if (error instanceof S3ServiceException) {
        console.error(
          `Error from S3 while getting object from ${this.bucketName}. ${error.name}: ${error.message}`,
        );
        throw new Error(`S3 service error: ${error.message}`);
      } else {
        console.error(`Unexpected error retrieving object ${key}:`, error);
        throw error;
      }
    }
  }

  /**
   * Constructs a public S3 URL from an object key.
   *
   * @param key - The S3 object key (path within the bucket)
   * @returns Public HTTPS URL to access the object
   */
  public getPublicUrl(key: string): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }
}

export const s3Service = new S3Service();
