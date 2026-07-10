import { useState, useEffect } from "react";
import { CoolIcon } from "@/components/icons/CoolIcon";

interface ImagePickerProps {
  value: string | undefined;
  onValue: (url: string | undefined) => void;
  onAddAttachment?: (file: File) => Promise<string>;
  onError?: (message: string) => void;
}

export default function ImagePicker({ value, onValue, onAddAttachment, onError }: ImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDraft("");
      setUploadPreview(null);
      setUploading(false);
    }
  }, [open]);

  const handleConfirm = () => {
    const url = uploadPreview ?? draft.trim();
    if (url) {
      onValue(url);
      setOpen(false);
    }
  };

  const handleUpload = () => {
    if (!onAddAttachment) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const url = await onAddAttachment(file);
        setUploadPreview(url);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  if (value) {
    return (
      <div className="flex items-center gap-1.5 rounded border border-zinc-800 bg-[#1A1A1A] px-2 py-1 cursor-pointer hover:border-zinc-600"
        onClick={() => setOpen(true)}>
        <span className="flex-1 truncate text-[10px] text-zinc-400" title={value}>
          {value}
        </span>
        <button type="button" onClick={(e) => { e.stopPropagation(); onValue(undefined); }}
          className="shrink-0 text-zinc-600 hover:text-red-400 flex items-center p-0.5">
          <CoolIcon icon="Close_MD" size={12} />
        </button>
      </div>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 w-full rounded border border-dashed border-zinc-700 bg-[#1A1A1A] px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 cursor-pointer">
        <CoolIcon icon="Image" size={12} />
        Add Image
      </button>

      {open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9998,
            display: "flex", alignItems: "center", justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#111", borderRadius: 14,
              border: "1px solid #333", padding: 24,
              width: 400, maxWidth: "90vw",
              boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7", marginBottom: 16 }}>
              Add Image
            </div>

            <input type="text" value={draft} autoFocus
              onChange={(e) => { setDraft(e.target.value); if (uploadPreview) setUploadPreview(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); if (e.key === "Escape") setOpen(false); }}
              placeholder="Paste image link..."
              className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
            />

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <div style={{ flex: 1, height: 1, backgroundColor: "#333" }} />
              <span style={{ fontSize: 9, color: "#52525b", textTransform: "uppercase" }}>or</span>
              <div style={{ flex: 1, height: 1, backgroundColor: "#333" }} />
            </div>

            <button type="button" onClick={handleUpload} disabled={uploading}
              className="w-full flex items-center justify-center gap-2 mt-3 rounded-lg border border-dashed border-zinc-700 bg-black px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 cursor-pointer disabled:opacity-40"
            >
              {uploading ? (
                <>
                  <span className="inline-block animate-spin" style={{ width: 12, height: 12, border: "2px solid currentcolor", borderTopColor: "transparent", borderRadius: "50%" }} />
                  Uploading...
                </>
              ) : (
                <>
                  <CoolIcon icon="Cloud_Upload" size={14} />
                  Upload from device
                </>
              )}
            </button>

            {uploadPreview && (
              <div style={{ marginTop: 10, padding: "6px 8px", borderRadius: 8, backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", fontSize: 10, color: "#4ade80", wordBreak: "break-all" }}>
                Ready: {uploadPreview.slice(0, 60)}...
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer border-none bg-transparent">
                Cancel
              </button>
              <button type="button" onClick={handleConfirm}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer border-none"
                style={{ backgroundColor: "#5865f2" }}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
