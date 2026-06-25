import { FileText } from "lucide-react";
import type { APIAttachment } from "../types";

export default function FileAttachmentPreview({ attachment }: { attachment: APIAttachment }) {
  const isImage = attachment.content_type?.startsWith("image/");
  const isVideo = attachment.content_type?.startsWith("video/");

  if (isImage) {
    return (
      <img
        src={attachment.url}
        alt={attachment.filename}
        className="max-h-80 w-full rounded-lg object-cover"
      />
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3">
      {isVideo ? (
        <video src={attachment.url} controls className="max-h-40 rounded" />
      ) : (
        <>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-zinc-800">
            <FileText className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-200">
              {attachment.filename}
            </p>
            <p className="text-xs text-zinc-500">
              {attachment.size >= 1024 * 1024
                ? `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`
                : attachment.size >= 1024
                  ? `${(attachment.size / 1024).toFixed(1)} KB`
                  : `${attachment.size} bytes`}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
