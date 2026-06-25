import type { APIAttachment } from "../types";
import { isGifVideoUrl } from "../utils/files";

export const YOUTUBE_REGEX = /^https?:\/\/(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com|youtu\.be)\/((?:shorts\/|embed\/|v\/|live\/)?([\w-]{5,}))/i;
export const VIMEO_REGEX = /^https?:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?(\d+)/i;

function getYoutubeThumbnail(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX);
  if (!match) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const v = u.searchParams.get("v");
  if (v) return `https://img.youtube.com/vi/${v}/maxresdefault.jpg`;
  if (match[2]) return `https://img.youtube.com/vi/${match[2]}/maxresdefault.jpg`;
  return null;
}

function getVimeoThumbnail(url: string): string | null {
  const match = url.match(VIMEO_REGEX);
  if (!match || !match[1]) return null;
  return `https://vumbnail.com/${match[1]}_large.jpg`;
}

export default function Gallery({
  attachments,
}: {
  attachments: APIAttachment[];
}) {
  const sized = layouts[attachments.length];
  if (!sized) {
    if (attachments.length === 0) return null;
    return (
      <div className="rounded-lg border border-zinc-800 bg-black/40 p-3 text-center text-[10px] text-zinc-500">
        Too many items ({attachments.length})
      </div>
    );
  }
  return sized({ attachments });
}

function GalleryItem({
  attachments,
  index,
  className,
  itemClassName,
}: {
  attachments: APIAttachment[];
  index: number;
  className: string;
  itemClassName?: string;
}) {
  const { content_type: contentType, url } = attachments[index]!;
  const cdnVideo = isGifVideoUrl(url);

  if (contentType?.startsWith("video/")) {
    const ytThumb = getYoutubeThumbnail(url);
    const vimeoThumb = getVimeoThumbnail(url);
    return (
      <div className={className}>
        {ytThumb ? (
          <img src={ytThumb} className={itemClassName ?? "h-full w-full object-cover"} alt="YouTube thumbnail" />
        ) : vimeoThumb ? (
          <img src={vimeoThumb} className={itemClassName ?? "h-full w-full object-cover"} alt="Vimeo thumbnail" />
        ) : (
          <video src={url} className={itemClassName ?? "h-full w-full object-cover"} controls />
        )}
      </div>
    );
  }

  if (cdnVideo) {
    return (
      <div className={`relative ${className}`}>
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

type GridLayout = React.FC<{ attachments: APIAttachment[] }>;

const layouts: Record<number, GridLayout> = {
  1: (d) => (
    <div className="w-full">
      <GalleryItem attachments={d.attachments} index={0} className="max-h-[350px] max-w-full rounded-lg" itemClassName="max-h-inherit w-full rounded-lg object-cover" />
    </div>
  ),
  2: (d) => (
    <div className="grid w-full max-h-[350px] grid-cols-2 gap-1 overflow-hidden rounded-lg">
      <GalleryItem attachments={d.attachments} index={0} className="h-full w-full rounded-l-lg" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={1} className="h-full w-full rounded-r-lg" itemClassName="h-full w-full object-cover" />
    </div>
  ),
  3: (d) => (
    <div className="flex w-full max-h-[350px] gap-1 overflow-hidden rounded-lg">
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
      <GalleryItem attachments={d.attachments} index={0} className="aspect-square h-full rounded-tl-lg" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={1} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={2} className="aspect-square h-full rounded-tr-lg" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={3} className="aspect-square h-full rounded-bl-lg" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={4} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={5} className="aspect-square h-full rounded-br-lg" itemClassName="h-full w-full object-cover" />
    </div>
  ),
  7: (d) => (
    <div className="w-full space-y-1">
      <GalleryItem attachments={d.attachments} index={0} className="w-full rounded-t-lg" itemClassName="w-full max-h-[250px] object-cover" />
      <div className="grid w-full grid-cols-3 grid-rows-2 gap-1">
        <GalleryItem attachments={d.attachments} index={1} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={2} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={3} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={4} className="aspect-square h-full rounded-bl-lg" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={5} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={6} className="aspect-square h-full rounded-br-lg" itemClassName="h-full w-full object-cover" />
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
        <GalleryItem attachments={d.attachments} index={2} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={3} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={4} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={5} className="aspect-square h-full rounded-bl-lg" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={6} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={7} className="aspect-square h-full rounded-br-lg" itemClassName="h-full w-full object-cover" />
      </div>
    </div>
  ),
  9: (d) => (
    <div className="grid w-full grid-cols-3 grid-rows-3 gap-1">
      <GalleryItem attachments={d.attachments} index={0} className="aspect-square h-full rounded-tl-lg" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={1} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={2} className="aspect-square h-full rounded-tr-lg" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={3} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={4} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={5} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={6} className="aspect-square h-full rounded-bl-lg" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={7} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
      <GalleryItem attachments={d.attachments} index={8} className="aspect-square h-full rounded-br-lg" itemClassName="h-full w-full object-cover" />
    </div>
  ),
  10: (d) => (
    <div className="w-full space-y-1">
      <GalleryItem attachments={d.attachments} index={0} className="w-full rounded-t-lg" itemClassName="w-full max-h-[250px] object-cover" />
      <div className="grid w-full grid-cols-3 grid-rows-3 gap-1">
        <GalleryItem attachments={d.attachments} index={1} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={2} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={3} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={4} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={5} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={6} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={7} className="aspect-square h-full rounded-bl-lg" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={8} className="aspect-square h-full" itemClassName="h-full w-full object-cover" />
        <GalleryItem attachments={d.attachments} index={9} className="aspect-square h-full rounded-br-lg" itemClassName="h-full w-full object-cover" />
      </div>
    </div>
  ),
};
