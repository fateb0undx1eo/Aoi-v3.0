import { useState, useRef } from "react";
import { CoolIcon } from "@/components/icons/CoolIcon";

interface ImagePickerProps {
  value: string | undefined;
  onValue: (url: string | undefined) => void;
  onAddAttachment?: (file: File) => Promise<string>;
  onError?: (message: string) => void;
}

export default function ImagePicker({ value, onValue, onAddAttachment, onError }: ImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"choose" | "url">("choose");
  const [urlDraft, setUrlDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const cancelledRef = useRef(false);

  if (value) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="flex-1 truncate text-[10px] text-zinc-400" title={value}>
          {uploading ? "Uploading..." : value}
        </span>
        {uploading && (
          <span className="inline-block animate-spin shrink-0" style={{ width: 10, height: 10, border: "2px solid currentcolor", borderTopColor: "transparent", borderRadius: "50%" }} />
        )}
        <button type="button" onClick={() => { cancelledRef.current = true; onValue(undefined); }}
          className="shrink-0 text-zinc-600 hover:text-red-400 flex items-center p-0.5">
          <CoolIcon icon="Close_MD" size={12} />
        </button>
      </div>
    );
  }

  const handleUpload = () => {
    if (!onAddAttachment) return;
    cancelledRef.current = false;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const blobUrl = URL.createObjectURL(file);
      onValue(blobUrl);
      setUploading(true);
      try {
        const url = await onAddAttachment(file);
        if (!cancelledRef.current) onValue(url);
        URL.revokeObjectURL(blobUrl);
        setOpen(false);
      } catch (err) {
        if (!cancelledRef.current) onValue(undefined);
        onError?.(err instanceof Error ? err.message : "Upload failed");
        URL.revokeObjectURL(blobUrl);
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const submitUrl = () => {
    const trimmed = urlDraft.trim();
    if (trimmed) {
      onValue(trimmed);
      setUrlDraft("");
      setOpen(false);
    }
  };

  return (
    <div className="relative inline-flex">
      <button type="button" onClick={() => { setOpen(!open); setMode("choose"); setUrlDraft(""); }}
        className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200
                   rounded border border-dashed border-zinc-700 px-2 py-1 cursor-pointer
                   whitespace-nowrap">
        <CoolIcon icon="Image" size={12} />
        Add Image
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 left-0 rounded border border-zinc-700 bg-[#1A1A1A] shadow-lg p-1 min-w-[150px]">
            {mode === "url" ? (
              <div className="flex flex-col gap-1 p-1">
                <input type="text" value={urlDraft} autoFocus
                  onChange={(e) => setUrlDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitUrl(); if (e.key === "Escape") { setOpen(false); setUrlDraft(""); } }}
                  placeholder="https://..."
                  className="w-full rounded px-1.5 py-1 text-[10px] text-zinc-200 placeholder-zinc-600 outline-none bg-zinc-800 border border-zinc-700" />
                <div className="flex gap-1 justify-end">
                  <button type="button" onClick={submitUrl}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-200 cursor-pointer">Done</button>
                  <button type="button" onClick={() => { setMode("choose"); setUrlDraft(""); }}
                    className="text-[9px] px-1.5 py-0.5 rounded text-zinc-500 cursor-pointer">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                <button type="button" onClick={handleUpload}
                  className="flex items-center gap-2 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800 rounded cursor-pointer text-left whitespace-nowrap">
                  <CoolIcon icon="Cloud_Upload" size={12} />
                  Upload from device
                </button>
                <button type="button" onClick={() => setMode("url")}
                  className="flex items-center gap-2 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800 rounded cursor-pointer text-left whitespace-nowrap">
                  <CoolIcon icon="Link" size={12} />
                  Paste URL
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
