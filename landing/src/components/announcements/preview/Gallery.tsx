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
  attachments, index, className, itemClassName,
}: {
  attachments: APIAttachment[];
  index: number;
  className?: string;
  itemClassName?: string;
}) {
  const att = attachments[index]!;
  const { content_type: ct, url } = att;
  const cdnVideo = isGifVideoUrl(url);

  if (ct?.startsWith("video/")) {
    const yt = getYtThumb(url);
    const vm = getVimeoThumb(url);
    return (
      <div className={className}>
        {yt ? <img src={yt} className={itemClassName ?? "h-full w-full object-cover"} alt="YouTube" />
        : vm ? <img src={vm} className={itemClassName ?? "h-full w-full object-cover"} alt="Vimeo" />
        : <video src={url} className={itemClassName ?? "h-full w-full object-cover"} controls />}
      </div>
    );
  }

  if (cdnVideo) {
    return (
      <div className={`relative ${className ?? ""}`}>
        <video src={cdnVideo} className={itemClassName ?? "h-full w-full object-cover"} autoPlay muted loop />
        <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[10px] font-semibold text-white">GIF</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <img src={url} className={itemClassName ?? "block object-cover"} alt="" />
    </div>
  );
}

type GridFn = React.FC<{ attachments: APIAttachment[] }>;

const LAYOUTS: Record<number, GridFn> = {
  1: (d) => (
    <div className="w-full">
      <GalleryItem attachments={d.attachments} index={0} className="max-h-[350px] max-w-full rounded-lg" itemClassName="max-h-inherit w-full rounded-lg object-cover" />
    </div>
  ),
  2: (d) => (
    <div className="grid max-h-[350px] w-full grid-cols-2 gap-1 overflow-hidden rounded-lg">
      <GalleryItem attachments={d.attachments} index={0} className="h-full w-full rounded-l-lg" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={1} className="h-full w-full rounded-r-lg" itemClassName="h-full w-full object-cover" />
    </div>
  ),
  3: (d) => (
    <div className="flex max-h-[350px] w-full gap-1 overflow-hidden rounded-lg">
      <div className="h-[350px] w-2/3">
        <GalleryItem attachments={d.attachments} index={0} className="h-full w-full rounded-l-lg" itemClassName="h-full w-full object-cover" />
      </div>
      <div className="grid w-1/3 grid-rows-2 gap-1">
        <GalleryItem attachments={d.attachments} index={1} className="h-full w-full rounded-tr-lg" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={2} className="h-full w-full rounded-br-lg" itemClassName="h-full w-full object-cover" />
      </div>
    </div>
  ),
  4: (d) => (
    <div className="grid max-h-[350px] w-full grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-lg">
      <GalleryItem attachments={d.attachments} index={0} className="h-full w-full rounded-tl-lg" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={1} className="h-full w-full rounded-tr-lg" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={2} className="h-full w-full rounded-bl-lg" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={3} className="h-full w-full rounded-br-lg" itemClassName="h-full w-full object-cover" />
    </div>
  ),
  5: (d) => (
    <div className="w-full space-y-1">
      <div className="grid w-full grid-cols-2 gap-1">
        <GalleryItem attachments={d.attachments} index={0} className="aspect-square w-full rounded-tl-lg" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={1} className="aspect-square w-full rounded-tr-lg" itemClassName="h-full w-full object-cover" />
      </div>
      <div className="grid w-full grid-cols-3 gap-1">
        <GalleryItem attachments={d.attachments} index={2} className="aspect-square w-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={3} className="aspect-square w-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={4} className="aspect-square w-full rounded-br-lg" itemClassName="h-full w-full object-cover" />
      </div>
    </div>
  ),
  6: (d) => (
    <div className="grid w-full grid-cols-3 grid-rows-2 gap-1">
      {d.attachments.map((_, i) => (
        <GalleryItem key={i} attachments={d.attachments} index={i}
          className={`aspect-square h-full ${i === 0 ? "rounded-tl-lg" : ""}${i === 2 ? "rounded-tr-lg" : ""}${i === 3 ? "rounded-bl-lg" : ""}${i === 5 ? "rounded-br-lg" : ""}`}
          itemClassName="h-full w-full object-cover" />
      ))}
    </div>
  ),
  7: (d) => (
    <div className="w-full space-y-1">
      <GalleryItem attachments={d.attachments} index={0} className="w-full rounded-t-lg" itemClassName="w-full max-h-[250px] object-cover" />
      <div className="grid w-full grid-cols-3 grid-rows-2 gap-1">
        {d.attachments.slice(1).map((_, i) => (
          <GalleryItem key={i} attachments={d.attachments} index={i + 1}
            className={`aspect-square h-full ${i === 3 ? "rounded-bl-lg" : ""}${i === 5 ? "rounded-br-lg" : ""}`}
            itemClassName="h-full w-full object-cover" />
        ))}
      </div>
    </div>
  ),
  8: (d) => (
    <div className="w-full space-y-1">
      <div className="grid w-full grid-cols-2 gap-1">
        <GalleryItem attachments={d.attachments} index={0} className="aspect-square w-full rounded-tl-lg" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={1} className="aspect-square w-full rounded-tr-lg" itemClassName="h-full w-full object-cover" />
      </div>
      <div className="grid w-full grid-cols-3 grid-rows-2 gap-1">
        {d.attachments.slice(2).map((_, i) => (
          <GalleryItem key={i} attachments={d.attachments} index={i + 2}
            className={`aspect-square h-full ${i === 3 ? "rounded-bl-lg" : ""}${i === 5 ? "rounded-br-lg" : ""}`}
            itemClassName="h-full w-full object-cover" />
        ))}
      </div>
    </div>
  ),
  9: (d) => (
    <div className="grid w-full grid-cols-3 grid-rows-3 gap-1">
      {d.attachments.map((_, i) => (
        <GalleryItem key={i} attachments={d.attachments} index={i}
          className={`aspect-square h-full ${i === 0 ? "rounded-tl-lg" : ""}${i === 2 ? "rounded-tr-lg" : ""}${i === 6 ? "rounded-bl-lg" : ""}${i === 8 ? "rounded-br-lg" : ""}`}
          itemClassName="h-full w-full object-cover" />
      ))}
    </div>
  ),
  10: (d) => (
    <div className="w-full space-y-1">
      <GalleryItem attachments={d.attachments} index={0} className="w-full rounded-t-lg" itemClassName="w-full max-h-[250px] object-cover" />
      <div className="grid w-full grid-cols-3 grid-rows-3 gap-1">
        {d.attachments.slice(1).map((_, i) => (
          <GalleryItem key={i} attachments={d.attachments} index={i + 1}
            className={`aspect-square h-full ${i === 6 ? "rounded-bl-lg" : ""}${i === 8 ? "rounded-br-lg" : ""}`}
            itemClassName="h-full w-full object-cover" />
        ))}
      </div>
    </div>
  ),
};

export default function Gallery({ attachments }: { attachments: APIAttachment[] }) {
  const layout = LAYOUTS[attachments.length];
  if (!layout) {
    if (attachments.length === 0) return null;
    return <div className="rounded-lg border border-zinc-700 bg-black/40 p-3 text-center text-[10px] text-zinc-500">Too many items ({attachments.length})</div>;
  }
  const GalleryLayout = layout;
  return <GalleryLayout attachments={attachments} />;
}
