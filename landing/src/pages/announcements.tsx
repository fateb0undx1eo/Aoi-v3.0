import { nanoid } from "nanoid";
import { formatDate } from "@/lib/date";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Megaphone, Plus, Copy, Trash2, ChevronDown, ChevronUp,
  Send, Save, X, Palette, Eye, RotateCcw, Code, Layers,
  MessageSquare, Bot, Globe, Hash, Check, AlertTriangle,
  Share2, ExternalLink, Ban, BellOff, Zap,
} from "lucide-react";
import Link from "next/link";
import { SiteNavbar } from "@/components/site-navbar";

const C = {
  bg: "#090909",
  surface: "#111111",
  card: "#1a1a1a",
  burg: "#8B1538",
  border: "#1a1a1a",
  text: "#dbdee1",
  textMuted: "#6b6b6b",
  discBg: "#313338",
  discEmbed: "#2b2d31",
  discName: "#f2f3f5",
  discMuted: "#b5bac1",
};

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
  thread_name: string;
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

type Toast = {
  id: string;
  state: SaveState;
  text: string;
};

const EMPTY_EMBED: AnnouncementEmbed = {
  title: "",
  description: "",
  url: "",
  color: "#8B1538",
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
    thread_name: "",
  };
}

const ACCENT_COLOR = C.burg;
const EMBED_BG = C.discEmbed;
const MESSAGE_BG = C.discBg;
const CHANNEL_TEXT_COLOR = C.text;

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

function DiscordEmbed({ entry }: { entry: AnnouncementEntry }) {
  const e = entry.embed;
  const hasContent = e.title || e.description || e.fields.length > 0 || e.image_url || e.thumbnail_url || e.footer_text || e.author_name;
  if (!hasContent) return null;

  return (
    <div style={{
      marginTop: 6,
      borderLeft: `4px solid ${e.color || C.burg}`,
      background: C.discEmbed,
      borderRadius: 4,
      padding: "10px 14px",
      maxWidth: 380,
    }}>
      {e.author_name && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          {e.author_icon_url && (
            <img src={e.author_icon_url} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          {e.author_url ? (
            <a href={e.author_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: "#00a8fc", textDecoration: "none" }}>
              {e.author_name}
            </a>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, color: C.discName }}>{e.author_name}</span>
          )}
        </div>
      )}
      {e.title && (
        <div style={{ fontSize: 14, fontWeight: 600, color: C.discName, marginBottom: 4 }}>
          {e.url ? (
            <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ color: "#00a8fc", textDecoration: "none" }}>
              {renderDiscordText(e.title)}
            </a>
          ) : (
            renderDiscordText(e.title)
          )}
        </div>
      )}
      {e.description && (
        <div style={{ fontSize: 13, color: C.discMuted, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
          {renderDiscordText(e.description)}
        </div>
      )}
      {e.fields.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {e.fields.map((f, i) => (
            <div key={i} style={f.inline ? { display: "inline-block", width: "33%", verticalAlign: "top" } : {}}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.discName }}>{renderDiscordText(f.name)}</div>
              <div style={{ fontSize: 12, color: C.discMuted, whiteSpace: "pre-wrap" }}>{renderDiscordText(f.value)}</div>
            </div>
          ))}
        </div>
      )}
      {e.image_url && (
        <img src={e.image_url} alt="" style={{ marginTop: 8, maxHeight: 240, width: "100%", borderRadius: 8, objectFit: "cover" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      )}
      {e.thumbnail_url && (
        <div style={{ float: "right", marginLeft: 12 }}>
          <img src={e.thumbnail_url} alt="" style={{ maxHeight: 80, maxWidth: 80, borderRadius: 4, objectFit: "cover" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}
      {(e.footer_text || e.timestamp) && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 11, color: C.discMuted }}>
          {e.footer_icon_url && (
            <img src={e.footer_icon_url} alt="" style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "cover" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          {e.footer_text && <span>{e.footer_text}</span>}
          {e.footer_text && e.timestamp && <span>•</span>}
          {e.timestamp && <span>{formatTimestamp(e.timestamp)}</span>}
        </div>
      )}
    </div>
  );
}

function DiscordContainer({ embed }: { embed: AnnouncementEmbed }) {
  const hasContent = embed.title || embed.description || embed.fields.length > 0 || embed.image_url || embed.footer_text;
  if (!hasContent) return null;

  return (
    <div style={{
      marginTop: 6,
      borderLeft: embed.color ? `4px solid ${embed.color}` : undefined,
      background: C.discEmbed,
      borderRadius: 4,
      padding: "10px 14px",
      maxWidth: 380,
    }}>
      {embed.title && (
        <div style={{ fontSize: 14, fontWeight: 600, color: C.discName, marginBottom: 4 }}>
          {renderDiscordText(embed.title)}
        </div>
      )}
      {embed.description && (
        <div style={{ fontSize: 13, color: C.discMuted, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
          {renderDiscordText(embed.description)}
        </div>
      )}
      {embed.fields.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {embed.fields.map((f, i) => (
            <div key={i} style={f.inline ? { display: "inline-block", width: "33%", verticalAlign: "top" } : {}}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.discName }}>{renderDiscordText(f.name)}</div>
              <div style={{ fontSize: 12, color: C.discMuted, whiteSpace: "pre-wrap" }}>{renderDiscordText(f.value)}</div>
            </div>
          ))}
        </div>
      )}
      {embed.footer_text && (
        <div style={{ marginTop: 8, fontSize: 11, color: C.discMuted }}>
          {embed.footer_text}
        </div>
      )}
    </div>
  );
}

function DiscordMessagePreview({ entry, channelName }: { entry: AnnouncementEntry; channelName?: string }) {
  const hasContent = entry.content.trim().length > 0;
  const hasEmbed = entry.embed.title || entry.embed.description || entry.embed.fields.length > 0 || entry.embed.image_url || entry.embed.thumbnail_url || entry.embed.footer_text || entry.embed.author_name;
  const hasComponents = entry.components.length > 0 && entry.components.some((row) => row.length > 0);

  if (!hasContent && !hasEmbed && !hasComponents) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center", backgroundColor: EMBED_BG, borderRadius: 8 }}>
        <Eye style={{ marginBottom: 12, width: 40, height: 40, color: "#52525b" }} />
        <p style={{ fontSize: 14, color: "#71717a" }}>Your message preview will appear here</p>
        <p style={{ marginTop: 4, fontSize: 12, color: "#52525b" }}>Add content, embed, or components to get started</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: EMBED_BG, borderRadius: 8, padding: "12px 16px", fontSize: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#52525b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>
          A
        </div>
        <div>
          <span style={{ fontWeight: 600, color: ACCENT_COLOR }}>AOI Bot</span>
          <span style={{ marginLeft: 8, color: "#71717a", fontSize: 12 }}>
            {channelName ? `#${channelName}` : "Today at 12:00 AM"}
          </span>
        </div>
      </div>

      {hasContent && (
        <div style={{ whiteSpace: "pre-wrap", fontSize: 15, color: CHANNEL_TEXT_COLOR }}>
          {renderDiscordText(entry.content)}
        </div>
      )}

      {entry.edit_existing && entry.message_link && (
        <div style={{ marginTop: 4, fontSize: 11, color: "#00a8fc" }}>
          Editing: {entry.message_link.slice(0, 60)}...
        </div>
      )}

      {entry.thread_name && (
        <div style={{ marginTop: 4, fontSize: 11, color: "#b5bac1" }}>
          Thread: {entry.thread_name}
        </div>
      )}

      {hasComponents && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {entry.components.map((row, ri) => (
            <div key={ri} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {row.map((comp, ci) => {
                const style = BUTTON_STYLES[comp.style] ?? BUTTON_STYLES[1]!;
                if (comp.type === "button") {
                  if (comp.style === 5) {
                    return (
                      <a key={ci} href={comp.url || "#"} target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 4, fontSize: 13, fontWeight: 500, color: style.color, backgroundColor: style.bg, border: `1px solid ${style.border}`, textDecoration: "none" }}>
                        {comp.emoji?.name && <span>{comp.emoji.name}</span>}
                        {comp.label || "Link"}
                        <ExternalLink style={{ width: 12, height: 12 }} />
                      </a>
                    );
                  }
                  return (
                    <button key={ci} type="button" disabled={comp.disabled}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 4, fontSize: 13, fontWeight: 500, color: style.color, backgroundColor: style.bg, border: `1px solid ${style.border}`, cursor: comp.disabled ? "not-allowed" : "pointer", opacity: comp.disabled ? 0.5 : 1 }}>
                      {comp.emoji?.name && <span>{comp.emoji.name}</span>}
                      {comp.label || "Button"}
                    </button>
                  );
                }
                if (comp.type === "select") {
                  return (
                    <div key={ci} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 4, fontSize: 13, color: "#a1a1aa", backgroundColor: "#4e5058" }}>
                      <ChevronDown style={{ width: 12, height: 12 }} />
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
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(!open)}
        style={{ display: "flex", width: 48, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 4, border: "1px solid #3f3f46", backgroundColor: value }}>
        <ChevronDown style={{ width: 12, height: 12, color: "rgba(255,255,255,0.7)" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", left: 0, top: "100%", zIndex: 20, marginTop: 4, width: 224, borderRadius: 8, border: "1px solid #3f3f46", backgroundColor: "#18181b", padding: 8, boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
          <div style={{ marginBottom: 8, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
            {EMBED_PRESETS.map((p) => (
              <button key={p.value} type="button" title={p.label}
                onClick={() => { onChange(p.value); setOpen(false); }}
                style={{ height: 24, width: "100%", borderRadius: 4, border: "1px solid #3f3f46", backgroundColor: p.value, cursor: "pointer" }} />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#a1a1aa" }}>#</span>
            <input type="text" value={value.replace("#", "")}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                if (v.length <= 6) onChange(`#${v}`);
              }}
              style={{ flex: 1, borderRadius: 4, border: "1px solid #3f3f46", backgroundColor: "#000", padding: "4px 8px", fontSize: 12, color: "#e4e4e7", outline: "none" }}
              placeholder="000000" />
          </div>
          <input type="color" value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ marginTop: 8, width: "100%", height: 24, cursor: "pointer", borderRadius: 4, border: "1px solid #3f3f46" }} />
        </div>
      )}
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {fields.map((field, i) => (
        <div key={i} style={{ borderRadius: 8, border: "1px solid #27272a", backgroundColor: "rgba(0,0,0,0.5)", padding: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: "#71717a" }}>Field {i + 1}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#a1a1aa" }}>
                <input type="checkbox" checked={field.inline}
                  onChange={(e) => updateField(i, { inline: e.target.checked })}
                  style={{ width: 12, height: 12 }} />
                Inline
              </label>
              <button type="button" onClick={() => removeField(i)} style={{ color: "#52525b", background: "none", border: "none", cursor: "pointer" }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </div>
          </div>
          <input type="text" value={field.name} placeholder="Field name"
            onChange={(e) => updateField(i, { name: e.target.value })}
            style={{ width: "100%", marginBottom: 4, borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#000", padding: "4px 8px", fontSize: 12, color: "#e4e4e7", outline: "none" }} />
          <textarea value={field.value} placeholder="Field value" rows={2}
            onChange={(e) => updateField(i, { value: e.target.value })}
            style={{ width: "100%", borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#000", padding: "4px 8px", fontSize: 12, color: "#e4e4e7", outline: "none", resize: "none" }} />
        </div>
      ))}
      <button type="button" onClick={addField}
        style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 8, border: "1px dashed #3f3f46", padding: "6px 0", fontSize: 12, color: "#71717a", background: "none", cursor: "pointer" }}>
        <Plus style={{ width: 12, height: 12 }} /> Add Field
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ borderRadius: 8, border: "1px solid #27272a", backgroundColor: "rgba(0,0,0,0.5)", padding: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#a1a1aa" }}>Row {ri + 1} ({row.length}/5)</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button type="button" onClick={() => addButton(ri)}
                style={{ padding: "2px 8px", fontSize: 10, textTransform: "uppercase", color: "#a1a1aa", background: "none", border: "none", cursor: "pointer" }}>
                + Button
              </button>
              <button type="button" onClick={() => addSelect(ri)}
                style={{ padding: "2px 8px", fontSize: 10, textTransform: "uppercase", color: "#a1a1aa", background: "none", border: "none", cursor: "pointer" }}>
                + Select
              </button>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(ri)} style={{ color: "#52525b", background: "none", border: "none", cursor: "pointer" }}>
                  <X style={{ width: 12, height: 12 }} />
                </button>
              )}
            </div>
          </div>
          {row.length === 0 ? (
            <div style={{ padding: "8px 0", textAlign: "center", fontSize: 10, color: "#52525b" }}>Empty row — add buttons or select menus</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {row.map((comp, ci) => (
                <div key={ci} style={{ position: "relative", borderRadius: 4, border: "1px solid #3f3f46", backgroundColor: "rgba(63,63,70,0.5)", padding: 6 }}>
                  <button type="button" onClick={() => removeComponent(ri, ci)}
                    style={{ position: "absolute", right: -4, top: -4, width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", backgroundColor: "#ef4444", color: "#fff", fontSize: 8, border: "none", cursor: "pointer" }}>
                    <X style={{ width: 8, height: 8 }} />
                  </button>
                  {comp.type === "button" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10 }}>
                      <select value={comp.style}
                        onChange={(e) => updateComponent(ri, ci, { style: Number(e.target.value) })}
                        style={{ width: "100%", borderRadius: 4, border: "1px solid #3f3f46", backgroundColor: "#000", padding: "2px 4px", fontSize: 10, color: "#d4d4d8" }}>
                        {Object.entries(BUTTON_STYLES).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                      <input type="text" value={comp.label} placeholder="Label"
                        onChange={(e) => updateComponent(ri, ci, { label: e.target.value })}
                        style={{ width: "100%", borderRadius: 4, border: "1px solid #3f3f46", backgroundColor: "#000", padding: "2px 4px", fontSize: 10, color: "#e4e4e7", outline: "none" }} />
                      {comp.style === 5 ? (
                        <input type="text" value={comp.url} placeholder="https://..."
                          onChange={(e) => updateComponent(ri, ci, { url: e.target.value })}
                          style={{ width: "100%", borderRadius: 4, border: "1px solid #3f3f46", backgroundColor: "#000", padding: "2px 4px", fontSize: 10, color: "#e4e4e7", outline: "none" }} />
                      ) : (
                        <input type="text" value={comp.custom_id} placeholder="Custom ID"
                          onChange={(e) => updateComponent(ri, ci, { custom_id: e.target.value })}
                          style={{ width: "100%", borderRadius: 4, border: "1px solid #3f3f46", backgroundColor: "#000", padding: "2px 4px", fontSize: 10, color: "#e4e4e7", outline: "none" }} />
                      )}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10 }}>
                      <input type="text" value={comp.placeholder} placeholder="Placeholder"
                        onChange={(e) => updateComponent(ri, ci, { placeholder: e.target.value })}
                        style={{ width: "100%", borderRadius: 4, border: "1px solid #3f3f46", backgroundColor: "#000", padding: "2px 4px", fontSize: 10, color: "#e4e4e7", outline: "none" }} />
                      <input type="text" value={comp.custom_id} placeholder="Custom ID"
                        onChange={(e) => updateComponent(ri, ci, { custom_id: e.target.value })}
                        style={{ width: "100%", borderRadius: 4, border: "1px solid #3f3f46", backgroundColor: "#000", padding: "2px 4px", fontSize: 10, color: "#e4e4e7", outline: "none" }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={addRow}
        style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 8, border: "1px dashed #3f3f46", padding: "6px 0", fontSize: 12, color: "#71717a", background: "none", cursor: "pointer" }}>
        <Plus style={{ width: 12, height: 12 }} /> Add Row
      </button>
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none",
    }}>
      {toasts.map((toast) => {
        const colors: Record<string, { border: string; bg: string; text: string }> = {
          success: { border: "#065f4620", bg: "rgba(5,150,105,0.15)", text: "#34d399" },
          error: { border: "#991b1b20", bg: "rgba(239,68,68,0.15)", text: "#f87171" },
          info: { border: "#07598520", bg: "rgba(14,165,233,0.15)", text: "#38bdf8" },
          sending: { border: "#92400e20", bg: "rgba(245,158,11,0.15)", text: "#fbbf24" },
        };
        const c = (colors[toast.state] || colors.info)!;
        return (
          <div key={toast.id} style={{
            pointerEvents: "auto",
            animation: "slideUp 0.3s ease-out",
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 20px", borderRadius: 10,
            border: `1px solid ${c.border}`,
            backgroundColor: c.bg,
            color: c.text,
            fontSize: 14, fontWeight: 500,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            minWidth: 280,
            backdropFilter: "blur(8px)",
          }}>
            {toast.state === "error" && <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />}
            {toast.state === "success" && <Check style={{ width: 16, height: 16, flexShrink: 0 }} />}
            {toast.state === "sending" && <Zap style={{ width: 16, height: 16, flexShrink: 0 }} />}
            <span>{toast.text}</span>
            <button type="button" onClick={() => onDismiss(toast.id)}
              style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", opacity: 0.6, cursor: "pointer" }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SendModal({
  open,
  channels,
  selectedChannelIds,
  onToggleChannel,
  onSelectAll,
  onDeselectAll,
  sendMode,
  onSendModeChange,
  onSend,
  onClose,
}: {
  open: boolean;
  channels: GuildChannel[];
  selectedChannelIds: Set<string>;
  onToggleChannel: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  sendMode: "webhook" | "bot" | "edit_webhook" | "edit_bot";
  onSendModeChange: (mode: "webhook" | "bot" | "edit_webhook" | "edit_bot") => void;
  onSend: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9998,
      display: "flex", alignItems: "center", justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: C.surface, borderRadius: 16,
          border: `1px solid ${C.border}`,
          padding: 24, width: 420, maxWidth: "90vw",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text }}>Send Announcement</h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer" }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 8, display: "block" }}>Send Mode</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { value: "webhook" as const, label: "Send as Webhook", icon: Globe },
              { value: "bot" as const, label: "Send as Bot", icon: Bot },
              { value: "edit_webhook" as const, label: "Edit Message as Webhook", icon: Globe },
              { value: "edit_bot" as const, label: "Edit Message as Bot", icon: Bot },
            ].map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" onClick={() => onSendModeChange(value)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 10,
                  border: `1px solid ${sendMode === value ? C.burg : C.border}`,
                  backgroundColor: sendMode === value ? `${C.burg}15` : "transparent",
                  color: sendMode === value ? C.burg : C.text,
                  cursor: "pointer", fontSize: 13, fontWeight: 500,
                  transition: "all 0.15s",
                }}>
                <Icon style={{ width: 16, height: 16 }} />
                {label}
                {sendMode === value && <Check style={{ width: 14, height: 14, marginLeft: "auto" }} />}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>
              <Hash style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
              Channels ({selectedChannelIds.size})
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onSelectAll} style={{ fontSize: 10, color: C.textMuted, background: "none", border: "none", cursor: "pointer" }}>All</button>
              <button type="button" onClick={onDeselectAll} style={{ fontSize: 10, color: C.textMuted, background: "none", border: "none", cursor: "pointer" }}>None</button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 160, overflowY: "auto" }}>
            {channels.length === 0 ? (
              <p style={{ fontSize: 11, color: C.textMuted }}>No text channels available.</p>
            ) : channels.map((ch) => {
              const sel = selectedChannelIds.has(ch.id);
              return (
                <button key={ch.id} type="button" onClick={() => onToggleChannel(ch.id)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                    border: `1px solid ${sel ? `${C.burg}60` : C.border}`,
                    backgroundColor: sel ? `${C.burg}15` : "transparent",
                    color: sel ? C.burg : C.textMuted,
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                  {sel && <Check style={{ width: 10, height: 10 }} />}
                  # {ch.name}
                </button>
              );
            })}
          </div>
        </div>

        <button type="button" onClick={onSend}
          disabled={selectedChannelIds.size === 0}
          style={{
            display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px 0", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#fff",
            backgroundColor: C.burg, border: "none", cursor: selectedChannelIds.size === 0 ? "not-allowed" : "pointer",
            opacity: selectedChannelIds.size === 0 ? 0.5 : 1,
            transition: "all 0.15s",
          }}>
          <Send style={{ width: 16, height: 16 }} />
          Send to {selectedChannelIds.size} channel{selectedChannelIds.size !== 1 ? "s" : ""}
        </button>
      </div>
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
      thread_name: "",
    },
  ],
};

export default function AnnouncementsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [form, setForm] = useState<AnnouncementForm>(SAMPLE_ANNOUNCEMENT);
  const [presets, setPresets] = useState<AnnouncementPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [previewEntryId, setPreviewEntryId] = useState<string>(form.entries[0]?.id || "");
  const [editTab, setEditTab] = useState<"content" | "embed" | "components">("content");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendMode, setSendMode] = useState<"webhook" | "bot" | "edit_webhook" | "edit_bot">("webhook");
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const activeEntry = useMemo(() => form.entries.find((e) => e.id === previewEntryId), [form.entries, previewEntryId]);

  const addToast = useCallback((state: SaveState, text: string) => {
    const id = nanoid(6);
    setToasts((prev) => [...prev, { id, state, text }]);
    if (state !== "sending") {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

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

  const addEntryV2 = useCallback(() => {
    const newEntry = createAnnouncementEntry();
    newEntry.embed.color = "";
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

  const scrollToMessage = useCallback((entryId: string) => {
    const el = msgRefs.current[entryId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setPreviewEntryId(entryId);
  }, []);

  const toggleChannel = useCallback((channelId: string) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  }, []);

  const selectAllChannels = useCallback(() => {
    setSelectedChannelIds(new Set(SAMPLE_CHANNELS.map((c) => c.id)));
  }, []);

  const deselectAllChannels = useCallback(() => {
    setSelectedChannelIds(new Set());
  }, []);

  const savePreset = useCallback(async (kind: AnnouncementPreset["kind"]) => {
    const name = presetName.trim().slice(0, 80);
    if (!name) {
      addToast("error", "Enter a name before saving.");
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
    addToast("success", `${kind === "template" ? "Template" : "Draft"} saved.`);
  }, [presetName, presets, form, addToast]);

  const loadPreset = useCallback((preset: AnnouncementPreset) => {
    setForm(JSON.parse(JSON.stringify(preset.form)));
    setPresetName(preset.name);
    setPreviewEntryId(preset.form.entries[0]?.id || "");
    addToast("info", `Loaded ${preset.kind} "${preset.name}".`);
  }, [addToast]);

  const deletePreset = useCallback((presetId: string) => {
    setPresets((current) => current.filter((p) => p.id !== presetId));
    addToast("success", "Preset removed.");
  }, [addToast]);

  const handleSend = useCallback(() => {
    if (selectedChannelIds.size === 0) {
      addToast("error", "Select at least one channel to send to.");
      return;
    }
    const hasContent = form.entries.some((e) => e.content.trim() || e.embed.title || e.embed.description || e.embed.fields.length > 0 || e.components.length > 0);
    if (!hasContent) {
      addToast("error", "Add content to at least one message.");
      return;
    }
    addToast("sending", "Sending announcement...");
    setTimeout(() => {
      addToast("success", "Announcement sent successfully!");
      setSendModalOpen(false);
    }, 1500);
  }, [form, selectedChannelIds, addToast]);

  const handleDashboardRedirect = useCallback(() => {
    window.open("/dashboard", "_blank");
  }, []);

  if (!mounted) return null;

  return (
    <div style={{ backgroundColor: C.bg, color: C.text, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 3px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `}</style>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <SendModal
        open={sendModalOpen}
        channels={SAMPLE_CHANNELS}
        selectedChannelIds={selectedChannelIds}
        onToggleChannel={toggleChannel}
        onSelectAll={selectAllChannels}
        onDeselectAll={deselectAllChannels}
        sendMode={sendMode}
        onSendModeChange={setSendMode}
        onSend={handleSend}
        onClose={() => setSendModalOpen(false)}
      />

      {/* Header */}
      <SiteNavbar showAnchors={false} />

      {/* Main content - full height split */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", height: "calc(100vh - 64px)" }}>
        {/* LEFT PANE */}
        <div style={{ width: "50%", display: "flex", flexDirection: "column", backgroundColor: C.surface, borderRight: `1px solid ${C.border}` }}>
          {/* Fixed header */}
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, backgroundColor: C.surface }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Megaphone style={{ width: 20, height: 20, color: C.burg }} />
                <span style={{ fontSize: 18, fontWeight: 600, color: C.text }}>Announcement Studio</span>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {/* Toolbar buttons with tooltips */}
                <ToolbarButton icon={<Share2 style={{ width: 14, height: 14 }} />} tooltip="Share" onClick={() => {}} />
                <ToolbarButton icon={<Save style={{ width: 14, height: 14 }} />} tooltip="Presets" onClick={() => {}} />
                <ToolbarButton icon={<Code style={{ width: 14, height: 14 }} />} tooltip="Generate Code" onClick={() => {}} />
                <ToolbarButton icon={<RotateCcw style={{ width: 14, height: 14 }} />} tooltip="Reset" onClick={() => {
                  setForm({ channel_ids: [], entries: [createAnnouncementEntry()] });
                  setPreviewEntryId(form.entries[0]?.id || "");
                  addToast("info", "Reset to empty state.");
                }} />
              </div>
            </div>

            {/* Message navigation numbers */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: C.textMuted, marginRight: 4 }}>Messages:</span>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {form.entries.map((entry, i) => (
                  <button key={entry.id} type="button" onClick={() => scrollToMessage(entry.id)}
                    title={`Message ${i + 1}`}
                    style={{
                      width: 24, height: 24, borderRadius: 6,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 600,
                      border: `1px solid ${previewEntryId === entry.id ? C.burg : C.border}`,
                      backgroundColor: previewEntryId === entry.id ? `${C.burg}20` : "transparent",
                      color: previewEntryId === entry.id ? C.burg : C.textMuted,
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                    {i + 1}
                  </button>
                ))}
                <button type="button" onClick={(e) => {
                  const rect = (e.target as HTMLElement).closest("div")?.getBoundingClientRect();
                  // show add options
                }}
                  title="Add Message"
                  style={{
                    width: 24, height: 24, borderRadius: 6,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: `1px dashed ${C.border}`,
                    backgroundColor: "transparent",
                    color: C.textMuted, cursor: "pointer",
                  }}>
                  <Plus style={{ width: 12, height: 12 }} />
                </button>
              </div>
              {/* Add message option buttons */}
              <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
                <button type="button" onClick={addEntry}
                  title="Add Standard Message"
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 500,
                    border: `1px solid ${C.border}`, backgroundColor: "transparent",
                    color: C.textMuted, cursor: "pointer", transition: "all 0.15s",
                  }}>
                  <MessageSquare style={{ width: 10, height: 10 }} /> Msg
                </button>
                <button type="button" onClick={addEntryV2}
                  title="Add Components V2 Message"
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 500,
                    border: `1px solid ${C.border}`, backgroundColor: "transparent",
                    color: C.textMuted, cursor: "pointer", transition: "all 0.15s",
                  }}>
                  <Layers style={{ width: 10, height: 10 }} /> V2
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable message list */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}
            className="scrollbar-thin">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {form.entries.map((entry, i) => {
                const isSelected = previewEntryId === entry.id;
                const hasContent = entry.content.trim() || entry.embed.title || entry.embed.description || entry.embed.fields.length > 0 || entry.components.length > 0;
                return (
                  <div key={entry.id} ref={(el) => { msgRefs.current[entry.id] = el; }}
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${isSelected ? `${C.burg}50` : C.border}`,
                      backgroundColor: isSelected ? `${C.burg}08` : C.card,
                      overflow: "hidden",
                      transition: "all 0.15s",
                    }}>
                    {/* Message header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <button type="button" onClick={() => moveEntry(entry.id, "up")}
                          disabled={i === 0}
                          style={{ color: "#52525b", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}>
                          <ChevronUp style={{ width: 10, height: 10 }} />
                        </button>
                        <button type="button" onClick={() => moveEntry(entry.id, "down")}
                          disabled={i === form.entries.length - 1}
                          style={{ color: "#52525b", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}>
                          <ChevronDown style={{ width: 10, height: 10 }} />
                        </button>
                      </div>
                      <button type="button" onClick={() => { setPreviewEntryId(entry.id); scrollToMessage(entry.id); }}
                        style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: isSelected ? C.burg : C.text, display: "block" }}>
                          {!entry.embed.color && <span style={{ fontSize: 9, color: "#a78bfa", marginRight: 4 }}>[V2]</span>}
                          {entry.content.trim() || entry.embed.title || entry.embed.description || `Message ${i + 1}`}
                        </span>
                      </button>
                      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                        <button type="button" onClick={() => duplicateEntry(entry.id)} title="Duplicate"
                          style={{ color: "#52525b", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                          <Copy style={{ width: 12, height: 12 }} />
                        </button>
                        <button type="button" onClick={() => removeEntry(entry.id)} title="Remove"
                          style={{ color: "#52525b", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                          <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded editor */}
                    {isSelected && (
                      <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 12px" }}>
                        {/* Edit tabs */}
                        <div style={{ display: "flex", gap: 4, marginBottom: 12, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg, padding: 3 }}>
                          {(["content", "embed", "components"] as const).map((tab) => (
                            <button key={tab} type="button" onClick={() => setEditTab(tab)}
                              style={{
                                flex: 1, borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 500,
                                border: "none",
                                backgroundColor: editTab === tab ? C.burg : "transparent",
                                color: editTab === tab ? "#fff" : C.textMuted,
                                cursor: "pointer", transition: "all 0.15s",
                              }}>
                              {tab === "content" ? "Content" : tab === "embed" ? "Embed" : "Components"}
                            </button>
                          ))}
                        </div>

                        {editTab === "content" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div>
                              <textarea value={entry.content}
                                onChange={(e) => updateEntry(entry.id, { content: e.target.value })}
                                placeholder="Type your announcement message here..."
                                rows={4}
                                style={{
                                  width: "100%", borderRadius: 8,
                                  border: `1px solid ${C.border}`, backgroundColor: C.bg,
                                  padding: "8px 12px", fontSize: 13, color: C.text,
                                  outline: "none", resize: "none",
                                }} />
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textMuted }}>
                                <input type="checkbox" checked={entry.edit_existing}
                                  onChange={(e) => updateEntry(entry.id, { edit_existing: e.target.checked })}
                                  style={{ width: 12, height: 12 }} />
                                Edit existing
                              </label>
                            </div>
                            {entry.edit_existing && (
                              <div>
                                <input type="text" value={entry.message_link}
                                  onChange={(e) => updateEntry(entry.id, { message_link: e.target.value })}
                                  placeholder="https://discord.com/channels/..."
                                  style={{
                                    width: "100%", borderRadius: 8,
                                    border: `1px solid ${entry.message_link && !DISCORD_MESSAGE_LINK_RE.test(entry.message_link) ? "#dc2626" : C.border}`,
                                    backgroundColor: C.bg, padding: "8px 12px",
                                    fontSize: 12, color: C.text, outline: "none",
                                  }} />
                                {entry.message_link && !DISCORD_MESSAGE_LINK_RE.test(entry.message_link) && (
                                  <p style={{ marginTop: 4, fontSize: 11, color: "#f87171" }}>Invalid Discord message link format</p>
                                )}
                              </div>
                            )}
                            <div>
                              <input type="text" value={entry.thread_name}
                                onChange={(e) => updateEntry(entry.id, { thread_name: e.target.value })}
                                placeholder="Thread name (optional)"
                                style={{
                                  width: "100%", borderRadius: 8,
                                  border: `1px solid ${C.border}`, backgroundColor: C.bg,
                                  padding: "8px 12px", fontSize: 12, color: C.text, outline: "none",
                                }} />
                            </div>
                          </div>
                        )}

                        {editTab === "embed" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                                <input type="text" value={entry.embed.title}
                                  onChange={(e) => updateEntry(entry.id, { embed: { ...entry.embed, title: e.target.value } })}
                                  placeholder="Embed title"
                                  style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg, padding: "8px 12px", fontSize: 13, color: C.text, outline: "none" }} />
                                <input type="text" value={entry.embed.url}
                                  onChange={(e) => updateEntry(entry.id, { embed: { ...entry.embed, url: e.target.value } })}
                                  placeholder="Title URL (optional)"
                                  style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg, padding: "8px 12px", fontSize: 13, color: C.text, outline: "none" }} />
                                <textarea value={entry.embed.description}
                                  onChange={(e) => updateEntry(entry.id, { embed: { ...entry.embed, description: e.target.value } })}
                                  placeholder="Embed description"
                                  rows={3}
                                  style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg, padding: "8px 12px", fontSize: 13, color: C.text, outline: "none", resize: "none" }} />
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingTop: 4 }}>
                                <span style={{ fontSize: 10, color: C.textMuted }}>Color</span>
                                <ColorSwatch value={entry.embed.color}
                                  onChange={(v) => updateEntry(entry.id, { embed: { ...entry.embed, color: v } })} />
                                <button type="button" onClick={() => updateEntry(entry.id, { embed: { ...entry.embed, color: "" } })}
                                  title="Remove color (container mode)"
                                  style={{ fontSize: 9, color: C.textMuted, background: "none", border: "none", cursor: "pointer" }}>
                                  <Ban style={{ width: 10, height: 10 }} />
                                </button>
                              </div>
                            </div>

                            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 6 }}>Author</div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                                <input type="text" value={entry.embed.author_name}
                                  onChange={(e) => updateEntry(entry.id, { embed: { ...entry.embed, author_name: e.target.value } })}
                                  placeholder="Author name"
                                  style={{ borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.bg, padding: "6px 8px", fontSize: 12, color: C.text, outline: "none" }} />
                                <input type="text" value={entry.embed.author_icon_url}
                                  onChange={(e) => updateEntry(entry.id, { embed: { ...entry.embed, author_icon_url: e.target.value } })}
                                  placeholder="Icon URL"
                                  style={{ borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.bg, padding: "6px 8px", fontSize: 12, color: C.text, outline: "none" }} />
                                <input type="text" value={entry.embed.author_url}
                                  onChange={(e) => updateEntry(entry.id, { embed: { ...entry.embed, author_url: e.target.value } })}
                                  placeholder="Author URL"
                                  style={{ borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.bg, padding: "6px 8px", fontSize: 12, color: C.text, outline: "none" }} />
                              </div>
                            </div>

                            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 6 }}>Fields ({entry.embed.fields.length}/25)</div>
                              <FieldEditor fields={entry.embed.fields}
                                onChange={(fields) => updateEntry(entry.id, { embed: { ...entry.embed, fields } })} />
                            </div>

                            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 6 }}>Images</div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                                <div>
                                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>Thumbnail URL</div>
                                  <input type="text" value={entry.embed.thumbnail_url}
                                    onChange={(e) => updateEntry(entry.id, { embed: { ...entry.embed, thumbnail_url: e.target.value } })}
                                    placeholder="https://..."
                                    style={{ width: "100%", borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.bg, padding: "6px 8px", fontSize: 12, color: C.text, outline: "none" }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>Image URL</div>
                                  <input type="text" value={entry.embed.image_url}
                                    onChange={(e) => updateEntry(entry.id, { embed: { ...entry.embed, image_url: e.target.value } })}
                                    placeholder="https://..."
                                    style={{ width: "100%", borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.bg, padding: "6px 8px", fontSize: 12, color: C.text, outline: "none" }} />
                                </div>
                              </div>
                            </div>

                            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 6 }}>Footer & Timestamp</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                                  <input type="text" value={entry.embed.footer_text}
                                    onChange={(e) => updateEntry(entry.id, { embed: { ...entry.embed, footer_text: e.target.value } })}
                                    placeholder="Footer text"
                                    style={{ borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.bg, padding: "6px 8px", fontSize: 12, color: C.text, outline: "none" }} />
                                  <input type="text" value={entry.embed.footer_icon_url}
                                    onChange={(e) => updateEntry(entry.id, { embed: { ...entry.embed, footer_icon_url: e.target.value } })}
                                    placeholder="Icon URL"
                                    style={{ borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.bg, padding: "6px 8px", fontSize: 12, color: C.text, outline: "none" }} />
                                </div>
                                <input type="datetime-local" value={entry.embed.timestamp}
                                  onChange={(e) => updateEntry(entry.id, { embed: { ...entry.embed, timestamp: e.target.value } })}
                                  style={{ borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.bg, padding: "6px 8px", fontSize: 12, color: C.text, outline: "none" }} />
                              </div>
                            </div>
                          </div>
                        )}

                        {editTab === "components" && (
                          <ComponentEditor rows={entry.components}
                            onChange={(components) => updateEntry(entry.id, { components })} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick add buttons at bottom */}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" onClick={addEntry}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "10px 0", borderRadius: 8, fontSize: 12, fontWeight: 500,
                  border: `1px dashed ${C.border}`, backgroundColor: "transparent",
                  color: C.textMuted, cursor: "pointer", transition: "all 0.15s",
                }}>
                <Plus style={{ width: 14, height: 14 }} /> Add Message
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{
                borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.card, padding: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: C.textMuted }}>
                    <Save style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
                    Presets ({presets.length})
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input type="text" value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset name..."
                    style={{
                      flex: 1, borderRadius: 6,
                      border: `1px solid ${C.border}`, backgroundColor: C.bg,
                      padding: "6px 10px", fontSize: 12, color: C.text, outline: "none",
                    }} />
                  <button type="button" onClick={() => savePreset("draft")}
                    style={{ borderRadius: 6, padding: "6px 12px", fontSize: 10, fontWeight: 500, backgroundColor: `${C.burg}20`, color: C.burg, border: "none", cursor: "pointer" }}>
                    Draft
                  </button>
                  <button type="button" onClick={() => savePreset("template")}
                    style={{ borderRadius: 6, padding: "6px 12px", fontSize: 10, fontWeight: 500, backgroundColor: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "none", cursor: "pointer" }}>
                    Template
                  </button>
                </div>
                {presets.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 100, overflowY: "auto" }}>
                    {presets.map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.bg, padding: "6px 10px" }}>
                        <button type="button" onClick={() => loadPreset(p)}
                          style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.textMuted }}>
                          {p.name}
                        </button>
                        <span style={{ fontSize: 9, color: p.kind === "template" ? "#a78bfa" : C.burg }}>{p.kind === "template" ? "T" : "D"}</span>
                        <button type="button" onClick={() => deletePreset(p.id)} style={{ color: "#52525b", background: "none", border: "none", cursor: "pointer" }}>
                          <X style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: C.textMuted, paddingBottom: 16 }}>
              <Megaphone style={{ width: 14, height: 14, color: "#3f3f46" }} />
              <span>Announcements Studio</span>
              <span style={{ color: "#27272a" }}>&middot;</span>
              <span>{form.entries.length} message{form.entries.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANE - Preview */}
        <div style={{ width: "50%", display: "flex", flexDirection: "column", backgroundColor: C.discBg }}>
          {/* Send button at top of preview */}
          <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.discEmbed}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>
              <Eye style={{ width: 14, height: 14, display: "inline", marginRight: 6 }} />
              Preview
            </span>
            <button type="button" onClick={() => setSendModalOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                backgroundColor: C.burg, color: "#fff", border: "none", cursor: "pointer",
                transition: "all 0.15s",
              }}>
              <Send style={{ width: 14, height: 14 }} />
              Send
            </button>
          </div>

          {/* Scrollable preview */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }} className="scrollbar-thin">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {form.entries.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center" }}>
                  <Eye style={{ width: 48, height: 48, color: "#52525b", marginBottom: 16 }} />
                  <p style={{ fontSize: 14, color: "#71717a" }}>No messages yet</p>
                  <p style={{ fontSize: 12, color: "#52525b" }}>Add a message to see the preview</p>
                </div>
              ) : (
                form.entries.map((entry, i) => {
                  const isSelected = previewEntryId === entry.id;
                  const isContainer = !entry.embed.color;
                  return (
                    <div key={entry.id} ref={(el) => { msgRefs.current[`preview-${entry.id}`] = el; }}
                      style={{
                        borderRadius: 8,
                        border: isSelected ? `1px solid ${C.burg}40` : "1px solid transparent",
                        backgroundColor: isSelected ? `${C.burg}08` : "transparent",
                        transition: "all 0.15s",
                        cursor: "pointer",
                      }}
                      onClick={() => setPreviewEntryId(entry.id)}>
                      <DiscordMessagePreview entry={entry} />
                      {isContainer && entry.embed.title ? (
                        <DiscordContainer embed={entry.embed} />
                      ) : (
                        <DiscordEmbed entry={entry} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({ icon, tooltip, onClick }: { icon: ReactNode; tooltip: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button type="button" onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, borderRadius: 8,
          border: `1px solid ${hovered ? "#3f3f46" : C.border}`,
          backgroundColor: "transparent",
          color: hovered ? C.text : C.textMuted,
          cursor: "pointer", transition: "all 0.15s",
        }}>
        {icon}
      </button>
      {hovered && (
        <div style={{
          position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
          marginBottom: 6, padding: "4px 10px", borderRadius: 6,
          backgroundColor: "#18181b", color: C.text,
          fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
          border: `1px solid ${C.border}`,
          zIndex: 100, pointerEvents: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}>
          {tooltip}
        </div>
      )}
    </div>
  );
}

const SAMPLE_CHANNELS: GuildChannel[] = [
  { id: "1", name: "announcements", type: 0 },
  { id: "2", name: "general", type: 0 },
  { id: "3", name: "updates", type: 0 },
  { id: "4", name: "dev-log", type: 0 },
  { id: "5", name: "community", type: 0 },
];
