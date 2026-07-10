import { useState, useRef, useCallback, useEffect } from "react";

const MAX_SIZE_BYTES = 200 * 1024 * 1024;
const BURGUNDY = "#8B1538";

function UploadIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

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
      <div className="flex items-center gap-1.5 rounded bg-[#1A1A1A] px-2 py-1 cursor-pointer hover:bg-[#222]"
        onClick={() => setOpen(true)}>
        <span className="flex-1 truncate text-[10px] text-zinc-400" title={value}>{value}</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); onValue(undefined); }}
          className="shrink-0 text-zinc-600 hover:text-red-400 flex items-center p-0.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded bg-[#1A1A1A] px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
        style={{ width: 160 }}>
        <UploadIcon size={12} />
        Add Image
      </button>

      {open && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          onClick={() => setOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#1a1a1a", borderRadius: 14, padding: 24, width: 420, maxWidth: "90vw", minHeight: 340, display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

            <div className="flex items-center justify-between mb-5">
              <span className="text-sm font-semibold text-zinc-200">Add Image</span>
              <button type="button" onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 mb-5">
              {(["url", "upload"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors"
                  style={{ color: tab === t ? BURGUNDY : "#71717a" }}>
                  {t === "url" ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  ) : (
                    <UploadIcon size={14} />
                  )}
                  {t === "url" ? "URL" : "Upload"}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1">
              {tab === "url" && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">Paste media URL</label>
                  <input type="text" value={urlDraft} autoFocus
                    onChange={(e) => setUrlDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); if (e.key === "Escape") setOpen(false); }}
                    placeholder="https://example.com/image.png"
                    className="w-full rounded-lg bg-[#111] px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none"
                  />
                  <p className="text-[10px] text-zinc-600 mt-2">Supported: images, GIFs, videos (YouTube, Twitch, etc.)</p>
                </div>
              )}

              {tab === "upload" && (
                <div>
                  <div ref={dropRef}
                    onClick={() => { if (!uploading) { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*,video/*,.gif"; i.onchange = () => { const f = i.files?.[0]; if (f) handleFile(f); }; i.click(); } }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
                    className="rounded-lg p-8 text-center cursor-pointer transition-colors"
                    style={{ backgroundColor: dragOver ? "rgba(139,21,56,0.08)" : "#111" }}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="inline-block animate-spin" style={{ width: 24, height: 24, border: "2px solid currentcolor", borderTopColor: "transparent", borderRadius: "50%" }} />
                        <span className="text-xs text-zinc-400">Uploading...</span>
                      </div>
                    ) : uploadResult ? (
                      <div className="flex flex-col items-center gap-2">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        <span className="text-xs text-green-400">Upload complete</span>
                        <span className="text-[10px] text-zinc-500 truncate max-w-full">{uploadResult}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <UploadIcon size={28} />
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
                      className="w-full mt-2 px-2.5 py-1.5 rounded-lg bg-[#111] text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer flex items-center justify-center gap-1.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Paste from clipboard
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer bg-transparent">
                Cancel
              </button>
              <button type="button" onClick={handleConfirm}
                disabled={tab === "url" ? !urlDraft.trim() : !uploadResult}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ backgroundColor: BURGUNDY }}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
