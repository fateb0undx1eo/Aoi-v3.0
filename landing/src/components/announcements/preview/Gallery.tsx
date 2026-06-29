import type { APIAttachment } from "../types";
import { isGifVideoUrl } from "../utils/files";

const YOUTUBE_RE = /^https?:\/\/(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com|youtu\.be)\/((?:shorts\/|embed\/|v\/|live\/)?([\w-]{5,}))/i;
const VIMEO_RE = /^https?:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?(\d+)/i;

function getYtThumb(url: string): string | null {
  const m = url.match(YOUTUBE_RE);
  if (!m) return null;
  try {
    const u = new URL(url);
    const v = u.searchParams.get("v");
    if (v) return `https://img.youtube.com/vi/${v}/maxresdefault.jpg`;
    if (m[2]) return `https://img.youtube.com/vi/${m[2]}/maxresdefault.jpg`;
  } catch {}
  return null;
}

function getVimeoThumb(url: string): string | null {
  const m = url.match(VIMEO_RE);
  if (!m || !m[1]) return null;
  return `https://vumbnail.com/${m[1]}_large.jpg`;
}

function GalleryItem({
  attachments, index, style,
}: {
  attachments: APIAttachment[];
  index: number;
  style?: React.CSSProperties;
}) {
  const att = attachments[index]!;
  const { content_type: ct, url } = att;
  const cdnVideo = isGifVideoUrl(url);

  const imgBase: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", display: "block" };

  if (ct?.startsWith("video/")) {
    const yt = getYtThumb(url);
    const vm = getVimeoThumb(url);
    return (
      <div style={style}>
        {yt ? <img src={yt} style={imgBase} alt="YouTube" />
        : vm ? <img src={vm} style={imgBase} alt="Vimeo" />
        : <video src={url} style={imgBase} controls />}
      </div>
    );
  }

  if (cdnVideo) {
    return (
      <div style={{ position: "relative", ...style }}>
        <video src={cdnVideo} style={imgBase} autoPlay muted loop />
        <span style={{ position: "absolute", left: 4, top: 4, borderRadius: 4, background: "rgba(0,0,0,0.6)", padding: "2px 6px", fontSize: 10, fontWeight: 600, color: "#fff", fontFamily: '"gg sans", sans-serif' }}>GIF</span>
      </div>
    );
  }

  return (
    <div style={style}>
      <img src={url} style={imgBase} alt="" />
    </div>
  );
}

const ROUNDED = (i: number, total: number, pos: "tl" | "tr" | "bl" | "br"): boolean => {
  const k = pos === "tl" ? (i === 0 ? 1 : 0) : pos === "tr" ? ((() => {
    if (total === 3 && i === 1) return 1;
    if (total === 5 && i === 1) return 1;
    if (total === 4 && i === 1) return 1;
    if (total === 2 && i === 1) return 1;
    return 0;
  })()) : pos === "bl" ? ((() => {
    if (total === 5 && i === 3) return 1;
    return 0;
  })()) : pos === "br" ? (i === total - 1 ? 1 : 0) : false;
  return false;
};

export default function Gallery({ attachments }: { attachments: APIAttachment[] }) {
  const n = attachments.length;
  if (n === 0) return null;

  const maxH = 300;
  const rounded = "4px";
  const gap = 4;

  const sharedItem = (i: number, addStyle?: React.CSSProperties) => (
    <GalleryItem key={i} attachments={attachments} index={i} style={{ overflow: "hidden", borderRadius: rounded, ...addStyle }} />
  );

  if (n === 1) {
    return (
      <div style={{ width: "100%", maxHeight: maxH, borderRadius: rounded, overflow: "hidden" }}>
        <GalleryItem attachments={attachments} index={0} style={{ maxHeight: maxH, width: "100%" }} />
      </div>
    );
  }

  if (n === 2) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap, maxHeight: maxH, borderRadius: rounded, overflow: "hidden" }}>
        {sharedItem(0)}
        {sharedItem(1)}
      </div>
    );
  }

  if (n === 3) {
    return (
      <div style={{ display: "flex", gap, maxHeight: maxH, borderRadius: rounded, overflow: "hidden" }}>
        <div style={{ width: "66.67%", height: maxH }}>
          {sharedItem(0, { width: "100%", height: "100%" })}
        </div>
        <div style={{ width: "33.33%", display: "flex", flexDirection: "column", gap }}>
          {sharedItem(1, { width: "100%", height: "50%" })}
          {sharedItem(2, { width: "100%", height: "50%" })}
        </div>
      </div>
    );
  }

  if (n === 4) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap, maxHeight: maxH, borderRadius: rounded, overflow: "hidden" }}>
        {sharedItem(0)}
        {sharedItem(1)}
        {sharedItem(2)}
        {sharedItem(3)}
      </div>
    );
  }

  if (n === 5) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap, borderRadius: rounded, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap }}>
          {sharedItem(0)}
          {sharedItem(1)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap }}>
          {sharedItem(2)}
          {sharedItem(3)}
          {sharedItem(4)}
        </div>
      </div>
    );
  }

  if (n === 6) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap, borderRadius: rounded, overflow: "hidden" }}>
        {attachments.map((_, i) => sharedItem(i))}
      </div>
    );
  }

  if (n === 7) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap, borderRadius: rounded, overflow: "hidden" }}>
        <div style={{ maxHeight: 250, overflow: "hidden", borderRadius: rounded }}>
          {sharedItem(0, { width: "100%", maxHeight: 250 })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap }}>
          {attachments.slice(1).map((_, i) => sharedItem(i + 1))}
        </div>
      </div>
    );
  }

  if (n === 8) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap, borderRadius: rounded, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap }}>
          {sharedItem(0)}
          {sharedItem(1)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap }}>
          {attachments.slice(2).map((_, i) => sharedItem(i + 2))}
        </div>
      </div>
    );
  }

  if (n === 9) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr 1fr", gap, borderRadius: rounded, overflow: "hidden" }}>
        {attachments.map((_, i) => sharedItem(i))}
      </div>
    );
  }

  if (n >= 10) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap, borderRadius: rounded, overflow: "hidden" }}>
        <div style={{ borderRadius: rounded, overflow: "hidden" }}>
          {sharedItem(0, { width: "100%", maxHeight: 250 })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr 1fr", gap }}>
          {attachments.slice(1, 10).map((_, i) => sharedItem(i + 1))}
        </div>
      </div>
    );
  }

  return null;
}
