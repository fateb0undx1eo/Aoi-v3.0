import { useCallback, useEffect, useRef, useState } from "react";
import { Video } from "lucide-react";
import { CoolIcon } from "@/components/icons/CoolIcon";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ACCENT } from "../constants";
import type { DraftFile, QueryDataMessageData } from "../types";
import { randomId } from "../utils/message";

function FileEditModal({
  open,
  onClose,
  file,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  file: DraftFile | null;
  onChange: (f: DraftFile) => void;
}) {
  const [draft, setDraft] = useState<DraftFile | null>(null);
  useEffect(() => {
    if (open && file) setDraft({ ...file });
  }, [open, file]);
  if (!open || !draft) return null;
  const isImage =
    draft.content_type?.startsWith("image/") ||
    /\.(png|jpg|jpeg|gif|webp)$/i.test(draft.name);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
    >
      <DialogContent className="max-w-md border-border/70 bg-black text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CoolIcon icon="File_Document" size={20} style={{ color: ACCENT }} />
            Edit File
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Change file name, spoiler status, or description.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-zinc-400">Filename</Label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="mt-1 w-full rounded border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 outline-none"
            />
          </div>
          {isImage && (
            <div>
              <Label className="text-xs text-zinc-400">
                Description (alt text)
              </Label>
              <input
                type="text"
                value={draft.description || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    description: e.target.value || undefined,
                  })
                }
                placeholder="Describe the image for accessibility"
                className="mt-1 w-full rounded border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={draft.spoiler}
                onChange={(e) =>
                  setDraft({ ...draft, spoiler: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800"
              />
              Mark as spoiler
            </label>
          </div>
          {draft.file && (
            <div className="rounded border border-zinc-800 bg-black p-2 text-xs text-zinc-500">
              {(draft.file.size / 1024).toFixed(1)} KB &middot;{" "}
              {draft.content_type || "unknown type"}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(draft);
              onClose();
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: ACCENT }}
          >
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const UPLOAD_MAX_SIZE = 200 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileAttachmentEditor({
  files,
  onChange,
  messageData,
  updateMessageData,
}: {
  files: DraftFile[];
  onChange: (f: DraftFile[]) => void;
  messageData?: QueryDataMessageData;
  updateMessageData?: (upd: Partial<QueryDataMessageData>) => void;
}) {
  const [editFile, setEditFile] = useState<DraftFile | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const toSafeName = (name: string) =>
    name.replace(/ /g, "_").replace(/[^a-zA-Z0-9._-]/g, "").trim() ||
    "unknown";

  const addFiles = (fileList: FileList | File[]) => {
    const newFiles: DraftFile[] = Array.from(fileList).map((f) => ({
      id: randomId(),
      file: f,
      name: f.name,
      size: f.size,
      spoiler: false,
      content_type: f.type || undefined,
    }));
    onChange([...files, ...newFiles]);
  };

  const removeFile = (id: string) => onChange(files.filter((f) => f.id !== id));

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const dtItems = e.clipboardData?.items;
      if (!dtItems) return;
      const fileItems: File[] = [];
      for (let i = 0; i < dtItems.length; i++) {
        const item = dtItems[i];
        if (!item) continue;
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) fileItems.push(f);
        }
      }
      if (fileItems.length > 0) {
        e.preventDefault();
        addFiles(fileItems);
      }
    },
    [files],
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const isImage = (f: DraftFile) =>
    f.content_type?.startsWith("image/") ||
    /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name);

  const isUploadEligible = (f: DraftFile) =>
    f.size > 0 && f.size <= UPLOAD_MAX_SIZE;

  return (
    <div className="space-y-3">
      <FileEditModal
        open={!!editFile}
        onClose={() => setEditFile(null)}
        file={editFile}
        onChange={(updated) =>
          onChange(files.map((f) => (f.id === updated.id ? updated : f)))
        }
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? "border-primary bg-primary/10"
            : "border-zinc-700 hover:border-zinc-500"
        }`}
      >
        <CoolIcon icon="Cloud_Upload" size={24} className="text-zinc-500" />
        <p className="text-xs text-zinc-400">
          Drop files here, click to browse, or paste from clipboard
        </p>
        <p className="text-[10px] text-zinc-600">
          Max 10 files &middot; {files.length} file
          {files.length !== 1 ? "s" : ""} attached
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) {
              addFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {files.map((f) => {
            const uri = `attachment://${toSafeName(f.name)}`;
            const usedInEmbed =
              messageData?.embeds?.some(
                (e) =>
                  e.author?.icon_url === uri ||
                  e.image?.url === uri ||
                  e.thumbnail?.url === uri ||
                  e.footer?.icon_url === uri,
              ) ?? false;
            return (
              <div
                key={f.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                  usedInEmbed
                    ? "border-primary/30 bg-primary/5"
                    : "border-zinc-800 bg-black"
                }`}
              >
                {isImage(f) ? (
                  <CoolIcon icon="Image_01" size={16} className="shrink-0 text-zinc-400" />
                ) : f.content_type?.startsWith("video/") ? (
                  <Video className="h-4 w-4 shrink-0 text-zinc-400" />
                ) : (
                  <CoolIcon icon="File_Document" size={16} className="shrink-0 text-zinc-400" />
                )}
                <div className="min-w-0 flex-1 truncate">
                  <span className="text-xs text-zinc-300">
                    {f.spoiler ? (
                      <>
                        <CoolIcon icon="Lock" size={10} className="mr-0.5 inline" />
                        SPOILER{" "}
                      </>
                    ) : null}
                    {f.name}
                  </span>
                  <span className="ml-1.5 text-[10px] text-zinc-600">
                    {formatFileSize(f.size)}
                  </span>
                  {isUploadEligible(f) ? (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-[9px] text-green-400" title="This file will be hosted permanently on Catbox">
                      <CoolIcon icon="Circle_Check" size={10} />Catbox
                    </span>
                  ) : (
                    <span className="ml-1" title="File exceeds 200MB upload limit, will be attached normally">
                      <CoolIcon icon="Triangle_Warning" size={10} className="inline text-yellow-500" />
                    </span>
                  )}
                  {usedInEmbed && (
                    <span className="ml-1.5 text-[9px] text-primary">
                      in use
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  title="Copy attachment URI"
                  onClick={() => {
                    navigator.clipboard.writeText(uri);
                  }}
                  className="shrink-0 text-zinc-500 hover:text-zinc-300"
                >
                  <CoolIcon icon="File_Document" size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditFile(f)}
                  className="shrink-0 text-zinc-500 hover:text-zinc-300"
                >
                  <CoolIcon icon="File_Document" size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  className="shrink-0 text-zinc-500 hover:text-red-400"
                >
                  <CoolIcon icon="Close_MD" size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { FileEditModal };
