import { FileText } from "lucide-react";
import type { DraftFile } from "../types";
import { fileSize } from "../utils/files";

export default function FileAttachmentPreview({ file }: { file: DraftFile }) {
  const src = file.file ? URL.createObjectURL(file.file) : file.url;
  const isImage = file.content_type?.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name);
  const isVideo = file.content_type?.startsWith("video/");

  if (isImage && !file.spoiler) {
    return (
      <img
        src={src}
        alt={file.description || file.name}
        className="max-h-80 w-full rounded-lg object-cover"
      />
    );
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${
        file.spoiler ? "border-zinc-700 bg-black/40" : "border-zinc-700/50 bg-zinc-800/30"
      }`}
    >
      {isVideo ? (
        <video src={src} controls className="max-h-40 rounded" />
      ) : (
        <>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-zinc-800">
            <FileText className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-200">
              {file.spoiler && <span className="text-zinc-500">SPOILER </span>}
              {file.name}
            </p>
            <p className="text-xs text-zinc-500">{fileSize(file.size)}</p>
          </div>
        </>
      )}
    </div>
  );
}
