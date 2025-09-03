"use client";

import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import { useFileUpload } from "@/hooks/use-file-upload";
import { useDropzone } from "react-dropzone";

import { toast } from "sonner";
import { Inbox, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export function FileUpload() {
  const router = useRouter();

  const embedMutation = api.pdfFile.embed.useMutation({
    onSuccess: (result, { chatId }) => {
      toast.success(
        `Ready to chat! Created ${result.embeddingCount} embeddings`,
      );
      router.push(`/chat/${chatId}`);
    },
    onError: (_, { chatId }) => {
      toast.error("Embedding generation failed, but chat was created");
      router.push(`/chat/${chatId}`);
    },
  });

  const createChatMutation = api.chat.create.useMutation({
    onSuccess: async (newChat) => {
      toast.success("Chat created successfully!");
      embedMutation.mutate({
        chatId: newChat.id,
        content: newChat.content,
      });
    },
    onError: () => {
      toast.error("Failed to create chat. Please try again.");
    },
  });

  const {
    uploadFile,
    isLoading,
    isPreparing,
    isUploading,
    isSuccess,
    isError,
  } = useFileUpload({
    onSuccess: (fileKey, fileName) =>
      createChatMutation.mutate({ fileKey, fileName }),
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

  const isProcessing =
    isLoading || createChatMutation.isPending || embedMutation.isPending;
  const hasError =
    isError || createChatMutation.isError || embedMutation.isError;

  return (
    <div className="rounded-xl bg-white p-2">
      <div
        {...getRootProps({
          className: cn(
            "border-dashed border-2 rounded-xl cursor-pointer bg-gray-50 py-8 flex justify-center items-center flex-col transition-all",
            {
              "opacity-50 cursor-not-allowed border-gray-300": isProcessing,
              "border-green-300 bg-green-50": isSuccess && !isProcessing,
              "border-red-300 bg-red-50": hasError,
              "hover:bg-gray-100 border-gray-300":
                !isProcessing && !isSuccess && !hasError,
            },
          ),
        })}
      >
        <input {...getInputProps()} disabled={isProcessing} />

        {isSuccess && !isProcessing ? (
          <>
            <CheckCircle className="h-10 w-10 text-green-500" />
            <p className="mt-2 text-sm text-green-600">Processing complete!</p>
          </>
        ) : isProcessing ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <p className="mt-2 text-sm text-slate-400">
              {isPreparing && "Preparing upload..."}
              {isUploading && "Uploading your PDF..."}
              {createChatMutation.isPending && "Creating chat..."}
              {embedMutation.isPending && "Processing PDF for search..."}
            </p>
          </>
        ) : (
          <>
            <Inbox className="h-10 w-10 text-blue-500" />
            <p className="mt-2 text-sm text-slate-400">
              Drop PDF here or click to upload
            </p>
            <p className="text-xs text-slate-300">Max size: 10MB</p>
            {hasError && (
              <div className="mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-500" />
                <p className="text-xs text-red-500">
                  {isError && "Upload failed."}
                  {createChatMutation.isError && "Chat creation failed."}
                  {embedMutation.isError && "PDF processing failed."} Try again.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
