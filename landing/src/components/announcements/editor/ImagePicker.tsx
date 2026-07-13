import { useState, useRef, useCallback, useEffect } from "react";

const MAX_SIZE_BYTES = 200 * 1024 * 1024;

function UploadIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <g id="landscape-2--photos-photo-landscape-picture-photography-camera-pictures-image">
        <path id="Union" fill="#ababab" fill-rule="evenodd" d="M7 0.25c-1.11623 0 -2.20229 0.102042 -3.2333 0.216963C2.03318 0.660188 0.641268 2.05033 0.455349 3.78808 0.345581 4.81406 0.25 5.89225 0.25 7c0 1.10775 0.095581 2.18594 0.20535 3.2119 0.185919 1.7378 1.57783 3.1279 3.31135 3.3211 1.03101 0.115 2.11707 0.217 3.2333 0.217 1.11623 0 2.20229 -0.102 3.2333 -0.217 1.7335 -0.1932 3.1254 -1.5833 3.3114 -3.3211 0.1097 -1.02596 0.2053 -2.10415 0.2053 -3.2119 0 -1.10775 -0.0956 -2.18594 -0.2053 -3.21192 -0.186 -1.73775 -1.5779 -3.127891 -3.3114 -3.321117C9.20229 0.352042 8.11623 0.25 7 0.25Z" clip-rule="evenodd" stroke-width="1"></path>
        <path id="Intersect" fill="#4a4a4b" fill-rule="evenodd" d="M10.6777 13.4559c0.0309 -0.1638 -0.0497 -0.3784 -0.1392 -0.5441 -1.10162 -2.0373 -2.80435 -4.14553 -4.84752 -5.53636 -0.79186 -0.53904 -1.81234 -0.48057 -2.56766 0.04504C2.04038 8.17408 1.2444 8.76539 0.410955 9.7845c0.014386 0.14343 0.029256 0.2859 0.044395 0.4274 0.185919 1.7378 1.57783 3.1279 3.31135 3.3211 1.03101 0.115 2.11707 0.217 3.2333 0.217 1.11623 0 2.20229 -0.102 3.2333 -0.217 0.1509 -0.0168 0.2992 -0.0427 0.4444 -0.0771Z" clip-rule="evenodd" stroke-width="1"></path>
        <path id="Vector" fill="#4a4a4b" d="M9.03599 6.74523c1.14021 0 1.78161 -0.64138 1.78161 -1.7816 0 -1.14022 -0.6414 -1.78159 -1.78161 -1.78159 -1.14022 0 -1.7816 0.64137 -1.7816 1.78159s0.64138 1.7816 1.7816 1.7816Z" stroke-width="1"></path>
      </g>
    </svg>
  );
}

interface ImagePickerProps {
  value: string | undefined;
  onValue: (url: string | undefined) => void;
  onAddAttachment?: (file: File) => Promise<string>;
  onError?: (message: string) => void;
  className?: string;
}

export default function ImagePicker({ value, onValue, onAddAttachment, onError, className }: ImagePickerProps) {
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
    const fileName = value.split("/").pop()?.split("?")[0] || value;
    return (
      <button type="button" onClick={() => setOpen(true)}
        className={"flex items-center justify-center gap-1 rounded text-[10px] text-zinc-400 hover:text-zinc-300 cursor-pointer px-2.5 py-[6px] w-[100px] bg-[#1E1E1F] " + (className ?? "")}>
        <UploadIcon size={12} />
        <span className="truncate max-w-[55px]" title={value}>{fileName}</span>
        <span onClick={(e) => { e.stopPropagation(); onValue(undefined); }}
          className="shrink-0 text-zinc-600 hover:text-red-400 flex items-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </span>
      </button>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={"flex items-center justify-center gap-1 rounded text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer px-2.5 py-[6px] w-[100px] bg-[#1E1E1F] " + (className ?? "")}>
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
                  style={{ color: tab === t ? "#a1a1aa" : "#71717a" }}>
                  {t === "url" ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="-0.5 -0.5 15 15" style={{ width: 14, height: 14, display: "block", overflow: "visible" }}>
                      <g id="link-chain--create-hyperlink-link-make-unlink-connection-chain">
                        <path id="Union" fill="currentColor" fill-rule="evenodd" d="m7.671 2.743 -0.964 0.964a1 1 0 0 1 -1.414 -1.414l0.964 -0.965a4.536 4.536 0 0 1 6.415 6.415l-0.965 0.964a1 1 0 1 1 -1.414 -1.414l0.964 -0.965a2.536 2.536 0 0 0 -3.585 -3.585Zm-3.964 2.55a1 1 0 0 1 0 1.414l-0.964 0.965a2.536 2.536 0 0 0 3.585 3.585l0.965 -0.964a1 1 0 0 1 1.414 1.414l-0.964 0.964a4.536 4.536 0 0 1 -6.415 -6.414l0.965 -0.964a1 1 0 0 1 1.414 0Zm5.5 0.914a1 1 0 0 0 -1.414 -1.414l-3 3a1 1 0 0 0 1.414 1.414l3 -3Z" clip-rule="evenodd" stroke-width="1"></path>
                      </g>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="-0.5 -0.5 15 15" style={{ width: 14, height: 14, display: "block", overflow: "visible" }}>
                      <g id="local-storage-folder">
                        <path id="Union" fill="#4a4a4b" fill-rule="evenodd" d="M5.635 10.582a0.5 0.5 0 0 1 0.47 -0.332h1.79a0.5 0.5 0 0 1 0.47 0.332l0.687 1.918H10a0.75 0.75 0 0 1 0 1.5H4a0.75 0.75 0 0 1 0 -1.5h0.948l0.686 -1.918Z" clip-rule="evenodd" stroke-width="1"></path>
                        <path id="vector" fill="#4a4a4b" d="M14 4.565c0 0.24 -0.194 0.435 -0.434 0.435h-4.77a0.435 0.435 0 0 1 -0.435 -0.435V0.435A0.435 0.435 0 0 1 8.796 0H10.4a0.435 0.435 0 0 1 0.435 0.33l0.122 0.54h2.608a0.435 0.435 0 0 1 0.435 0.434v3.261Z" stroke-width="1"></path>
                        <path id="Subtract" fill="#ababab" fill-rule="evenodd" d="M7.111 0.5H1.457C0.652 0.5 0 1.152 0 1.957v7.586C0 10.348 0.652 11 1.457 11h11.086C13.348 11 14 10.348 14 9.543v-3.35a1.687 1.687 0 0 1 -0.434 0.057h-4.77a1.685 1.685 0 0 1 -1.685 -1.685V0.5Z" clip-rule="evenodd" stroke-width="1"></path>
                      </g>
                    </svg>
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
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 mt-5">
              {canPaste && !uploading && !uploadResult && !urlDraft.trim() && (
                <button type="button" onClick={handlePaste}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] text-white cursor-pointer"
                  style={{ backgroundColor: "#0C0C0C" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14" style={{ width: 10, height: 10, display: "block" }}>
                    <g id="blank-notepad--content-notes-book-notepad-notebook">
                      <path id="Rectangle 481" fill="#ababab" d="M0 3.5A1.5 1.5 0 0 1 1.5 2h11A1.5 1.5 0 0 1 14 3.5v9a1.5 1.5 0 0 1 -1.5 1.5h-11A1.5 1.5 0 0 1 0 12.5v-9Z" stroke-width="1"></path>
                      <path id="Union" fill="#4a4a4b" fill-rule="evenodd" d="M3.5 0a1 1 0 0 1 1 1v2a1 1 0 0 1 -2 0V1a1 1 0 0 1 1 -1ZM7 0a1 1 0 0 1 1 1v2a1 1 0 0 1 -2 0V1a1 1 0 0 1 1 -1Zm4.5 1a1 1 0 1 0 -2 0v2a1 1 0 0 0 2 0V1Z" clip-rule="evenodd" stroke-width="1"></path>
                    </g>
                  </svg>
                  Paste
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button type="button" onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer bg-transparent">
                  Cancel
                </button>
                <button type="button" onClick={handleConfirm}
                  disabled={tab === "url" ? !urlDraft.trim() : !uploadResult}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#1E1E1F" }}>
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
