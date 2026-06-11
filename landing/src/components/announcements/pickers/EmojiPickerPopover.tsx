import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { ACCENT, UNICODE_EMOJI_CATEGORIES, UNICODE_EMOJIS } from "../constants";
import type { APIEmoji, GuildEmoji } from "../types";

export default function EmojiPickerPopover({ open, onClose, onEmojiSelect, serverEmojis }: {
  open: boolean; onClose: () => void; onEmojiSelect: (emoji: APIEmoji) => void; serverEmojis: GuildEmoji[];
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("people");
  const [customTab, setCustomTab] = useState<"unicode" | "server">("unicode");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setSearch(""); return; }
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const filteredServer = serverEmojis.filter((e) => !search || e.name.toLowerCase().includes(search.toLowerCase()));

  const allUnicode = Object.values(UNICODE_EMOJIS).flat();
  const filteredUnicode = search
    ? allUnicode.filter((e) => e.includes(search))
    : UNICODE_EMOJIS[category] || [];

  const content = (
    <div ref={ref} className="fixed left-1/2 top-1/2 z-[100] w-[352px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700 bg-black shadow-2xl">
      <div className="border-b border-zinc-800 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emojis..."
            className="w-full rounded-lg border border-zinc-700 bg-black py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-500" />
        </div>
      </div>
      {!search && (
        <div className="flex border-b border-zinc-800">
          {(["unicode", "server"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setCustomTab(tab)}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${customTab === tab ? "border-b-2 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              style={customTab === tab ? { borderColor: ACCENT, color: ACCENT } : {}}>
              {tab === "unicode" ? "Unicode" : `Server (${serverEmojis.length})`}
            </button>
          ))}
        </div>
      )}
      {customTab === "unicode" && !search && (
        <div className="flex border-b border-zinc-800 px-2 py-1">
          {UNICODE_EMOJI_CATEGORIES.map((cat) => (
            <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
              className={`rounded px-1.5 py-1 text-sm transition-colors ${category === cat.id ? "bg-zinc-700" : "hover:bg-zinc-800"}`}
              title={cat.label}>{cat.icon}</button>
          ))}
        </div>
      )}
      <div className="max-h-60 overflow-y-auto p-2">
        {customTab === "unicode" ? (
          <div className="grid grid-cols-8 gap-0.5">
            {filteredUnicode.map((emo, i) => (
              <button key={`${emo}-${i}`} type="button" onClick={() => { onEmojiSelect({ name: emo }); onClose(); }}
                className="flex aspect-square items-center justify-center rounded p-0.5 text-xl hover:bg-zinc-800">{emo}</button>
            ))}
            {filteredUnicode.length === 0 && <div className="col-span-8 py-6 text-center text-xs text-zinc-500">No emojis found</div>}
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-1">
            {filteredServer.map((emo) => (
              <button key={emo.id} type="button" title={`:${emo.name}:`}
                onClick={() => { onEmojiSelect({ id: emo.id, name: emo.name, animated: emo.animated }); onClose(); }}
                className="flex items-center justify-center rounded p-1 hover:bg-zinc-800">
                <img src={emo.url} alt={emo.name} className="h-7 w-7 object-contain" />
              </button>
            ))}
            {filteredServer.length === 0 && <div className="col-span-6 py-6 text-center text-xs text-zinc-500">No server emojis</div>}
          </div>
        )}
      </div>
      {customTab === "server" && (
        <div className="border-t border-zinc-800 p-2">
          <p className="mb-1 text-[10px] text-zinc-500">Add custom emoji by ID or name:</p>
          <div className="flex gap-1">
            <input type="text" placeholder=":name:id or emoji ID"
              className="min-w-0 flex-1 rounded border border-zinc-700 bg-black px-2 py-1 text-[10px] text-zinc-200 placeholder-zinc-600 outline-none" />
            <button type="button" className="rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-700">Add</button>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(
    <div>
      <div className="fixed inset-0 z-[99] bg-black" onClick={onClose} />
      {content}
    </div>,
    document.body
  );
}
