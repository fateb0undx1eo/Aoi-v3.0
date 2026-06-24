import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2, X } from "lucide-react";
import type { APIEmbed, APIEmbedField } from "../types";

function EmbedFieldEditor({
  fields,
  onChange,
}: {
  fields: APIEmbedField[];
  onChange: (f: APIEmbedField[]) => void;
}) {
  const addField = useCallback(() => {
    if (fields.length >= 25) return;
    onChange([...fields, { name: "", value: "", inline: false }]);
  }, [fields, onChange]);

  const removeField = useCallback(
    (i: number) => onChange(fields.filter((_, j) => j !== i)),
    [onChange],
  );

  const updateField = useCallback(
    (i: number, upd: Partial<APIEmbedField>) =>
      onChange(fields.map((f, j) => (j === i ? { ...f, ...upd } : f))),
    [fields, onChange],
  );

  const moveField = useCallback(
    (i: number, dir: "up" | "down") => {
      const t = dir === "up" ? i - 1 : i + 1;
      if (t < 0 || t >= fields.length) return;
      const next = [...fields];
      [next[i], next[t]] = [next[t]!, next[i]!];
      onChange(next);
    },
    [fields, onChange],
  );

  return (
    <div className="space-y-2">
      {fields.map((f, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-2 space-y-1.5"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-medium text-zinc-500">
              FIELD {i + 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => moveField(i, "up")}
                className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                disabled={i === fields.length - 1}
                onClick={() => moveField(i, "down")}
                className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
              <button
                type="button"
                disabled={fields.length >= 25}
                onClick={() =>
                  onChange([
                    ...fields.slice(0, i + 1),
                    { ...f },
                    ...fields.slice(i + 1),
                  ])
                }
                className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
              >
                <Copy className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => removeField(i)}
                className="text-zinc-600 hover:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={f.name}
                onChange={(e) => updateField(i, { name: e.target.value })}
                placeholder="Field name"
                maxLength={256}
                className="w-full rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
              />
            </div>
            <label className="flex items-center gap-1 text-[10px] text-zinc-500 shrink-0">
              <input
                type="checkbox"
                checked={!!f.inline}
                onChange={(e) => updateField(i, { inline: e.target.checked })}
                className="h-3 w-3 rounded border-zinc-600 bg-zinc-800"
              />
              Inline
            </label>
          </div>
          <textarea
            value={f.value}
            onChange={(e) => updateField(i, { value: e.target.value })}
            placeholder="Field value"
            rows={2}
            maxLength={1024}
            className="w-full resize-none rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addField}
        disabled={fields.length >= 25}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 py-2 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 disabled:opacity-40"
      >
        <Plus className="h-3 w-3" /> Add Field {fields.length}/25
      </button>
    </div>
  );
}

function ColorPickerPopover({
  value,
  onChange,
}: {
  value: number | null | undefined;
  onChange: (v: number | undefined) => void;
}) {
  const hex =
    typeof value === "number"
      ? `#${value.toString(16).padStart(6, "0")}`
      : "";
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node))
        setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const PRESETS = [
    0x57f287, 0xed4245, 0x5865f2, 0xfee75c, 0xf57c00, 0x9b59b6, 0xeb459e,
    0x1abc9c, 0xffffff, 0x000000, 0x95a5a6, 0x607d8b, 0x37373d,
  ];

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-8 w-full items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 text-xs text-zinc-300 hover:border-zinc-500"
      >
        <div
          className="h-5 w-5 rounded border border-zinc-600 shrink-0"
          style={{ backgroundColor: hex || "#2b2d31" }}
        />
        <span className="font-mono">{hex || "No color"}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
          <div className="mb-2 grid grid-cols-7 gap-1.5">
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                title={`#${c.toString(16).padStart(6, "0")}`}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className="h-6 w-full rounded border border-zinc-600 hover:scale-110 hover:border-white transition-transform"
                style={{
                  backgroundColor: `#${c.toString(16).padStart(6, "0")}`,
                }}
              />
            ))}
          </div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-mono">#</span>
            <input
              type="text"
              value={value !== undefined ? value.toString(16).padStart(6, "0") : ""}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                if (v.length <= 6)
                  onChange(v ? Number.parseInt(v, 16) : undefined);
              }}
              placeholder="000000"
              maxLength={6}
              className="flex-1 rounded border border-zinc-700 bg-black px-2 py-1 text-xs font-mono text-zinc-200 outline-none focus:border-zinc-500"
            />
          </div>
          {value !== undefined && (
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              Reset color
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function EmbedEditor({
  embed,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  embedIndex,
  maxEmbeds,
}: {
  embed: APIEmbed;
  onChange: (e: APIEmbed) => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  embedIndex: number;
  maxEmbeds: number;
}) {
  const [open, setOpen] = useState(true);

  const update = (upd: Partial<APIEmbed>) => {
    let next = { ...embed, ...upd };
    if (next.author && !next.author.name && !next.author.icon_url && !next.author.url) {
      next.author = undefined;
    }
    if (next.footer && !next.footer.text && !next.footer.icon_url) {
      next.footer = undefined;
    }
    onChange(next);
  };

  const colorHex =
    typeof embed.color === "number"
      ? `#${embed.color.toString(16).padStart(6, "0")}`
      : undefined;

  return (
    <details
      open={open}
      className="group/embed rounded-lg border border-zinc-700 bg-zinc-800/20 overflow-hidden shadow-sm"
      style={
        colorHex
          ? { borderLeftColor: colorHex, borderLeftWidth: 4 }
          : { borderLeftWidth: 4, borderLeftColor: "#4a4a50" }
      }
    >
      <summary
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none marker:content-none list-none"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <span className="text-xs font-medium text-zinc-400">
          Embed {embedIndex + 1}
        </span>
        <span className="truncate text-xs text-zinc-600">
          {embed.title ||
            embed.description?.slice(0, 40) ||
            `Embed ${embedIndex + 1}`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp?.();
            }}
            className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown?.();
            }}
            className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={maxEmbeds >= 10}
            onClick={(e) => {
              e.stopPropagation();
              onChange(structuredClone(embed));
            }}
            className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            className="text-zinc-600 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </summary>

      <div className="px-3 pb-3 space-y-3 border-t border-zinc-700/50 pt-3">
        {/* Author Section */}
        <details className="group/section" open={open}>
          <summary
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1.5 cursor-pointer select-none marker:content-none list-none text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5"
          >
            <ChevronDown className="h-3 w-3 text-zinc-500 group-open/section:rotate-0 -rotate-90 transition-transform" />
            Author
          </summary>
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={embed.author?.name ?? ""}
                onChange={(e) =>
                  update({
                    author: {
                      name: e.target.value,
                      icon_url: embed.author?.icon_url,
                      url: embed.author?.url,
                    },
                  })
                }
                placeholder="Author name"
                maxLength={256}
                className="flex-1 rounded border border-zinc-700 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
              />
              {embed.author?.url === undefined && (
                <button
                  type="button"
                  onClick={() =>
                    update({
                      author: {
                        name: embed.author?.name ?? "",
                        icon_url: embed.author?.icon_url,
                        url: "https://",
                      },
                    })
                  }
                  className="shrink-0 rounded bg-zinc-800 px-2 text-[10px] text-zinc-400 hover:text-zinc-200 border border-zinc-700"
                >
                  + URL
                </button>
              )}
            </div>
            {embed.author?.url !== undefined && (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={embed.author.url}
                  onChange={(e) =>
                    update({
                      author: {
                        name: embed.author?.name ?? "",
                        icon_url: embed.author?.icon_url,
                        url: e.target.value,
                      },
                    })
                  }
                  placeholder="https://..."
                  className="flex-1 rounded border border-zinc-700 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const a = embed.author;
                    if (a)
                      update({ author: { name: a.name, icon_url: a.icon_url } });
                  }}
                  className="shrink-0 px-1 text-zinc-600 hover:text-zinc-300"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <input
              type="text"
              value={embed.author?.icon_url ?? ""}
              onChange={(e) =>
                update({
                  author: {
                    name: embed.author?.name ?? "",
                    icon_url: e.target.value || undefined,
                    url: embed.author?.url,
                  },
                })
              }
              placeholder="Icon URL"
              className="w-full rounded border border-zinc-700 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
            />
          </div>
        </details>

        {/* Body Section */}
        <details className="group/section" open={open}>
          <summary
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1.5 cursor-pointer select-none marker:content-none list-none text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5"
          >
            <ChevronDown className="h-3 w-3 text-zinc-500 group-open/section:rotate-0 -rotate-90 transition-transform" />
            Body
          </summary>
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={embed.title ?? ""}
                onChange={(e) =>
                  update({ title: e.target.value || undefined })
                }
                placeholder="Embed title"
                maxLength={256}
                className="flex-1 rounded border border-zinc-700 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
              />
              {embed.url === undefined && (
                <button
                  type="button"
                  onClick={() => update({ url: "https://" })}
                  className="shrink-0 rounded bg-zinc-800 px-2 text-[10px] text-zinc-400 hover:text-zinc-200 border border-zinc-700"
                >
                  + URL
                </button>
              )}
            </div>
            {embed.url !== undefined && (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={embed.url}
                  onChange={(e) => update({ url: e.target.value || undefined })}
                  placeholder="Title URL"
                  className="flex-1 rounded border border-zinc-700 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
                />
                <button
                  type="button"
                  onClick={() => update({ url: undefined })}
                  className="shrink-0 px-1 text-zinc-600 hover:text-zinc-300"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <textarea
              value={embed.description ?? ""}
              onChange={(e) =>
                update({ description: e.target.value || undefined })
              }
              placeholder="Embed description"
              rows={4}
              maxLength={4096}
              className="w-full resize-none rounded border border-zinc-700 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
            />
            <ColorPickerPopover
              value={embed.color}
              onChange={(c) => update({ color: c })}
            />
          </div>
        </details>

        {/* Fields Section */}
        <details className="group/section" open={open}>
          <summary
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1.5 cursor-pointer select-none marker:content-none list-none text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5"
          >
            <ChevronDown className="h-3 w-3 text-zinc-500 group-open/section:rotate-0 -rotate-90 transition-transform" />
            Fields ({embed.fields?.length ?? 0}/25)
          </summary>
          <EmbedFieldEditor
            fields={embed.fields ?? []}
            onChange={(f) => update({ fields: f })}
          />
        </details>

        {/* Images Section */}
        <details className="group/section" open={open}>
          <summary
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1.5 cursor-pointer select-none marker:content-none list-none text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5"
          >
            <ChevronDown className="h-3 w-3 text-zinc-500 group-open/section:rotate-0 -rotate-90 transition-transform" />
            Images
          </summary>
          <div className="space-y-1.5">
            <div>
              <label className="mb-0.5 block text-[10px] text-zinc-500">
                Thumbnail URL
              </label>
              <input
                type="text"
                value={embed.thumbnail?.url ?? ""}
                onChange={(e) =>
                  update({
                    thumbnail: e.target.value
                      ? { url: e.target.value }
                      : undefined,
                  })
                }
                placeholder="https://..."
                className="w-full rounded border border-zinc-700 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] text-zinc-500">
                Image URL
              </label>
              <input
                type="text"
                value={embed.image?.url ?? ""}
                onChange={(e) =>
                  update({
                    image: e.target.value
                      ? { url: e.target.value }
                      : undefined,
                  })
                }
                placeholder="https://..."
                className="w-full rounded border border-zinc-700 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
              />
            </div>
          </div>
        </details>

        {/* Footer Section */}
        <details className="group/section" open={open}>
          <summary
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1.5 cursor-pointer select-none marker:content-none list-none text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5"
          >
            <ChevronDown className="h-3 w-3 text-zinc-500 group-open/section:rotate-0 -rotate-90 transition-transform" />
            Footer
          </summary>
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={embed.footer?.text ?? ""}
                onChange={(e) =>
                  update({
                    footer: {
                      text: e.target.value,
                      icon_url: embed.footer?.icon_url,
                    },
                  })
                }
                placeholder="Footer text"
                maxLength={2048}
                className="flex-1 rounded border border-zinc-700 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
              />
              <input
                type="text"
                value={embed.footer?.icon_url ?? ""}
                onChange={(e) =>
                  update({
                    footer: {
                      text: embed.footer?.text ?? "",
                      icon_url: e.target.value || undefined,
                    },
                  })
                }
                placeholder="Icon URL"
                className="flex-1 rounded border border-zinc-700 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] text-zinc-500">
                Timestamp
              </label>
              <input
                type="datetime-local"
                value={
                  embed.timestamp
                    ? embed.timestamp.slice(0, 16)
                    : ""
                }
                onChange={(e) =>
                  update({
                    timestamp: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : undefined,
                  })
                }
                className="w-full rounded border border-zinc-700 bg-black px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-500"
              />
            </div>
          </div>
        </details>
      </div>
    </details>
  );
}
