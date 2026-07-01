import type { APIAttachment } from "../types";
import type { SetImageModalData } from "../types";
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
  attachments,
  index,
  className,
  itemClassName,
  setImageModalData,
  cdn,
}: {
  attachments: APIAttachment[];
  index: number;
  className?: string;
  itemClassName?: string;
  setImageModalData?: SetImageModalData;
  cdn?: string;
}) {
  const att = attachments[index]!;
  const { content_type: ct, url } = att;
  const cdnVideo = isGifVideoUrl(url, cdn);

  const yt = ct?.startsWith("video/") ? getYtThumb(url) : null;
  const vm = ct?.startsWith("video/") ? getVimeoThumb(url) : null;

  const handleClick = () => {
    if (setImageModalData) {
      setImageModalData({
        images: attachments.map((a) => ({ url: a.url, alt: a.description })),
        startIndex: index,
      });
    }
  };

  if (ct?.startsWith("video/")) {
    return (
      <div className={className}>
        {yt ? (
          <img src={yt} className={itemClassName ?? "w-full h-full object-cover"} alt="YouTube" />
        ) : vm ? (
          <img src={vm} className={itemClassName ?? "w-full h-full object-cover"} alt="Vimeo" />
        ) : (
          <video src={url} className={itemClassName ?? "w-full h-full object-cover"} controls />
        )}
      </div>
    );
  }

  if (!url) return null;

  if (cdnVideo) {
    return (
      <button type="button" className={`relative group/gallery-item ${className ?? ""}`} onClick={handleClick}>
        <video
          src={cdnVideo}
          className={itemClassName ?? "w-full h-full object-cover"}
          autoPlay
          muted
          loop
        />
        <span className="absolute top-1 left-1 rounded px-1 py-0.5 text-sm text-white bg-black/60 font-semibold group-hover/gallery-item:hidden">
          GIF
        </span>
      </button>
    );
  }

  return (
    <button type="button" className={className ?? "block"} onClick={handleClick}>
      <img src={url} className={itemClassName ?? "block object-cover w-full h-full"} alt="" />
    </button>
  );
}

export default function Gallery({
  attachments,
  setImageModalData,
  cdn,
}: {
  attachments: APIAttachment[];
  setImageModalData?: SetImageModalData;
  cdn?: string;
}) {
  const n = attachments.length;
  if (n === 0) return null;

  const sharedItem = (i: number, addCn?: string) => (
    <GalleryItem
      key={i}
      attachments={attachments}
      index={i}
      className={`overflow-hidden rounded ${addCn ?? ""}`}
      setImageModalData={setImageModalData}
      cdn={cdn}
    />
  );

  if (n === 1) {
    return (
      <div className="w-full max-h-[300px] rounded overflow-hidden">
        <GalleryItem
          attachments={attachments}
          index={0}
          className="max-h-[300px] w-full"
          itemClassName="w-full max-h-[300px] object-cover"
          setImageModalData={setImageModalData}
          cdn={cdn}
        />
      </div>
    );
  }

  if (n === 2) {
    return (
      <div className="grid grid-cols-2 gap-1 max-h-[300px] rounded overflow-hidden">
        {sharedItem(0)}
        {sharedItem(1)}
      </div>
    );
  }

  if (n === 3) {
    return (
      <div className="flex gap-1 max-h-[300px] rounded overflow-hidden">
        <div className="w-2/3 h-[300px]">
          <GalleryItem
            attachments={attachments}
            index={0}
            className="w-full h-full"
            itemClassName="w-full h-full object-cover"
            setImageModalData={setImageModalData}
            cdn={cdn}
          />
        </div>
        <div className="w-1/3 flex flex-col gap-1">
          {sharedItem(1, "h-1/2")}
          {sharedItem(2, "h-1/2")}
        </div>
      </div>
    );
  }

  if (n === 4) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-1 max-h-[300px] rounded overflow-hidden">
        {sharedItem(0)}
        {sharedItem(1)}
        {sharedItem(2)}
        {sharedItem(3)}
      </div>
    );
  }

  if (n === 5) {
    return (
      <div className="flex flex-col gap-1 rounded overflow-hidden">
        <div className="grid grid-cols-2 gap-1">
          {sharedItem(0)}
          {sharedItem(1)}
        </div>
        <div className="grid grid-cols-3 gap-1">
          {sharedItem(2)}
          {sharedItem(3)}
          {sharedItem(4)}
        </div>
      </div>
    );
  }

  if (n === 6) {
    return (
      <div className="grid grid-cols-3 grid-rows-2 gap-1 rounded overflow-hidden">
        {attachments.map((_, i) => sharedItem(i))}
      </div>
    );
  }

  if (n === 7) {
    return (
      <div className="flex flex-col gap-1 rounded overflow-hidden">
        <div className="max-h-[250px] overflow-hidden rounded">
          <GalleryItem
            attachments={attachments}
            index={0}
            className="w-full max-h-[250px]"
            itemClassName="w-full max-h-[250px] object-cover"
            setImageModalData={setImageModalData}
            cdn={cdn}
          />
        </div>
        <div className="grid grid-cols-3 grid-rows-2 gap-1">
          {attachments.slice(1).map((_, i) => sharedItem(i + 1))}
        </div>
      </div>
    );
  }

  if (n === 8) {
    return (
      <div className="flex flex-col gap-1 rounded overflow-hidden">
        <div className="grid grid-cols-2 gap-1">
          {sharedItem(0)}
          {sharedItem(1)}
        </div>
        <div className="grid grid-cols-3 grid-rows-2 gap-1">
          {attachments.slice(2).map((_, i) => sharedItem(i + 2))}
        </div>
      </div>
    );
  }

  if (n === 9) {
    return (
      <div className="grid grid-cols-3 grid-rows-3 gap-1 rounded overflow-hidden">
        {attachments.map((_, i) => sharedItem(i))}
      </div>
    );
  }

  if (n >= 10) {
    return (
      <div className="flex flex-col gap-1 rounded overflow-hidden">
        <div className="rounded overflow-hidden">
          <GalleryItem
            attachments={attachments}
            index={0}
            className="w-full max-h-[250px]"
            itemClassName="w-full max-h-[250px] object-cover"
            setImageModalData={setImageModalData}
            cdn={cdn}
          />
        </div>
        <div className="grid grid-cols-3 grid-rows-3 gap-1">
          {attachments.slice(1, 10).map((_, i) => sharedItem(i + 1))}
        </div>
      </div>
    );
  }

  return null;
}
