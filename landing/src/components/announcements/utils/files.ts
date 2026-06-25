import type { DraftFile } from "../types";

export const ATTACHMENT_URI_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

export function transformFileName(name: string): string {
  return name.replace(/ /g, "_").replace(/[^a-zA-Z0-9._-]/g, "").trim() || "unknown";
}

export function resolveAttachmentUri(
  uri: string,
  files?: DraftFile[],
): DraftFile | undefined {
  if (!uri.startsWith("attachment://")) return;
  const filename = uri.replace(/^attachment:\/\//, "");
  return files?.find(
    (file) =>
      transformFileName(file.name) === filename &&
      ATTACHMENT_URI_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)),
  );
}

export function getImageUri(uri: string, files?: DraftFile[]): string {
  const trimmed = uri?.trim() ?? "";
  if (!trimmed) return "";
  const file = resolveAttachmentUri(trimmed, files);
  if (file?.url) return file.url;
  if (file?.file) return URL.createObjectURL(file.file);
  if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) return "";
  return trimmed;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isGifVideoUrl(url: string, cdn?: string): string | null {
  if (cdn && url.startsWith(`${cdn}/tenor/`) && url.endsWith(".gif")) {
    return url.replace(/\.gif$/, ".mp4");
  }
  if (url.startsWith("https://c.tenor.com/") && url.endsWith(".gif")) {
    return url.replace(/\.gif$/, ".mp4");
  }
  return null;
}
