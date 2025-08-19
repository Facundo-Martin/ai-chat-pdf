"use client";

import { useDropzone } from "react-dropzone";
import { Inbox, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useFileUpload } from "@/hooks/use-file-upload";
import { cn } from "@/lib/utils";

export function FileUpload() {
  const {
    uploadFile,
    isLoading,
    isPreparing,
    isUploading,
    isSuccess,
    isError,
  } = useFileUpload();

  const { getRootProps, getInputProps } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        void uploadFile(file);
      }
    },
  });

  return (
    <div className="rounded-xl bg-white p-2">
      <div
        {...getRootProps({
          className: cn(
            "border-dashed border-2 rounded-xl cursor-pointer bg-gray-50 py-8 flex justify-center items-center flex-col transition-all",
            {
              "opacity-50 cursor-not-allowed border-gray-300": isLoading,
              "border-green-300 bg-green-50": isSuccess,
              "border-red-300 bg-red-50": isError,
              "hover:bg-gray-100 border-gray-300":
                !isLoading && !isSuccess && !isError,
            },
          ),
        })}
      >
        <input {...getInputProps()} disabled={isLoading} />

        {isSuccess ? (
          <>
            <CheckCircle className="h-10 w-10 text-green-500" />
            <p className="mt-2 text-sm text-green-600">Upload successful!</p>
          </>
        ) : isLoading ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <p className="mt-2 text-sm text-slate-400">
              {isPreparing && "Preparing upload..."}
              {isUploading && "Uploading your PDF..."}
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
              <div className="mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-500" />
                <p className="text-xs text-red-500">
                  Upload failed. Try again.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
