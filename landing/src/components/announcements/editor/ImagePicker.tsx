import { useState, useRef, useCallback, useEffect } from "react";
import { CoolIcon } from "@/components/icons/CoolIcon";

const MAX_SIZE_BYTES = 200 * 1024 * 1024;
const BURGUNDY = "#8B1538";

interface ImagePickerProps {
  value: string | undefined;
  onValue: (url: string | undefined) => void;
  onAddAttachment?: (file: File) => Promise<string>;
  onError?: (message: string) => void;
}

export default function ImagePicker({ value, onValue, onAddAttachment, onError }: ImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"url" | "upload">("url");
  const [urlDraft, setUrlDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [canPaste, setCanPaste] = useState(false);

  useEffect(() => {
    if (open && typeof navigator !== "undefined" && navigator.clipboard) {
      setCanPaste(true);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setTab("url");
      setUrlDraft("");
      setUploadResult(null);
      setDragOver(false);
      setSizeError(false);
      setUploading(false);
    }
  }, [open]);

  const handleFile = useCallback(async (file: File) => {
    setSizeError(false);
    if (file.size > MAX_SIZE_BYTES) {
      setSizeError(true);
      return;
    }
    if (!onAddAttachment) return;
    setUploading(true);
    try {
      const url = await onAddAttachment(file);
      setUploadResult(url);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [onAddAttachment, onError]);

  const handlePaste = async () => {
    if (!navigator.clipboard) return;
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/") || type.startsWith("video/") || type === "image/gif") {
            const blob = await item.getType(type);
            const ext = type.split("/")[1] || "png";
            const file = new File([blob], `pasted.${ext}`, { type });
            handleFile(file);
            return;
          }
        }
      }
      const text = await navigator.clipboard.readText();
      if (text) setUrlDraft(text);
    } catch {
      // clipboard read denied
    }
  };

  const handleConfirm = () => {
    const url = tab === "url" ? urlDraft.trim() : uploadResult;
    if (url) {
      onValue(url);
      setOpen(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-center gap-1.5 rounded border border-zinc-800 bg-[#1A1A1A] px-2 py-1 cursor-pointer hover:border-zinc-600"
        onClick={() => setOpen(true)}>
        <span className="flex-1 truncate text-[10px] text-zinc-400" title={value}>{value}</span>
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
        className="flex items-center gap-1.5 rounded border border-dashed border-zinc-700 bg-[#1A1A1A] px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 cursor-pointer"
        style={{ width: 160 }}>
        <CoolIcon icon="Image" size={12} />
        Add Image
      </button>

      {open && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          onClick={() => setOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#1a1a1a", borderRadius: 14, border: "1px solid #333", padding: 24, width: 420, maxWidth: "90vw", minHeight: 340, display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

            <div className="flex items-center justify-between mb-5">
              <span className="text-sm font-semibold text-zinc-200">Add Image</span>
              <button type="button" onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <CoolIcon icon="Close_MD" size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 mb-5">
              {(["url", "upload"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors"
                  style={{ color: tab === t ? BURGUNDY : "#71717a" }}>
                  <CoolIcon icon={t === "url" ? "Link" : "Cloud_Upload"} size={14} />
                  {t === "url" ? "URL" : "Upload"}
                </button>
              ))}
            </div>

            {/* Content area */}
            <div className="flex-1">
              {/* URL Tab */}
              {tab === "url" && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">Paste media URL</label>
                  <div className="flex gap-2">
                    <input ref={inputRef} type="text" value={urlDraft} autoFocus
                      onChange={(e) => setUrlDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); if (e.key === "Escape") setOpen(false); }}
                      placeholder="https://example.com/image.png"
                      className="flex-1 rounded-lg border border-zinc-900 bg-black px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-700"
                    />
                    {canPaste && (
                      <button type="button" onClick={handlePaste}
                        className="shrink-0 px-2.5 rounded-lg border border-zinc-900 bg-black text-[10px] text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 cursor-pointer flex items-center gap-1">
                        <CoolIcon icon="Link" size={10} />
                        Paste
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-2">Supported: images, GIFs, videos (YouTube, Twitch, etc.)</p>
                </div>
              )}

              {/* Upload Tab */}
              {tab === "upload" && (
                <div>
                  <div ref={dropRef}
                    onClick={() => { if (!uploading) { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*,video/*,.gif"; i.onchange = () => { const f = i.files?.[0]; if (f) handleFile(f); }; i.click(); } }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
                    className="rounded-lg border border-zinc-800 p-8 text-center cursor-pointer transition-colors hover:border-zinc-600"
                    style={{ borderColor: dragOver ? BURGUNDY : undefined, backgroundColor: dragOver ? "rgba(139,21,56,0.05)" : "#111" }}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="inline-block animate-spin" style={{ width: 24, height: 24, border: "2px solid currentcolor", borderTopColor: "transparent", borderRadius: "50%" }} />
                        <span className="text-xs text-zinc-400">Uploading...</span>
                      </div>
                    ) : uploadResult ? (
                      <div className="flex flex-col items-center gap-2">
                        <CoolIcon icon="Check" size={24} />
                        <span className="text-xs text-green-400">Upload complete</span>
                        <span className="text-[10px] text-zinc-500 truncate max-w-full">{uploadResult}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <CoolIcon icon="Cloud_Upload" size={24} />
                        <span className="text-xs text-zinc-300">Drop a file here, or click to choose</span>
                        <span className="text-[10px] text-zinc-600">Max size: 200MB</span>
                      </div>
                    )}
                  </div>
                  {sizeError && (
                    <p className="text-[10px] text-red-400 mt-2">File exceeds 200MB limit.</p>
                  )}
                  {canPaste && !uploading && !uploadResult && (
                    <button type="button" onClick={handlePaste}
                      className="w-full mt-2 px-2.5 py-1.5 rounded-lg border border-zinc-900 bg-black text-[10px] text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 cursor-pointer flex items-center justify-center gap-1">
                      <CoolIcon icon="Link" size={10} />
                      Paste from clipboard
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer border-none bg-transparent">
                Cancel
              </button>
              <button type="button" onClick={handleConfirm}
                disabled={tab === "url" ? !urlDraft.trim() : !uploadResult}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white cursor-pointer border-none disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ backgroundColor: BURGUNDY }}>
                <span className="flex items-center gap-1.5">
                  <CoolIcon icon="Check" size={12} />
                  Add
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
