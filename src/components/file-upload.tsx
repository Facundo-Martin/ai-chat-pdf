"use client";

import { Inbox } from "lucide-react";
import { useDropzone } from "react-dropzone";

export const FileUpload = () => {
  const { getRootProps, getInputProps } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      console.log(acceptedFiles);
    },
  });

  return (
    <div className="rounded-xl bg-white p-2">
      <div
        {...getRootProps({
          className:
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-gray-50 py-8",
        })}
      >
        <input {...getInputProps()} />
        <Inbox className="size-10 text-blue-500" />
        <p className="mt-2 text-sm text-slate-400">Drop PDF Here</p>
      </div>
    </div>
  );
};
