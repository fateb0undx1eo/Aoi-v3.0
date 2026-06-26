import { FileText } from "lucide-react";
import type { APIAttachment } from "../types";
import { fileSize } from "../utils/files";

function isAudioType(type: string | undefined): boolean {
  return type !== undefined && (type.startsWith("audio/") || type === "application/ogg");
}

function GenericFileCard({ attachment }: { attachment: APIAttachment }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[rgba(227,229,232,0.5)] bg-[#f2f3f5] p-3 dark:border-[rgba(67,67,73,0.5)] dark:bg-[#232428]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-zinc-200 dark:bg-zinc-800">
        <FileText className="h-5 w-5 text-[#00A8FC]" />
      </div>
      <div className="min-w-0 flex-1">
        <a href={attachment.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-[#00A8FC] hover:underline dark:text-[#00A8FC]">
          {attachment.filename}
        </a>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{fileSize(attachment.size)}</p>
      </div>
    </div>
  );
}

function VoiceMemo({ attachment }: { attachment: APIAttachment }) {
  const duration = attachment.duration_secs ?? 0;
  const fmt = (s: number) => {
    const sec = Math.round(s);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    const parts = h > 0 ? [`${h}`.padStart(2, "0")] : [];
    parts.push(`${m}`.padStart(2, "0"), `${secs}`.padStart(2, "0"));
    return parts.join(":").replace(/^0:/, "");
  };

  return (
    <div className="flex h-12 w-fit items-center gap-3 rounded-full border border-zinc-700 bg-zinc-800 px-2">
      <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#5865F2] hover:bg-[#4752C4]">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-white" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
      </div>
      <div className="flex items-center gap-1 overflow-x-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-0.5 w-0.5 rounded-full bg-zinc-500 dark:bg-zinc-400" />
        ))}
      </div>
      <p className="px-1 text-sm font-normal text-zinc-500 dark:text-zinc-400">{duration ? fmt(duration) : "--:--"}</p>
      <div className="mr-1 flex items-center gap-2">
        <div className="cursor-pointer rounded-md bg-[#E4E4E6] px-2.5 py-px text-xs font-medium text-[#2F3035] transition hover:text-black dark:bg-zinc-600 dark:text-[#C4C5C9] dark:hover:text-white">
          1X
        </div>
        <svg viewBox="0 0 24 24" className="h-6 w-6 cursor-pointer text-zinc-500 transition hover:text-zinc-300 dark:text-zinc-400 dark:hover:text-white" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.5v7a4.47 4.47 0 0 0 2.5-3.5zm2.5 0A7.5 7.5 0 0 0 14 5.5v2a5.5 5.5 0 0 1 0 9v2a7.5 7.5 0 0 0 5-3.5z" />
        </svg>
      </div>
    </div>
  );
}

export default function FileAttachmentPreview({ attachment, isVoiceMessage }: { attachment: APIAttachment; isVoiceMessage?: boolean }) {
  const isImage = attachment.content_type?.startsWith("image/");
  const isVideo = attachment.content_type?.startsWith("video/");

  if (isImage) {
    return <img src={attachment.url} alt={attachment.filename} className="max-h-80 max-w-full rounded-lg object-cover" />;
  }

  if (isAudioType(attachment.content_type) && isVoiceMessage) {
    return <VoiceMemo attachment={attachment} />;
  }

  if (isVideo) {
    return <video src={attachment.url} controls className="max-h-40 rounded" />;
  }

  return <GenericFileCard attachment={attachment} />;
}
