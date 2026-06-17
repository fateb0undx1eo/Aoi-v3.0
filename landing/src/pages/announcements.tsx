import { nanoid } from "nanoid";
import { formatDate } from "@/lib/date";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Megaphone, Plus, Copy, Trash2, GripVertical, ChevronDown, ChevronUp,
  Send, Save, X, Palette, Eye,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { SiteNavbar } from "@/components/site-navbar";

type GuildChannel = {
  id: string;
  name: string;
  type: number;
};

type AnnouncementComponent = {
  type: "button" | "select";
  style: number;
  label: string;
  custom_id: string;
  url: string;
  emoji: { name: string; id: string; animated: boolean } | null;
  disabled: boolean;
  options: { label: string; value: string; description: string; emoji: { name: string; id: string; animated: boolean } | null }[];
  placeholder: string;
  min_values: number;
  max_values: number;
};

type AnnouncementField = {
  name: string;
  value: string;
  inline: boolean;
};

type AnnouncementEmbed = {
  title: string;
  description: string;
  url: string;
  color: string;
  author_name: string;
  author_icon_url: string;
  author_url: string;
  fields: AnnouncementField[];
  footer_text: string;
  footer_icon_url: string;
  image_url: string;
  thumbnail_url: string;
  timestamp: string;
};

type AnnouncementEntry = {
  id: string;
  content: string;
  embed: AnnouncementEmbed;
  components: AnnouncementComponent[][];
  edit_existing: boolean;
  message_link: string;
};

type AnnouncementForm = {
  channel_ids: string[];
  entries: AnnouncementEntry[];
};

type AnnouncementPreset = {
  id: string;
  name: string;
  kind: "draft" | "template";
  form: AnnouncementForm;
};

type SaveState = "idle" | "success" | "error" | "info" | "sending";

type StatusMessage = {
  state: SaveState;
  text: string;
};

const EMPTY_EMBED: AnnouncementEmbed = {
  title: "",
  description: "",
  url: "",
  color: "#57f287",
  author_name: "",
  author_icon_url: "",
  author_url: "",
  fields: [],
  footer_text: "",
  footer_icon_url: "",
  image_url: "",
  thumbnail_url: "",
  timestamp: "",
};

const DISCORD_MESSAGE_LINK_RE = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/channels\/\d+\/\d+\/\d+$/;

const DEFAULT_COMPONENTS: AnnouncementComponent[][] = [];

function createAnnouncementEntry(): AnnouncementEntry {
  return {
    id: `entry-${nanoid(8)}`,
    content: "",
    embed: { ...EMPTY_EMBED, fields: [] },
    components: [],
    edit_existing: false,
    message_link: "",
  };
}

const DEFAULT_ANNOUNCEMENT_FORM: AnnouncementForm = {
  channel_ids: [],
  entries: [createAnnouncementEntry()],
};

const ACCENT_COLOR = "#06b6d4";
const EMBED_BG = "#2b2d31";
const MESSAGE_BG = "#313338";
const CHANNEL_TEXT_COLOR = "#dbdee1";

const BUTTON_STYLES: Record<number, { label: string; color: string; bg: string; border: string }> = {
  1: { label: "Primary", color: "#fff", bg: "#5865f2", border: "#5865f2" },
  2: { label: "Secondary", color: "#dbdee1", bg: "#4e5058", border: "#4e5058" },
  3: { label: "Success", color: "#fff", bg: "#248046", border: "#248046" },
  4: { label: "Danger", color: "#fff", bg: "#da373c", border: "#da373c" },
  5: { label: "Link", color: "#00a8fc", bg: "transparent", border: "#00a8fc" },
};

function rgbToInt(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return Number.parseInt((h[0] ?? "") + (h[0] ?? "") + (h[1] ?? "") + (h[1] ?? "") + (h[2] ?? "") + (h[2] ?? ""), 16);
  }
  return Number.parseInt(h, 16) || 0;
}

function intToRgb(num: number): string {
  return `#${num.toString(16).padStart(6, "0")}`;
}

const EMBED_PRESETS = [
  { label: "Green", value: "#57f287" },
  { label: "Red", value: "#ed4245" },
  { label: "Blue", value: "#5865f2" },
  { label: "Yellow", value: "#fee75c" },
  { label: "Orange", value: "#f57c00" },
  { label: "Purple", value: "#9b59b6" },
  { label: "Pink", value: "#eb459e" },
  { label: "Teal", value: "#1abc9c" },
  { label: "White", value: "#ffffff" },
  { label: "Black", value: "#000000" },
];

function renderDiscordText(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /<a?:([a-zA-Z0-9_]+):(\d+)>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  while ((match = pattern.exec(text)) !== null) {
    const [raw, name] = match;
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={`emoji-${match.index}`} className="inline-flex items-center gap-0.5 rounded bg-white/5 px-1 text-xs text-zinc-300">
        :{name}:
      </span>
    );
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

function formatTimestamp(iso: string): string {
  if (!iso) return "";
  try {
    return formatDate(iso, "MMM d, yyyy, h:mm a");
  } catch {
    return iso;
  }
}

function DiscordMessagePreview({ entry, channelName }: { entry: AnnouncementEntry; channelName?: string }) {
  const hasContent = entry.content.trim().length > 0;
  const hasEmbed = entry.embed.title || entry.embed.description || entry.embed.fields.length > 0 || entry.embed.image_url || entry.embed.thumbnail_url || entry.embed.footer_text;
  const hasComponents = entry.components.length > 0 && entry.components.some((row) => row.length > 0);

  if (!hasContent && !hasEmbed && !hasComponents) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg px-6 py-12 text-center font-discord" style={{ backgroundColor: EMBED_BG }}>
        <Eye className="mb-3 h-10 w-10 text-zinc-600" />
        <p className="text-sm text-zinc-500">Your message preview will appear here</p>
        <p className="mt-1 text-xs text-zinc-600">Add content, embed, or components to get started</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg px-4 py-3 text-sm leading-relaxed font-discord" style={{ backgroundColor: EMBED_BG }}>
      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-500 text-sm font-bold text-white">
          A
        </div>
        <div>
          <span className="font-semibold text-white" style={{ color: ACCENT_COLOR }}>AOI Bot</span>
          <span className="ml-2 text-zinc-500">
            {channelName ? `#${channelName}` : "Today at 12:00 AM"}
          </span>
        </div>
      </div>

      {hasContent && (
        <div className="whitespace-pre-wrap text-[15px]" style={{ color: CHANNEL_TEXT_COLOR }}>
          {renderDiscordText(entry.content)}
        </div>
      )}

      {hasContent && hasEmbed && <div className="mb-2" />}

      {hasEmbed && (
        <div className="overflow-hidden rounded-lg border-l-4" style={{
          borderLeftColor: entry.embed.color || "#57f287",
          backgroundColor: "#2f3136",
        }}>
          <div className="px-3 py-2">
            {entry.embed.author_name && (
              <div className="mb-1 flex items-center gap-2 text-xs text-zinc-400">
                {entry.embed.author_icon_url && (
                  <img src={entry.embed.author_icon_url} alt="" className="h-4 w-4 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                {entry.embed.author_url ? (
                  <a href={entry.embed.author_url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: "#00a8fc" }}>
                    {entry.embed.author_name}
                  </a>
                ) : (
                  <span className="font-semibold text-white">{entry.embed.author_name}</span>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                {entry.embed.title && (
                  <div className="mb-1">
                    {entry.embed.url ? (
                      <a href={entry.embed.url} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold hover:underline" style={{ color: "#00a8fc" }}>
                        {renderDiscordText(entry.embed.title)}
                      </a>
                    ) : (
                      <h3 className="text-lg font-semibold text-white">{renderDiscordText(entry.embed.title)}</h3>
                    )}
                  </div>
                )}

                {entry.embed.description && (
                  <div className="whitespace-pre-wrap text-sm" style={{ color: CHANNEL_TEXT_COLOR }}>
                    {renderDiscordText(entry.embed.description)}
                  </div>
                )}

                {entry.embed.fields.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {entry.embed.fields.map((field, i) => (
                      <div key={i} className={field.inline ? "col-span-1" : "col-span-3"}>
                        <div className="text-xs font-semibold text-white">{renderDiscordText(field.name)}</div>
                        <div className="whitespace-pre-wrap text-xs" style={{ color: CHANNEL_TEXT_COLOR }}>
                          {renderDiscordText(field.value)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {entry.embed.image_url && (
                  <img src={entry.embed.image_url} alt="Embed image" className="mt-2 max-h-80 w-full rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
              </div>

              {entry.embed.thumbnail_url && (
                <img src={entry.embed.thumbnail_url} alt="Thumbnail" className="mt-1 h-20 w-20 flex-shrink-0 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </div>

            {(entry.embed.footer_text || entry.embed.timestamp) && (
              <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                {entry.embed.footer_icon_url && (
                  <img src={entry.embed.footer_icon_url} alt="" className="h-4 w-4 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                {entry.embed.footer_text && <span>{entry.embed.footer_text}</span>}
                {entry.embed.footer_text && entry.embed.timestamp && <span>•</span>}
                {entry.embed.timestamp && <span>{formatTimestamp(entry.embed.timestamp)}</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {hasComponents && (
        <div className="mt-2 space-y-1">
          {entry.components.map((row, ri) => (
            <div key={ri} className="flex flex-wrap gap-2">
              {row.map((comp, ci) => {
                const style = BUTTON_STYLES[comp.style] ?? BUTTON_STYLES[1]!;
                if (comp.type === "button") {
                  if (comp.style === 5) {
                    return (
                      <a key={ci} href={comp.url || "#"} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm font-medium transition-colors hover:brightness-110"
                        style={{ color: style.color, backgroundColor: style.bg, border: `1px solid ${style.border}` }}>
                        {comp.emoji?.name && <span>{comp.emoji.name}</span>}
                        {comp.label || "Link"}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    );
                  }
                  return (
                    <button key={ci} type="button" disabled={comp.disabled}
                      className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm font-medium transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ color: style.color, backgroundColor: style.bg, border: `1px solid ${style.border}` }}>
                      {comp.emoji?.name && <span>{comp.emoji.name}</span>}
                      {comp.label || "Button"}
                    </button>
                  );
                }
                if (comp.type === "select") {
                  return (
                    <div key={ci}
                      className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm text-zinc-400"
                      style={{ backgroundColor: "#4e5058" }}>
                      <ChevronDown className="h-3 w-3" />
                      {comp.placeholder || "Select an option"}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ColorSwatch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="flex h-8 w-12 items-center justify-center rounded border border-zinc-700"
        style={{ backgroundColor: value }}>
        <ChevronDown className="h-3 w-3 text-white/70" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
          <div className="mb-2 grid grid-cols-5 gap-1">
            {EMBED_PRESETS.map((p) => (
              <button key={p.value} type="button" title={p.label}
                onClick={() => { onChange(p.value); setOpen(false); }}
                className="h-6 w-full rounded border border-zinc-700 hover:scale-110 hover:border-white"
                style={{ backgroundColor: p.value }} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">#</span>
            <input type="text" value={value.replace("#", "")}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                if (v.length <= 6) onChange(`#${v}`);
              }}
              className="flex-1 rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200"
              placeholder="000000" />
          </div>
          <input type="color" value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-2 h-6 w-full cursor-pointer rounded border border-zinc-700" />
        </div>
      )}
    </div>
  );
}

function StatusBanner({ status }: { status: StatusMessage | null }) {
  if (!status || status.state === "idle") return null;
  const colors: Record<string, string> = {
    success: "border-emerald-700/60 bg-emerald-500/10 text-emerald-300",
    error: "border-red-700/60 bg-red-500/10 text-red-300",
    info: "border-sky-700/60 bg-sky-500/10 text-sky-300",
    sending: "border-amber-700/60 bg-amber-500/10 text-amber-300",
  };
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${colors[status.state] || "text-zinc-400"}`}>
      {status.text}
    </div>
  );
}

function FieldEditor({ fields, onChange }: { fields: AnnouncementField[]; onChange: (f: AnnouncementField[]) => void }) {
  const addField = () => onChange([...fields, { name: "", value: "", inline: false }]);
  const removeField = (i: number) => onChange(fields.filter((_, idx) => idx !== i));
  const updateField = (i: number, updates: Partial<AnnouncementField>) => {
    onChange(fields.map((f, idx) => idx === i ? { ...f, ...updates } : f));
  };
  return (
    <div className="space-y-2">
      {fields.map((field, i) => (
        <div key={i} className="rounded-lg border border-zinc-800 bg-black/50 p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500">Field {i + 1}</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-zinc-400">
                <input type="checkbox" checked={field.inline}
                  onChange={(e) => updateField(i, { inline: e.target.checked })}
                  className="h-3 w-3 rounded border-zinc-700 bg-zinc-800" />
                Inline
              </label>
              <button type="button" onClick={() => removeField(i)} className="text-zinc-600 hover:text-red-400">
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
          <input type="text" value={field.name} placeholder="Field name"
            onChange={(e) => updateField(i, { name: e.target.value })}
            className="mb-1 w-full rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600" />
          <textarea value={field.value} placeholder="Field value" rows={2}
            onChange={(e) => updateField(i, { value: e.target.value })}
            className="w-full rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 resize-none" />
        </div>
      ))}
      <button type="button" onClick={addField}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 py-1.5 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300">
        <Plus className="h-3 w-3" /> Add Field
      </button>
    </div>
  );
}

function ComponentEditor({ rows, onChange }: { rows: AnnouncementComponent[][]; onChange: (r: AnnouncementComponent[][]) => void }) {
  const addRow = () => onChange([...rows, []]);
  const removeRow = (ri: number) => onChange(rows.filter((_, idx) => idx !== ri));
  const addButton = (ri: number, style = 1) => {
    const newRows = rows.map((row, idx) => {
      if (idx !== ri) return row;
      if (row.length >= 5) return row;
      return [...row, { type: "button" as const, style, label: "", custom_id: `btn_${Date.now()}`, url: "", emoji: null, disabled: false, options: [], placeholder: "", min_values: 1, max_values: 1 }];
    });
    onChange(newRows);
  };
  const addSelect = (ri: number) => {
    const newRows = rows.map((row, idx) => {
      if (idx !== ri) return row;
      if (row.length >= 5) return row;
      return [...row, { type: "select" as const, style: 1, label: "", custom_id: `select_${Date.now()}`, url: "", emoji: null, disabled: false, options: [], placeholder: "Choose an option", min_values: 1, max_values: 1 }];
    });
    onChange(newRows);
  };
  const removeComponent = (ri: number, ci: number) => {
    onChange(rows.map((row, idx) => idx === ri ? row.filter((_, cidx) => cidx !== ci) : row));
  };
  const updateComponent = (ri: number, ci: number, updates: Partial<AnnouncementComponent>) => {
    onChange(rows.map((row, idx) => idx === ri ? row.map((c, cidx) => cidx === ci ? { ...c, ...updates } : c) : row));
  };
  const moveComponent = (fromRi: number, fromCi: number, toRi: number, toCi: number) => {
    const newRows = rows.map((r) => [...r]);
    const [moved] = newRows[fromRi]!.splice(fromCi, 1);
    newRows[toRi]!.splice(toCi, 0, moved!);
    onChange(newRows);
  };

  return (
    <div className="space-y-2">
      {rows.map((row, ri) => (
        <div key={ri} className="rounded-lg border border-zinc-800 bg-black/50 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Row {ri + 1} ({row.length}/5)</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => addButton(ri)}
                className="rounded px-2 py-0.5 text-[10px] uppercase text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
                + Button
              </button>
              <button type="button" onClick={() => addSelect(ri)}
                className="rounded px-2 py-0.5 text-[10px] uppercase text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
                + Select
              </button>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(ri)} className="text-zinc-600 hover:text-red-400">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          {row.length === 0 ? (
            <div className="py-2 text-center text-[10px] text-zinc-600">Empty row — add buttons or select menus</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {row.map((comp, ci) => (
                <div key={ci} className="relative rounded border border-zinc-700 bg-zinc-800/50 p-1.5">
                  <button type="button" onClick={() => removeComponent(ri, ci)}
                    className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] text-white">
                    <X className="h-2 w-2" />
                  </button>
                  {comp.type === "button" ? (
                    <div className="space-y-1 text-[10px]">
                      <select value={comp.style}
                        onChange={(e) => updateComponent(ri, ci, { style: Number(e.target.value) })}
                        className="w-full rounded border border-zinc-700 bg-black px-1 py-0.5 text-[10px] text-zinc-300">
                        {Object.entries(BUTTON_STYLES).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                      <input type="text" value={comp.label} placeholder="Label"
                        onChange={(e) => updateComponent(ri, ci, { label: e.target.value })}
                        className="w-full rounded border border-zinc-700 bg-black px-1 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600" />
                      {comp.style === 5 ? (
                        <input type="text" value={comp.url} placeholder="https://..."
                          onChange={(e) => updateComponent(ri, ci, { url: e.target.value })}
                          className="w-full rounded border border-zinc-700 bg-black px-1 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600" />
                      ) : (
                        <input type="text" value={comp.custom_id} placeholder="Custom ID"
                          onChange={(e) => updateComponent(ri, ci, { custom_id: e.target.value })}
                          className="w-full rounded border border-zinc-700 bg-black px-1 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600" />
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1 text-[10px]">
                      <input type="text" value={comp.placeholder} placeholder="Placeholder"
                        onChange={(e) => updateComponent(ri, ci, { placeholder: e.target.value })}
                        className="w-full rounded border border-zinc-700 bg-black px-1 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600" />
                      <input type="text" value={comp.custom_id} placeholder="Custom ID"
                        onChange={(e) => updateComponent(ri, ci, { custom_id: e.target.value })}
                        className="w-full rounded border border-zinc-700 bg-black px-1 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={addRow}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 py-1.5 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300">
        <Plus className="h-3 w-3" /> Add Row
      </button>
    </div>
  );
}

const SAMPLE_ANNOUNCEMENT: AnnouncementForm = {
  channel_ids: [],
  entries: [
    {
      ...createAnnouncementEntry(),
      content: "🎉 **New update is here!** Check out what's new in v3.2:\n\n• Improved performance\n• New dashboard UI\n• Bug fixes & more",
      embed: {
        title: "Version 3.2 Release Notes",
        description: "We're excited to announce the latest update! This release brings significant improvements to the announcement system with rich embed support, component buttons, and more.\n\n*Full changelog available below.*",
        url: "https://example.com/changelog",
        color: "#5865f2",
        author_name: "AOI Team",
        author_icon_url: "https://cdn.discordapp.com/embed/avatars/0.png",
        author_url: "",
        fields: [
          { name: "✨ New Features", value: "• Rich embed editor\n• Component buttons & selects\n• Multi-message support", inline: true },
          { name: "🔧 Improvements", value: "• 40% faster load times\n• Better mobile support\n• Enhanced preview", inline: true },
          { name: "📦 Installation", value: "Update your bot to the latest version via `npm update`", inline: false },
        ],
        footer_text: "Release date • May 2026",
        footer_icon_url: "",
        image_url: "",
        thumbnail_url: "",
        timestamp: "2026-05-15T12:00:00Z",
      },
      components: [
        [
          { type: "button", style: 1, label: "View Changelog", custom_id: "btn_changelog", url: "https://example.com/changelog", emoji: { name: "📋", id: "", animated: false }, disabled: false, options: [], placeholder: "", min_values: 1, max_values: 1 },
          { type: "button", style: 3, label: "Get Started", custom_id: "btn_getstarted", url: "", emoji: null, disabled: false, options: [], placeholder: "", min_values: 1, max_values: 1 },
          { type: "select", style: 1, label: "", custom_id: "select_help", url: "", emoji: null, disabled: false, options: [
            { label: "Documentation", value: "docs", description: "Read the docs", emoji: { name: "📚", id: "", animated: false } },
            { label: "Support Server", value: "support", description: "Join our Discord", emoji: { name: "💬", id: "", animated: false } },
          ], placeholder: "Need help?", min_values: 1, max_values: 1 },
        ],
      ],
      edit_existing: false,
      message_link: "",
    },
  ],
};

export default function AnnouncementsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [form, setForm] = useState<AnnouncementForm>(SAMPLE_ANNOUNCEMENT);
  const [presets, setPresets] = useState<AnnouncementPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [previewEntryId, setPreviewEntryId] = useState<string>(form.entries[0]?.id || "");
  const [editTab, setEditTab] = useState<"content" | "embed" | "components">("content");

  const activeEntry = useMemo(() => form.entries.find((e) => e.id === previewEntryId), [form.entries, previewEntryId]);

  const updateForm = useCallback((updates: Partial<AnnouncementForm>) => {
    setForm((current) => ({ ...current, ...updates }));
  }, []);

  const updateEntry = useCallback((entryId: string, updates: Partial<AnnouncementEntry>) => {
    setForm((current) => ({
      ...current,
      entries: current.entries.map((e) => e.id === entryId ? { ...e, ...updates } : e),
    }));
  }, []);

  const addEntry = useCallback(() => {
    const newEntry = createAnnouncementEntry();
    setForm((current) => ({ ...current, entries: [...current.entries, newEntry] }));
    setPreviewEntryId(newEntry.id);
  }, []);

  const duplicateEntry = useCallback((entryId: string) => {
    setForm((current) => {
      const source = current.entries.find((e) => e.id === entryId);
      if (!source) return current;
      const dup = { ...source, id: createAnnouncementEntry().id };
      const idx = current.entries.findIndex((e) => e.id === entryId);
      const next = [...current.entries];
      next.splice(idx + 1, 0, dup);
      return { ...current, entries: next };
    });
  }, []);

  const removeEntry = useCallback((entryId: string) => {
    setForm((current) => {
      const next = current.entries.filter((e) => e.id !== entryId);
      if (next.length === 0) {
        const fresh = createAnnouncementEntry();
        setPreviewEntryId(fresh.id);
        return { ...current, entries: [fresh] };
      }
      if (previewEntryId === entryId) {
        setPreviewEntryId(next[0]!.id);
      }
      return { ...current, entries: next };
    });
  }, [previewEntryId]);

  const moveEntry = useCallback((fromId: string, direction: "up" | "down") => {
    setForm((current) => {
      const idx = current.entries.findIndex((e) => e.id === fromId);
      if (idx === -1) return current;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= current.entries.length) return current;
      const next = [...current.entries];
      [next[idx]!, next[targetIdx]!] = [next[targetIdx]!, next[idx]!];
      return { ...current, entries: next };
    });
  }, []);

  const toggleChannel = useCallback((channelId: string) => {
    setForm((current) => {
      const selected = new Set(current.channel_ids);
      if (selected.has(channelId)) selected.delete(channelId);
      else selected.add(channelId);
      return { ...current, channel_ids: Array.from(selected) };
    });
  }, []);

  const savePreset = useCallback(async (kind: AnnouncementPreset["kind"]) => {
    const name = presetName.trim().slice(0, 80);
    if (!name) {
      setStatus({ state: "error", text: "Enter a name before saving." });
      return;
    }
    const existingIdx = presets.findIndex((p) => p.kind === kind && p.name.toLowerCase() === name.toLowerCase());
    const nextPresets = [...presets];
    const payload: AnnouncementPreset = {
      id: existingIdx >= 0 ? nextPresets[existingIdx]!.id : `preset-${Date.now()}`,
      name,
      kind,
      form: JSON.parse(JSON.stringify(form)),
    };
    if (existingIdx >= 0) nextPresets[existingIdx]! = payload;
    else nextPresets.unshift(payload);
    setPresets(nextPresets);
    setStatus({ state: "success", text: `${kind === "template" ? "Template" : "Draft"} saved.` });
  }, [presetName, presets, form]);

  const loadPreset = useCallback((preset: AnnouncementPreset) => {
    setForm(JSON.parse(JSON.stringify(preset.form)));
    setPresetName(preset.name);
    setPreviewEntryId(preset.form.entries[0]?.id || "");
    setStatus({ state: "info", text: `Loaded ${preset.kind} "${preset.name}".` });
  }, []);

  const deletePreset = useCallback((presetId: string) => {
    setPresets((current) => current.filter((p) => p.id !== presetId));
    setStatus({ state: "success", text: "Preset removed." });
  }, []);

  const handleDashboardRedirect = useCallback(() => {
    window.open("/dashboard", "_blank");
  }, []);

  if (!mounted) return null;

  return (
    <div className="public-page min-h-screen text-foreground">
      <SiteNavbar showAnchors={false} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p className="subtext text-xs uppercase tracking-[0.24em] text-muted-foreground">Tool</p>
          <h1 className="subpage-heading mt-4 text-5xl sm:text-6xl lg:text-7xl leading-[1.05]">Announcements</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-foreground/85">
            Compose and send rich announcements to your server channels. Build messages with embeds, buttons, select menus, and more.
          </p>
        </motion.section>

        <StatusBanner status={status} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_480px]">

          {/* LEFT: Editor */}
          <div className="rounded-xl p-5" style={{ backgroundColor: "#000000" }}>

            {/* Messages list */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="card-heading text-sm uppercase tracking-wider" style={{ color: "#8a8a8a" }}>Messages ({form.entries.length})</h2>
                <button type="button" onClick={addEntry}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{ backgroundColor: ACCENT_COLOR + "20", color: ACCENT_COLOR }}>
                  <Plus className="h-3 w-3" /> Add Message
                </button>
              </div>
              <div className="space-y-1">
                {form.entries.map((entry, i) => (
                  <div key={entry.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      previewEntryId === entry.id ? "border-zinc-600 bg-zinc-800/50" : "border-zinc-800 bg-black hover:bg-zinc-900"
                    }`}>
                    <div className="flex flex-col gap-0.5">
                      <button type="button" onClick={() => moveEntry(entry.id, "up")}
                        disabled={i === 0}
                        className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30">
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => moveEntry(entry.id, "down")}
                        disabled={i === form.entries.length - 1}
                        className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30">
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                    <button type="button" onClick={() => setPreviewEntryId(entry.id)} className="min-w-0 flex-1 text-left">
                      <span className="truncate text-zinc-300">
                        {entry.content.trim() || entry.embed.title.trim() || entry.embed.description.trim() || `Message ${i + 1}`}
                      </span>
                    </button>
                    <button type="button" onClick={() => duplicateEntry(entry.id)} title="Duplicate"
                      className="text-zinc-600 hover:text-zinc-300">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => removeEntry(entry.id)} title="Remove"
                      className="text-zinc-600 hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Channel picker */}
            <section>
              <h2 className="card-heading mb-3 text-sm uppercase tracking-wider" style={{ color: "#8a8a8a" }}>Target Channels</h2>
              <div className="text-xs text-zinc-500">
                Channel selection connects to your Discord server once authenticated via the dashboard.
              </div>
              <div className="mt-2 rounded-lg border border-zinc-800 bg-black/50 p-3">
                {form.channel_ids.length === 0 ? (
                  <div className="text-xs text-zinc-500">
                    <Link href="/dashboard" className="underline hover:text-zinc-300" style={{ color: ACCENT_COLOR }}>
                      Open Dashboard
                    </Link> to select target channels for your announcement.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {form.channel_ids.map((id) => (
                      <span key={id} className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                        #{id.slice(0, 8)}
                        <button type="button" onClick={() => toggleChannel(id)} className="text-zinc-600 hover:text-red-400">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Active entry editor */}
            {activeEntry && (
              <section>
                <h2 className="card-heading mb-3 text-sm uppercase tracking-wider" style={{ color: "#8a8a8a" }}>Edit Message</h2>

                <div className="mb-3 flex gap-1 rounded-lg border border-zinc-800 bg-black p-1">
                  {(["content", "embed", "components"] as const).map((tab) => (
                    <button key={tab} type="button" onClick={() => setEditTab(tab)}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        editTab === tab ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                      style={editTab === tab ? { backgroundColor: ACCENT_COLOR + "30", color: ACCENT_COLOR } : {}}>
                      {tab === "content" ? "Content" : tab === "embed" ? "Embed" : "Components"}
                    </button>
                  ))}
                </div>

                {editTab === "content" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-500">Message Content</label>
                      <textarea value={activeEntry.content}
                        onChange={(e) => updateEntry(activeEntry.id, { content: e.target.value })}
                        placeholder="Type your announcement message here..."
                        rows={4}
                        className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:border-zinc-600 focus:outline-none" />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-zinc-500">
                      <input type="checkbox" checked={activeEntry.edit_existing}
                        onChange={(e) => updateEntry(activeEntry.id, { edit_existing: e.target.checked })}
                        className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800" />
                      Edit existing message (provide message link below)
                    </label>
                    {activeEntry.edit_existing && (
                      <div>
                        <input type="text" value={activeEntry.message_link}
                          onChange={(e) => updateEntry(activeEntry.id, { message_link: e.target.value })}
                          placeholder="https://discord.com/channels/..."
                          className={`w-full rounded-lg border bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none ${
                            activeEntry.message_link && !DISCORD_MESSAGE_LINK_RE.test(activeEntry.message_link)
                              ? "border-red-600 focus:border-red-500"
                              : "border-zinc-800 focus:border-zinc-600"
                          }`} />
                        {activeEntry.message_link && !DISCORD_MESSAGE_LINK_RE.test(activeEntry.message_link) && (
                          <p className="mt-1 text-xs text-red-400">Invalid Discord message link format</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {editTab === "embed" && (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <input type="text" value={activeEntry.embed.title}
                          onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, title: e.target.value } })}
                          placeholder="Embed title"
                          className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
                        <input type="text" value={activeEntry.embed.url}
                          onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, url: e.target.value } })}
                          placeholder="Title URL (optional)"
                          className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
                        <textarea value={activeEntry.embed.description}
                          onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, description: e.target.value } })}
                          placeholder="Embed description"
                          rows={3}
                          className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:border-zinc-600 focus:outline-none" />
                      </div>
                      <div className="flex flex-col items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-zinc-600">Color</span>
                        <ColorSwatch value={activeEntry.embed.color}
                          onChange={(v) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, color: v } })} />
                      </div>
                    </div>

                    <div className="border-t border-zinc-800 pt-3">
                      <h3 className="mb-2 text-xs font-medium text-zinc-400">Author</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={activeEntry.embed.author_name}
                          onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, author_name: e.target.value } })}
                          placeholder="Author name"
                          className="w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
                        <input type="text" value={activeEntry.embed.author_icon_url}
                          onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, author_icon_url: e.target.value } })}
                          placeholder="Icon URL"
                          className="w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
                        <input type="text" value={activeEntry.embed.author_url}
                          onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, author_url: e.target.value } })}
                          placeholder="Author URL"
                          className="w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
                      </div>
                    </div>

                    <div className="border-t border-zinc-800 pt-3">
                      <h3 className="mb-2 text-xs font-medium text-zinc-400">Fields ({activeEntry.embed.fields.length}/25)</h3>
                      <FieldEditor fields={activeEntry.embed.fields}
                        onChange={(fields) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, fields } })} />
                    </div>

                    <div className="border-t border-zinc-800 pt-3">
                      <h3 className="mb-2 text-xs font-medium text-zinc-400">Images</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-[10px] text-zinc-600">Thumbnail URL</label>
                          <input type="text" value={activeEntry.embed.thumbnail_url}
                            onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, thumbnail_url: e.target.value } })}
                            placeholder="https://..."
                            className="w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] text-zinc-600">Image URL</label>
                          <input type="text" value={activeEntry.embed.image_url}
                            onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, image_url: e.target.value } })}
                            placeholder="https://..."
                            className="w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-zinc-800 pt-3">
                      <h3 className="mb-2 text-xs font-medium text-zinc-400">Footer & Timestamp</h3>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" value={activeEntry.embed.footer_text}
                            onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, footer_text: e.target.value } })}
                            placeholder="Footer text"
                            className="w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
                          <input type="text" value={activeEntry.embed.footer_icon_url}
                            onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, footer_icon_url: e.target.value } })}
                            placeholder="Icon URL"
                            className="w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
                        </div>
                        <input type="datetime-local" value={activeEntry.embed.timestamp}
                          onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, timestamp: e.target.value } })}
                          className="w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none" />
                      </div>
                    </div>
                  </div>
                )}

                {editTab === "components" && (
                  <ComponentEditor rows={activeEntry.components}
                    onChange={(components) => updateEntry(activeEntry.id, { components })} />
                )}
              </section>
            )}
          </div>

          {/* RIGHT: Preview */}
          <div className="space-y-4">
            <div style={{ backgroundColor: "#000000" }} className="rounded-xl p-5">
              <h2 className="card-heading mb-3 text-sm uppercase tracking-wider" style={{ color: "#8a8a8a" }}>Preview</h2>
              {activeEntry ? (
                <DiscordMessagePreview entry={activeEntry} channelName={form.channel_ids[0]?.slice(0, 8) || undefined} />
              ) : (
                <div className="flex items-center justify-center rounded-lg bg-zinc-800/50 py-12 text-sm text-zinc-500">
                  Select a message to preview
                </div>
              )}
            </div>

            {/* Presets */}
            <div style={{ backgroundColor: "#000000" }} className="rounded-xl p-5">
              <h2 className="card-heading mb-3 text-sm uppercase tracking-wider" style={{ color: "#8a8a8a" }}>Presets</h2>
              <div className="flex gap-2">
                <input type="text" value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
                <button type="button" onClick={() => savePreset("draft")}
                  className="rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                  style={{ backgroundColor: ACCENT_COLOR + "20", color: ACCENT_COLOR }}>
                  <Save className="mr-1 inline h-3 w-3" />Draft
                </button>
                <button type="button" onClick={() => savePreset("template")}
                  className="rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                  style={{ backgroundColor: "#a78bfa20", color: "#a78bfa" }}>
                  <Save className="mr-1 inline h-3 w-3" />Template
                </button>
              </div>
              {presets.length > 0 && (
                <div className="mt-3 space-y-1">
                  {presets.map((preset) => (
                    <div key={preset.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-sm">
                      <span className={`text-[10px] uppercase ${preset.kind === "template" ? "text-violet-400" : "text-amber-400"}`}>
                        {preset.kind === "template" ? "T" : "D"}
                      </span>
                      <button type="button" onClick={() => loadPreset(preset)} className="min-w-0 flex-1 text-left text-zinc-300 hover:text-white">
                        {preset.name}
                      </button>
                      <button type="button" onClick={() => deletePreset(preset.id)} className="text-zinc-600 hover:text-red-400">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dashboard CTA */}
            <div style={{ backgroundColor: "#000000" }} className="rounded-xl p-5">
              <Link href="/dashboard"
                className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all hover:brightness-110"
                style={{ backgroundColor: ACCENT_COLOR, color: "#fff" }}>
                <Send className="h-4 w-4" /> Open Dashboard to Send
              </Link>
              <p className="mt-2 text-center text-[10px] text-zinc-600">
                Authenticate with Discord to send announcements to your server
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <Link href="/" className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: '#000000', color: '#8a8a8a' }}>
            Back to Landing
          </Link>
        </div>
      </main>
    </div>
  );
}
