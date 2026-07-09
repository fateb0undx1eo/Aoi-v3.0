import { CoolIcon } from "@/components/icons/CoolIcon";
import type { MediaGalleryItem, UnfurledMediaItem } from "../types";
import { Input, Toggle } from "./ui";

const MAX_GALLERY_ITEMS = 10;

export default function MediaGalleryEditor({
  items,
  onChange,
}: {
  items: MediaGalleryItem[];
  onChange: (items: MediaGalleryItem[]) => void;
}) {
  const updateItem = (ii: number, upd: { media?: UnfurledMediaItem; description?: string; spoiler?: boolean }) => {
    const next = [...items];
    next[ii] = { ...next[ii], ...upd } as MediaGalleryItem;
    onChange(next);
  };

  const removeItem = (ii: number) => {
    onChange(items.filter((_, i) => i !== ii));
  };

  const addItem = () => {
    if (items.length >= MAX_GALLERY_ITEMS) return;
    onChange([...items, { media: { url: "" } }]);
  };

  const moveItem = (ii: number, dir: "up" | "down") => {
    const next = [...items];
    const swap = dir === "up" ? ii - 1 : ii + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[ii]!, next[swap]!] = [next[swap]!, next[ii]!];
    onChange(next);
  };

  const duplicateItem = (ii: number) => {
    const next = [...items];
    next.splice(ii, 0, structuredClone(items[ii]!));
    onChange(next);
  };

  return (
    <div>
      {items.map((item, itemI) => (
        <div key={itemI}>
          <div
            className="rounded-lg border border-zinc-800"
            style={{ backgroundColor: "#151515" }}
          >
            {/* Section header with actions bar */}
            <div
              className="flex items-center justify-between px-2 py-1.5 cursor-pointer select-none"
              style={{ borderBottom: "1px solid #27272a" }}
            >
              <div className="flex items-center gap-2">
                <CoolIcon icon="Image_01" size={12} className="text-green-400" />
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Media Item {itemI + 1}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => moveItem(itemI, "up")} disabled={itemI === 0}
                  className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 flex items-center p-0 border-none bg-none cursor-pointer">
                  <CoolIcon icon="Chevron_Up" size={12} />
                </button>
                <button type="button" onClick={() => moveItem(itemI, "down")} disabled={itemI === items.length - 1}
                  className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 flex items-center p-0 border-none bg-none cursor-pointer">
                  <CoolIcon icon="Chevron_Down" size={12} />
                </button>
                {items.length < MAX_GALLERY_ITEMS && (
                  <button type="button" onClick={() => duplicateItem(itemI)}
                    className="text-zinc-600 hover:text-zinc-300 flex items-center p-0 border-none bg-none cursor-pointer">
                    <CoolIcon icon="Copy" size={12} />
                  </button>
                )}
                <button type="button" onClick={() => removeItem(itemI)}
                  className="text-zinc-600 hover:text-red-400 flex items-center p-0 border-none bg-none cursor-pointer">
                  <CoolIcon icon="Close_MD" size={12} />
                </button>
              </div>
            </div>

            {/* Section body */}
            <div className="p-2 space-y-1.5">
              <Input
                value={item.media?.url || ""}
                onChange={(url) => updateItem(itemI, { media: { url } })}
                placeholder="Image URL"
              />
              {item.media?.url ? (
                <>
                  <Input
                    value={item.description || ""}
                    onChange={(desc) => updateItem(itemI, { description: desc || undefined })}
                    placeholder="Description (alt text)"
                  />
                  <Toggle
                    checked={item.spoiler ?? false}
                    onChange={(v) => updateItem(itemI, { spoiler: v || undefined })}
                    label="Spoiler"
                  />
                </>
              ) : null}
            </div>
          </div>
          {itemI < items.length - 1 && (
            <hr className="border-t border-zinc-800 my-1" />
          )}
        </div>
      ))}
      {items.length < MAX_GALLERY_ITEMS && (
        <div className="mt-2">
          <button
            type="button"
            onClick={addItem}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
          >
            <CoolIcon icon="Add_Plus" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
