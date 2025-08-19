"use client";

import { useState } from "react";

import { api } from "@/trpc/react";

import { toast } from "sonner";

type UploadStatus = "idle" | "preparing" | "uploading" | "success" | "error";

export function useFileUpload() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const uploadMutation = api.pdfFile.getUploadUrl.useMutation();

  const uploadFile = async (file: File) => {
    try {
      setStatus("preparing");

      // Step 1: Get presigned URL
      const { uploadUrl, fields, fileKey } = await uploadMutation.mutateAsync({
        fileName: file.name,
        fileType: "application/pdf",
      });

      setStatus("uploading");

      // Step 2: Upload to S3
      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append("file", file);

      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorMessage = `S3 upload failed: ${response.status} ${response.statusText}`;
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      // Step 3: Success
      setStatus("success");
      toast.success(`File "${file.name}" uploaded successfully!`);

      // TODO: Add your success logic here
      console.log("🎉 File uploaded successfully:", {
        fileKey,
        fileName: file.name,
      });

      // Auto-reset after 5 seconds
      setTimeout(() => setStatus("idle"), 5000);

      return fileKey;
    } catch (error) {
      setStatus("error");
      console.error("Upload failed:", error);
      toast.error(error instanceof Error ? error.message : "Upload failed");

      // Auto-reset error state after 5 seconds
      setTimeout(() => setStatus("idle"), 5000);
      throw error;
    }
  };

  return {
    uploadFile,
    status,
    isLoading: status === "preparing" || status === "uploading",
    isPreparing: status === "preparing",
    isUploading: status === "uploading",
    isSuccess: status === "success",
    isError: status === "error",
    reset: () => setStatus("idle"),
  };
}
