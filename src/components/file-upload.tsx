"use client";

import { useDropzone } from "react-dropzone";
import { Inbox, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFileUpload } from "@/hooks/use-file-upload";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function FileUpload() {
  const router = useRouter();
  const createChatMutation = api.chat.create.useMutation();

  const {
    uploadFile,
    isLoading,
    isPreparing,
    isUploading,
    isSuccess,
    isError,
  } = useFileUpload({
    onSuccess: async (fileKey, fileName) => {
      try {
        const newChat = await createChatMutation.mutateAsync({
          fileKey,
          fileName,
        });

        if (newChat) {
          toast.success("Chat created successfully!");
          router.push(`/chat/${newChat.id}`);
        }
      } catch (error) {
        console.error("Failed to create chat:", error);
        toast.error("Failed to create chat. Please try again.");
      }
    },
  });

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

  const isProcessing = isLoading || createChatMutation.isPending;

  return (
    <div className="rounded-xl bg-white p-2">
      <div
        {...getRootProps({
          className: cn(
            "border-dashed border-2 rounded-xl cursor-pointer bg-gray-50 py-8 flex justify-center items-center flex-col transition-all",
            {
              "opacity-50 cursor-not-allowed border-gray-300": isProcessing,
              "border-green-300 bg-green-50":
                isSuccess && !createChatMutation.isPending,
              "border-red-300 bg-red-50": isError || createChatMutation.isError,
              "hover:bg-gray-100 border-gray-300":
                !isProcessing && !isSuccess && !isError,
            },
          ),
        })}
      >
        <input {...getInputProps()} disabled={isProcessing} />

        {isSuccess && !createChatMutation.isPending ? (
          <>
            <CheckCircle className="size-10 text-green-500" />
            <p className="mt-2 text-sm text-green-600">Upload successful!</p>
          </>
        ) : isProcessing ? (
          <>
            <Loader2 className="size-10 animate-spin text-blue-500" />
            <p className="mt-2 text-sm text-slate-400">
              {isPreparing && "Preparing upload..."}
              {isUploading && "Uploading your PDF..."}
              {createChatMutation.isPending && "Creating chat..."}
            </p>
          </>
        ) : (
          <>
            <Inbox className="size-10 text-blue-500" />
            <p className="mt-2 text-sm text-slate-400">
              Drop PDF here or click to upload
            </p>
            <p className="text-xs text-slate-300">Max size: 10MB</p>
            {(isError || createChatMutation.isError) && (
              <div className="mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-500" />
                <p className="text-xs text-red-500">
                  {isError ? "Upload failed." : "Failed to create chat."} Try
                  again.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
