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
  const loadIntoPineconeMutation = api.pdfFile.loadIntoPinecone.useMutation();

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

          // Step 2: Process the PDF
          try {
            console.log("🔄 Processing PDF into vector embeddings...");
            const result = await loadIntoPineconeMutation.mutateAsync({
              fileKey,
            });

            console.log("✅ PDF processing successful:", result);
            toast.success(`PDF processed! Found ${result.documentCount} pages`);

            router.push(`/chat/${newChat.id}`);
          } catch (pdfError) {
            console.error("❌ PDF processing failed:", pdfError);
            toast.error("PDF processing failed, but chat was created");
            // Still could redirect to chat even if PDF processing fails
            // router.push(`/chat/${newChat.id}`);
          }
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

  const isProcessing =
    isLoading ||
    createChatMutation.isPending ||
    loadIntoPineconeMutation.isPending;
  const hasError =
    isError || createChatMutation.isError || loadIntoPineconeMutation.isError;

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
              {loadIntoPineconeMutation.isPending &&
                "Processing PDF content..."}
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
                  {loadIntoPineconeMutation.isError &&
                    "PDF processing failed."}{" "}
                  Try again.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
