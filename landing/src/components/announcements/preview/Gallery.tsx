import { getImageUri, isGifVideoUrl } from "../utils/files";
import type { DraftFile } from "../types";

interface GalleryItemData {
  url: string;
  content_type?: string;
  description?: string;
}

export default function Gallery({
  items,
  files,
}: {
  items: GalleryItemData[];
  files?: DraftFile[];
}) {
  const sized = layouts[items.length];
  if (!sized) {
    if (items.length === 0) return null;
    return (
      <div className="rounded-lg border border-zinc-800 bg-black/40 p-3 text-center text-[10px] text-zinc-500">
        Too many items ({items.length})
      </div>
    );
  }
  return sized({ items, files });
}

function GalleryItem({
  item,
  className,
  itemClassName,
  files,
}: {
  item: GalleryItemData;
  className: string;
  itemClassName?: string;
  files?: DraftFile[];
}) {
  const url = getImageUri(item.url, files);
  if (!url) return null;
  const cdnVideo = isGifVideoUrl(item.url);
  if (cdnVideo) {
    return (
      <div className={className}>
        <video src={cdnVideo} className={itemClassName ?? "h-full w-full object-cover"} autoPlay muted loop />
        <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[10px] font-semibold text-white">GIF</span>
      </div>
    );
  }
  if (item.content_type?.startsWith("video/")) {
    return (
      <div className={className}>
        <video src={url} className={itemClassName ?? "h-full w-full object-cover"} controls />
      </div>
    );
  }
  return (
    <div className={className}>
      <img
        src={url}
        className={itemClassName ?? "block object-cover"}
        alt={item.description ?? ""}
      />
    </div>
  );
}

type GridLayout = React.FC<{ items: GalleryItemData[]; files?: DraftFile[] }>;

const layouts: Record<number, GridLayout> = {
  1: (d) => (
    <div className="w-full">
      <GalleryItem item={d.items[0]!} className="max-h-[350px] max-w-full rounded-lg" itemClassName="max-h-inherit w-full rounded-lg object-cover" files={d.files} />
    </div>
  ),
  2: (d) => (
    <div className="grid w-full max-h-[350px] grid-cols-2 gap-1 overflow-hidden rounded-lg">
      {[0, 1].map((i) => (
        <div key={i} className="h-full w-full"><GalleryItem item={d.items[i]!} className="h-full w-full" itemClassName="h-full w-full object-cover" files={d.files} /></div>
      ))}
    </div>
  ),
  3: (d) => (
    <div className="flex w-full max-h-[350px] gap-1 overflow-hidden rounded-lg">
      <div className="h-[350px] w-2/3"><GalleryItem item={d.items[0]!} className="h-full w-full rounded-l-lg" itemClassName="h-full w-full object-cover" files={d.files} /></div>
      <div className="grid w-1/3 grid-rows-2 gap-1">
        {[1, 2].map((i) => (
          <div key={i} className="h-full w-full"><GalleryItem item={d.items[i]!} className={`h-full w-full ${i === 2 ? "rounded-br-lg" : ""}`} itemClassName="h-full w-full object-cover" files={d.files} /></div>
        ))}
      </div>
    </div>
  ),
  4: (d) => (
    <div className="grid max-h-[350px] w-full grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-lg">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-full w-full"><GalleryItem item={d.items[i]!} className={`h-full w-full ${i === 0 ? "rounded-tl-lg" : ""}${i === 1 ? "rounded-tr-lg" : ""}${i === 2 ? "rounded-bl-lg" : ""}${i === 3 ? "rounded-br-lg" : ""}`} itemClassName="h-full w-full object-cover" files={d.files} /></div>
      ))}
    </div>
  ),
  5: (d) => (
    <div className="w-full space-y-1">
      <div className="grid w-full grid-cols-2 gap-1">
        {[0, 1].map((i) => (
          <div key={i} className="aspect-square w-full"><GalleryItem item={d.items[i]!} className={`h-full w-full ${i === 0 ? "rounded-tl-lg" : "rounded-tr-lg"}`} itemClassName="h-full w-full object-cover" files={d.files} /></div>
        ))}
      </div>
      <div className="grid w-full grid-cols-3 gap-1">
        {[2, 3, 4].map((i) => (
          <div key={i} className="aspect-square w-full"><GalleryItem item={d.items[i]!} className={`h-full w-full ${i === 4 ? "rounded-br-lg" : ""}`} itemClassName="h-full w-full object-cover" files={d.files} /></div>
        ))}
      </div>
    </div>
  ),
  6: (d) => (
    <div className="grid w-full grid-cols-3 grid-rows-2 gap-1">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="aspect-square h-full"><GalleryItem item={d.items[i]!} className={`h-full w-full ${i === 0 ? "rounded-tl-lg" : ""}${i === 2 ? "rounded-tr-lg" : ""}${i === 3 ? "rounded-bl-lg" : ""}${i === 5 ? "rounded-br-lg" : ""}`} itemClassName="h-full w-full object-cover" files={d.files} /></div>
      ))}
    </div>
  ),
  7: (d) => (
    <div className="w-full space-y-1">
      <div className="max-h-[250px] w-full"><GalleryItem item={d.items[0]!} className="w-full rounded-t-lg" itemClassName="w-full max-h-[250px] object-cover" files={d.files} /></div>
      <div className="grid w-full grid-cols-3 grid-rows-2 gap-1">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-square h-full"><GalleryItem item={d.items[i]!} className={`h-full w-full ${i === 4 ? "rounded-bl-lg" : ""}${i === 6 ? "rounded-br-lg" : ""}`} itemClassName="h-full w-full object-cover" files={d.files} /></div>
        ))}
      </div>
    </div>
  ),
  8: (d) => (
    <div className="w-full space-y-1">
      <div className="grid w-full grid-cols-2 gap-1">
        {[0, 1].map((i) => (
          <div key={i} className="aspect-square w-full"><GalleryItem item={d.items[i]!} className={`h-full w-full ${i === 0 ? "rounded-tl-lg" : "rounded-tr-lg"}`} itemClassName="h-full w-full object-cover" files={d.files} /></div>
        ))}
      </div>
      <div className="grid w-full grid-cols-3 grid-rows-2 gap-1">
        {[2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="aspect-square h-full"><GalleryItem item={d.items[i]!} className={`h-full w-full ${i === 5 ? "rounded-bl-lg" : ""}${i === 7 ? "rounded-br-lg" : ""}`} itemClassName="h-full w-full object-cover" files={d.files} /></div>
        ))}
      </div>
    </div>
  ),
  9: (d) => (
    <div className="grid w-full grid-cols-3 grid-rows-3 gap-1">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="aspect-square h-full"><GalleryItem item={d.items[i]!} className={`h-full w-full ${i === 0 ? "rounded-tl-lg" : ""}${i === 2 ? "rounded-tr-lg" : ""}${i === 6 ? "rounded-bl-lg" : ""}${i === 8 ? "rounded-br-lg" : ""}`} itemClassName="h-full w-full object-cover" files={d.files} /></div>
      ))}
    </div>
  ),
  10: (d) => (
    <div className="w-full space-y-1">
      <div className="max-h-[250px] w-full"><GalleryItem item={d.items[0]!} className="w-full rounded-t-lg" itemClassName="w-full max-h-[250px] object-cover" files={d.files} /></div>
      <div className="grid w-full grid-cols-3 grid-rows-3 gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <div key={i} className="aspect-square h-full"><GalleryItem item={d.items[i]!} className={`h-full w-full ${i === 7 ? "rounded-bl-lg" : ""}${i === 9 ? "rounded-br-lg" : ""}`} itemClassName="h-full w-full object-cover" files={d.files} /></div>
        ))}
      </div>
    </div>
  ),
};
