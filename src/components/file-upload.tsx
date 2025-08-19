// src/components/FileUpload.tsx
"use client";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Inbox, Loader2, CheckCircle } from "lucide-react";
import { api, type RouterOutputs } from "@/trpc/react";
import { toast } from "sonner";

export function FileUpload() {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "success"
  >("idle");

  const {
    mutate: getUploadUrl,
    isPending,
    isError,
  } = api.pdfFile.getUploadUrl.useMutation({
    onError: () => {
      setUploading(false);
      setUploadStatus("idle");
    },
  });

  const uploadFile = async (file: File) => {
    try {
      setUploading(true);
      setUploadStatus("uploading");

      // Step 1: Get presigned URL using mutate with callback
      getUploadUrl(
        {
          fileName: file.name,
          fileType: "application/pdf",
        },
        {
          onSuccess: (data) => {
            void handleS3Upload(data, file);
          },
          onError: (error) => {
            console.error("Upload URL error:", error);
            toast.error("Failed to get upload URL");
            setUploadStatus("idle");
            setUploading(false);
          },
        },
      );
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus("idle");
      setUploading(false);
      toast.error(
        error instanceof Error ? error.message : "Error uploading file",
      );
    }
  };

  // Extracted S3 upload logic to separate function
  const handleS3Upload = async (
    data: RouterOutputs["pdfFile"]["getUploadUrl"],
    file: File,
  ) => {
    try {
      const { uploadUrl, fields, fileKey } = data;

      // Step 2: Upload directly to S3 using presigned URL
      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append("file", file);

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `S3 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`,
        );
      }

      // Step 3: Success!
      setUploadStatus("success");
      toast.success(`File "${file.name}" uploaded successfully!`);

      // Placeholder: Do something with the uploaded file
      console.log("🎉 File uploaded successfully:", {
        fileKey,
        fileName: file.name,
        // TODO: Add your success logic here (e.g., create chat, process PDF, etc.)
      });

      // Reset to idle after 2 seconds
      setTimeout(() => {
        setUploadStatus("idle");
      }, 2000);
    } catch (s3Error) {
      console.error("S3 upload error:", s3Error);
      toast.error("Failed to upload file to S3");
      setUploadStatus("idle");
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: (acceptedFiles) => {
      // Fixed: Removed async since we handle async inside uploadFile
      const file = acceptedFiles[0];
      if (file) {
        void uploadFile(file);
      }
    },
  });

  const isLoading = uploading || isPending;

  return (
    <div className="rounded-xl bg-white p-2">
      <div
        {...getRootProps({
          className: `border-dashed border-2 rounded-xl cursor-pointer bg-gray-50 py-8 flex justify-center items-center flex-col transition-all ${
            isLoading
              ? "opacity-50 cursor-not-allowed"
              : uploadStatus === "success"
                ? "border-green-300 bg-green-50"
                : isError
                  ? "border-red-300 bg-red-50"
                  : "hover:bg-gray-100 border-gray-300"
          }`,
        })}
      >
        <input {...getInputProps()} disabled={isLoading} />

        {uploadStatus === "success" ? (
          <>
            <CheckCircle className="h-10 w-10 text-green-500" />
            <p className="mt-2 text-sm text-green-600">Upload successful!</p>
          </>
        ) : isLoading ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <p className="mt-2 text-sm text-slate-400">
              {isPending && "Getting upload URL..."}
              {uploading && "Uploading your PDF..."}
            </p>
          </>
        ) : (
          <>
            <Inbox className="h-10 w-10 text-blue-500" />
            <p className="mt-2 text-sm text-slate-400">
              Drop PDF here or click to upload
            </p>
            <p className="text-xs text-slate-300">Max size: 10MB</p>
            {isError && (
              <p className="mt-1 text-xs text-red-500">
                Upload failed. Try again.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
