import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { BoneyardCard } from "@/components/ui/boneyard-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Megaphone, Plus, Copy, Trash2, ChevronDown, ChevronUp,
  Send, Save, Eye, X, Palette, ExternalLink, GripVertical,
  Bot,
} from "lucide-react";

type ModuleRow = { name: string; display_name?: string; description?: string; category?: string; enabled?: boolean; config?: Record<string, any> };
type GuildChannel = { id: string; name: string; type: number };
type GuildRole = { id: string; name: string; color: number; managed: boolean; editable: boolean; position: number };
type GuildEmoji = { id: string; name: string; animated: boolean; mention: string; url: string };
type SaveState = "idle" | "success" | "error" | "info" | "sending";

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

type AnnouncementField = { name: string; value: string; inline: boolean };

type AnnouncementEmbed = {
  title: string; description: string; url: string; color: string;
  author_name: string; author_icon_url: string; author_url: string;
  fields: AnnouncementField[];
  footer_text: string; footer_icon_url: string;
  image_url: string; thumbnail_url: string; timestamp: string;
};

type AnnouncementEntry = {
  id: string; content: string; embed: AnnouncementEmbed;
  components: AnnouncementComponent[][];
  edit_existing: boolean; message_link: string;
};

type AnnouncementForm = { channel_ids: string[]; entries: AnnouncementEntry[] };

type AnnouncementPreset = {
  id: string; name: string; kind: "draft" | "template"; form: AnnouncementForm;
};

type AnnouncementEmojiTarget =
  | { kind: "normal"; entryId: string }
  | { kind: "embedTitle"; entryId: string }
  | { kind: "embedDescription"; entryId: string }
  | { kind: "embedFooter"; entryId: string };

const ACCENT_COLOR = "#06b6d4";
const EMBED_BG = "#2b2d31";
const CHANNEL_TEXT_COLOR = "#dbdee1";

const BUTTON_STYLES: Record<number, { label: string; color: string; bg: string; border: string }> = {
  1: { label: "Primary", color: "#fff", bg: "#5865f2", border: "#5865f2" },
  2: { label: "Secondary", color: "#dbdee1", bg: "#4e5058", border: "#4e5058" },
  3: { label: "Success", color: "#fff", bg: "#248046", border: "#248046" },
  4: { label: "Danger", color: "#fff", bg: "#da373c", border: "#da373c" },
  5: { label: "Link", color: "#00a8fc", bg: "transparent", border: "#00a8fc" },
};

const EMBED_PRESETS = [
  { label: "Green", value: "#57f287" }, { label: "Red", value: "#ed4245" },
  { label: "Blue", value: "#5865f2" }, { label: "Yellow", value: "#fee75c" },
  { label: "Orange", value: "#f57c00" }, { label: "Purple", value: "#9b59b6" },
  { label: "Pink", value: "#eb459e" }, { label: "Teal", value: "#1abc9c" },
  { label: "White", value: "#ffffff" }, { label: "Black", value: "#000000" },
];

const EMPTY_EMBED: AnnouncementEmbed = {
  title: "", description: "", url: "", color: "#57f287",
  author_name: "", author_icon_url: "", author_url: "",
  fields: [], footer_text: "", footer_icon_url: "",
  image_url: "", thumbnail_url: "", timestamp: "",
};

function createEntry(): AnnouncementEntry {
  return {
    id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content: "", embed: { ...EMPTY_EMBED, fields: [] },
    components: [], edit_existing: false, message_link: "",
  };
}

function formatTimestamp(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  } catch { return iso; }
}

function renderDiscordText(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /<a?:([a-zA-Z0-9_]+):(\d+)>/g;
  let lastIndex = 0, match: RegExpExecArray | null = null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<span key={`e-${match.index}`} className="inline-flex items-center gap-0.5 rounded bg-white/5 px-1 text-xs text-zinc-300">:{match[1]}:</span>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : [text];
}

function DiscordMessagePreview({ entry }: { entry: AnnouncementEntry }) {
  const hasContent = entry.content.trim().length > 0;
  const hasEmbed = Boolean(entry.embed.title || entry.embed.description || entry.embed.fields.length || entry.embed.image_url || entry.embed.thumbnail_url || entry.embed.footer_text || entry.embed.author_name);
  const hasComponents = entry.components.length > 0 && entry.components.some((r) => r.length > 0);

  if (!hasContent && !hasEmbed && !hasComponents) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg px-6 py-12 text-center" style={{ backgroundColor: EMBED_BG }}>
        <Eye className="mb-3 h-10 w-10 text-zinc-600" />
        <p className="text-sm text-zinc-500">Your message preview will appear here</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg px-4 py-3 text-sm leading-relaxed" style={{ backgroundColor: EMBED_BG }}>
      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-500 text-sm font-bold text-white">A</div>
        <div>
          <span className="font-semibold" style={{ color: ACCENT_COLOR }}>AOI Bot</span>
          <span className="ml-2 text-zinc-500">Today at 12:00 AM</span>
        </div>
      </div>

      {hasContent && <div className="whitespace-pre-wrap text-[15px]" style={{ color: CHANNEL_TEXT_COLOR }}>{renderDiscordText(entry.content)}</div>}

      {hasEmbed && (
        <div className={`overflow-hidden rounded-lg border-l-4 ${hasContent ? "mt-2" : ""}`} style={{ borderLeftColor: entry.embed.color || "#57f287", backgroundColor: "#2f3136" }}>
          <div className="px-3 py-2">
            {entry.embed.author_name && (
              <div className="mb-1 flex items-center gap-2 text-xs text-zinc-400">
                {entry.embed.author_icon_url && <img src={entry.embed.author_icon_url} alt="" className="h-4 w-4 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                {entry.embed.author_url ? (
                  <a href={entry.embed.author_url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: "#00a8fc" }}>{entry.embed.author_name}</a>
                ) : <span className="font-semibold text-white">{entry.embed.author_name}</span>}
              </div>
            )}
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                {entry.embed.title && (
                  <div className="mb-1">
                    {entry.embed.url ? (
                      <a href={entry.embed.url} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold hover:underline" style={{ color: "#00a8fc" }}>{renderDiscordText(entry.embed.title)}</a>
                    ) : <h3 className="text-lg font-semibold text-white">{renderDiscordText(entry.embed.title)}</h3>}
                  </div>
                )}
                {entry.embed.description && <div className="whitespace-pre-wrap text-sm" style={{ color: CHANNEL_TEXT_COLOR }}>{renderDiscordText(entry.embed.description)}</div>}
                {entry.embed.fields.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {entry.embed.fields.map((f, i) => (
                      <div key={i} className={f.inline ? "col-span-1" : "col-span-3"}>
                        <div className="text-xs font-semibold text-white">{renderDiscordText(f.name)}</div>
                        <div className="whitespace-pre-wrap text-xs" style={{ color: CHANNEL_TEXT_COLOR }}>{renderDiscordText(f.value)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {entry.embed.image_url && <img src={entry.embed.image_url} alt="" className="mt-2 max-h-80 w-full rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
              </div>
              {entry.embed.thumbnail_url && <img src={entry.embed.thumbnail_url} alt="" className="mt-1 h-20 w-20 flex-shrink-0 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
            </div>
            {(entry.embed.footer_text || entry.embed.timestamp) && (
              <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                {entry.embed.footer_icon_url && <img src={entry.embed.footer_icon_url} alt="" className="h-4 w-4 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
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
                const s = BUTTON_STYLES[comp.style] || BUTTON_STYLES[1];
                if (comp.type === "button") {
                  if (comp.style === 5) {
                    return (
                      <a key={ci} href={comp.url || "#"} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm font-medium transition-colors hover:brightness-110"
                        style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                        {comp.emoji?.name && <span>{comp.emoji.name}</span>}{comp.label || "Link"}<ExternalLink className="h-3 w-3" />
                      </a>
                    );
                  }
                  return (
                    <button key={ci} type="button" disabled={comp.disabled}
                      className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm font-medium transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                      {comp.emoji?.name && <span>{comp.emoji.name}</span>}{comp.label || "Button"}
                    </button>
                  );
                }
                return (
                  <div key={ci} className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm text-zinc-400" style={{ backgroundColor: "#4e5058" }}>
                    <ChevronDown className="h-3 w-3" />{comp.placeholder || "Select an option"}
                  </div>
                );
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
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) { document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler); }
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="flex h-8 w-12 items-center justify-center rounded border border-zinc-700" style={{ backgroundColor: value }}>
        <ChevronDown className="h-3 w-3 text-white/70" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
          <div className="mb-2 grid grid-cols-5 gap-1">
            {EMBED_PRESETS.map((p) => (
              <button key={p.value} type="button" title={p.label}
                onClick={() => { onChange(p.value); setOpen(false); }}
                className="h-6 w-full rounded border border-zinc-700 hover:scale-110 hover:border-white" style={{ backgroundColor: p.value }} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">#</span>
            <input type="text" value={value.replace("#", "")}
              onChange={(e) => { const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6); if (v.length <= 6) onChange(`#${v}`); }}
              className="flex-1 rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200" placeholder="000000" />
          </div>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 h-6 w-full cursor-pointer rounded border border-zinc-700" />
        </div>
      )}
    </div>
  );
}

function StatusBanner({ status }: { status: { state: SaveState; text: string } | null }) {
  if (!status || status.state === "idle") return null;
  const colors: Record<string, string> = {
    success: "border-emerald-700/60 bg-emerald-500/10 text-emerald-300",
    error: "border-red-700/60 bg-red-500/10 text-red-300",
    info: "border-sky-700/60 bg-sky-500/10 text-sky-300",
    sending: "border-amber-700/60 bg-amber-500/10 text-amber-300",
  };
  return <div className={`rounded-lg border px-3 py-2 text-sm ${colors[status.state] || "text-zinc-400"}`}>{status.text}</div>;
}

function FieldEditor({ fields, onChange }: { fields: AnnouncementField[]; onChange: (f: AnnouncementField[]) => void }) {
  return (
    <div className="space-y-2">
      {fields.map((f, i) => (
        <div key={i} className="rounded-lg border border-zinc-800 bg-black/50 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-zinc-500">Field {i + 1}</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-zinc-400">
                <input type="checkbox" checked={f.inline} onChange={(e) => onChange(fields.map((x, j) => j === i ? { ...x, inline: e.target.checked } : x))} className="h-3 w-3 rounded border-zinc-700 bg-zinc-800" />
                Inline
              </label>
              <button type="button" onClick={() => onChange(fields.filter((_, j) => j !== i))} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
            </div>
          </div>
          <input type="text" value={f.name} placeholder="Field name" onChange={(e) => onChange(fields.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
            className="mb-1 w-full rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600" />
          <textarea value={f.value} placeholder="Field value" rows={2} onChange={(e) => onChange(fields.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
            className="w-full rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 resize-none" />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...fields, { name: "", value: "", inline: false }])}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 py-1.5 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300">
        <Plus className="h-3 w-3" /> Add Field
      </button>
    </div>
  );
}

function ComponentEditor({ rows, onChange }: { rows: AnnouncementComponent[][]; onChange: (r: AnnouncementComponent[][]) => void }) {
  const addRow = () => onChange([...rows, []]);
  const removeRow = (ri: number) => onChange(rows.filter((_, i) => i !== ri));
  const addButton = (ri: number, style = 1) => {
    onChange(rows.map((row, i) => i !== ri ? row : (row.length >= 5 ? row : [...row, { type: "button" as const, style, label: "", custom_id: `btn_${Date.now()}`, url: "", emoji: null, disabled: false, options: [], placeholder: "", min_values: 1, max_values: 1 }])));
  };
  const addSelect = (ri: number) => {
    onChange(rows.map((row, i) => i !== ri ? row : (row.length >= 5 ? row : [...row, { type: "select" as const, style: 1, label: "", custom_id: `select_${Date.now()}`, url: "", emoji: null, disabled: false, options: [], placeholder: "Choose an option", min_values: 1, max_values: 1 }])));
  };
  const removeComp = (ri: number, ci: number) => onChange(rows.map((row, i) => i === ri ? row.filter((_, j) => j !== ci) : row));
  const updateComp = (ri: number, ci: number, updates: Partial<AnnouncementComponent>) => onChange(rows.map((row, i) => i === ri ? row.map((c, j) => j === ci ? { ...c, ...updates } : c) : row));

  return (
    <div className="space-y-2">
      {rows.map((row, ri) => (
        <div key={ri} className="rounded-lg border border-zinc-800 bg-black/50 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Row {ri + 1} ({row.length}/5)</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => addButton(ri)} className="rounded px-2 py-0.5 text-[10px] uppercase text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">+ Button</button>
              <button type="button" onClick={() => addSelect(ri)} className="rounded px-2 py-0.5 text-[10px] uppercase text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">+ Select</button>
              {rows.length > 1 && <button type="button" onClick={() => removeRow(ri)} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>}
            </div>
          </div>
          {row.length === 0 ? (
            <div className="py-2 text-center text-[10px] text-zinc-600">Empty row</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {row.map((comp, ci) => (
                <div key={ci} className="relative rounded border border-zinc-700 bg-zinc-800/50 p-1.5">
                  <button type="button" onClick={() => removeComp(ri, ci)} className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] text-white"><X className="h-2 w-2" /></button>
                  {comp.type === "button" ? (
                    <div className="space-y-1 text-[10px]">
                      <select value={comp.style} onChange={(e) => updateComp(ri, ci, { style: Number(e.target.value) })}
                        className="w-full rounded border border-zinc-700 bg-black px-1 py-0.5 text-[10px] text-zinc-300">
                        {Object.entries(BUTTON_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <input type="text" value={comp.label} placeholder="Label" onChange={(e) => updateComp(ri, ci, { label: e.target.value })}
                        className="w-full rounded border border-zinc-700 bg-black px-1 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600" />
                      {comp.style === 5 ? (
                        <input type="text" value={comp.url} placeholder="https://..." onChange={(e) => updateComp(ri, ci, { url: e.target.value })}
                          className="w-full rounded border border-zinc-700 bg-black px-1 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600" />
                      ) : (
                        <input type="text" value={comp.custom_id} placeholder="Custom ID" onChange={(e) => updateComp(ri, ci, { custom_id: e.target.value })}
                          className="w-full rounded border border-zinc-700 bg-black px-1 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600" />
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1 text-[10px]">
                      <input type="text" value={comp.placeholder} placeholder="Placeholder" onChange={(e) => updateComp(ri, ci, { placeholder: e.target.value })}
                        className="w-full rounded border border-zinc-700 bg-black px-1 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600" />
                      <input type="text" value={comp.custom_id} placeholder="Custom ID" onChange={(e) => updateComp(ri, ci, { custom_id: e.target.value })}
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

function normalizeAnnouncementPresets(raw: any): AnnouncementPreset[] {
  const presets = raw?.announcements_studio?.presets;
  if (!Array.isArray(presets)) return [];
  return presets.map((p: any) => ({
    id: String(p.id || ""), name: String(p.name || ""), kind: p.kind === "template" ? "template" : "draft" as const,
    form: p.form || { channel_ids: [], entries: [] },
  }));
}

export default function GuildAnnouncementsPage() {
  const router = useRouter();
  const { guildId } = router.query;

  const [loading, setLoading] = useState(true);
  const [guild, setGuild] = useState<Record<string, any> | null>(null);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [roles, setRoles] = useState<GuildRole[]>([]);
  const [emojis, setEmojis] = useState<GuildEmoji[]>([]);
  const [communityModule, setCommunityModule] = useState<ModuleRow | null>(null);

  const [form, setForm] = useState<AnnouncementForm>({ channel_ids: [], entries: [createEntry()] });
  const [presets, setPresets] = useState<AnnouncementPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [status, setStatus] = useState<{ state: SaveState; text: string } | null>(null);
  const [editTab, setEditTab] = useState<"content" | "embed" | "components">("content");
  const [previewEntryId, setPreviewEntryId] = useState<string>("");
  const [emojiTarget, setEmojiTarget] = useState<AnnouncementEmojiTarget | null>(null);

  const activeEntry = useMemo(() => form.entries.find((e) => e.id === previewEntryId), [form.entries, previewEntryId]);

  useEffect(() => {
    if (!guildId || typeof guildId !== "string") return;
    async function load() {
      try {
        const [ovRes, chRes, roRes, emRes] = await Promise.all([
          fetch(`/api/dashboard/guild/${guildId}/overview`),
          fetch(`/api/guilds/${guildId}/channels`),
          fetch(`/api/guilds/${guildId}/roles`),
          fetch(`/api/guilds/${guildId}/emojis`),
        ]);
        if ([ovRes.status, chRes.status, roRes.status, emRes.status].some((s) => s === 401)) {
          router.replace("/api/auth/discord"); return;
        }
        const ov = await ovRes.json();
        const ch = await chRes.json().catch(() => ({ channels: [] }));
        const ro = await roRes.json().catch(() => ({ roles: [] }));
        const em = await emRes.json().catch(() => ({ emojis: [] }));
        setGuild(ov.guild);
        setModules(ov.modules || []);
        setChannels(Array.isArray(ch.channels) ? ch.channels.filter((c: GuildChannel) => c.type === 0) : []);
        setRoles(Array.isArray(ro.roles) ? ro.roles : []);
        setEmojis(Array.isArray(em.emojis) ? em.emojis : []);

        const community = (ov.modules || []).find((m: ModuleRow) => m.name === "community");
        setCommunityModule(community);
        const savedPresets = normalizeAnnouncementPresets(community?.config);
        setPresets(savedPresets);
      } catch (err) {
        console.error("Failed to load guild data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [guildId, router]);

  useEffect(() => {
    if (form.entries.length > 0 && !previewEntryId) {
      setPreviewEntryId(form.entries[0].id);
    }
  }, [form.entries, previewEntryId]);

  const updateForm = useCallback((updates: Partial<AnnouncementForm>) => setForm((c) => ({ ...c, ...updates })), []);
  const updateEntry = useCallback((entryId: string, updates: Partial<AnnouncementEntry>) => {
    setForm((c) => ({ ...c, entries: c.entries.map((e) => e.id === entryId ? { ...e, ...updates } : e) }));
  }, []);
  const addEntry = useCallback(() => {
    const e = createEntry(); setForm((c) => ({ ...c, entries: [...c.entries, e] })); setPreviewEntryId(e.id);
  }, []);
  const duplicateEntry = useCallback((entryId: string) => {
    setForm((c) => {
      const s = c.entries.find((e) => e.id === entryId); if (!s) return c;
      const d = { ...s, id: createEntry().id };
      const idx = c.entries.findIndex((e) => e.id === entryId);
      const next = [...c.entries]; next.splice(idx + 1, 0, d); return { ...c, entries: next };
    });
  }, []);
  const removeEntry = useCallback((entryId: string) => {
    setForm((c) => {
      const next = c.entries.filter((e) => e.id !== entryId);
      if (next.length === 0) { const f = createEntry(); setPreviewEntryId(f.id); return { ...c, entries: [f] }; }
      if (previewEntryId === entryId) setPreviewEntryId(next[0].id);
      return { ...c, entries: next };
    });
  }, [previewEntryId]);
  const moveEntry = useCallback((id: string, dir: "up" | "down") => {
    setForm((c) => {
      const idx = c.entries.findIndex((e) => e.id === id);
      if (idx === -1) return c;
      const t = dir === "up" ? idx - 1 : idx + 1;
      if (t < 0 || t >= c.entries.length) return c;
      const next = [...c.entries]; [next[idx], next[t]] = [next[t], next[idx]]; return { ...c, entries: next };
    });
  }, []);
  const toggleChannel = useCallback((id: string) => {
    setForm((c) => {
      const s = new Set(c.channel_ids);
      if (s.has(id)) s.delete(id); else s.add(id);
      return { ...c, channel_ids: Array.from(s) };
    });
  }, []);

  const persistPresets = useCallback(async (next: AnnouncementPreset[]) => {
    if (!guildId || typeof guildId !== "string" || !communityModule) return;
    const config = communityModule.config || {};
    const payload = { ...config, announcements_studio: { presets: next.map((p) => ({ id: p.id, name: p.name, kind: p.kind, form: p.form })) } };
    await fetch(`/api/modules/${guildId}/community`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: payload }),
    });
  }, [guildId, communityModule]);

  const savePreset = useCallback(async (kind: AnnouncementPreset["kind"]) => {
    const name = presetName.trim().slice(0, 80);
    if (!name) { setStatus({ state: "error", text: "Enter a name before saving." }); return; }
    const idx = presets.findIndex((p) => p.kind === kind && p.name.toLowerCase() === name.toLowerCase());
    const next = [...presets];
    const preset: AnnouncementPreset = {
      id: idx >= 0 ? next[idx].id : `preset-${Date.now()}`,
      name, kind,
      form: JSON.parse(JSON.stringify(form)),
    };
    if (idx >= 0) next[idx] = preset; else next.unshift(preset);
    try { await persistPresets(next); setPresets(next); setStatus({ state: "success", text: `${kind === "template" ? "Template" : "Draft"} saved.` }); }
    catch (e) { setStatus({ state: "error", text: e instanceof Error ? e.message : "Failed to save preset." }); }
  }, [presetName, presets, form, persistPresets]);

  const loadPreset = useCallback((preset: AnnouncementPreset) => {
    setForm(JSON.parse(JSON.stringify(preset.form)));
    setPresetName(preset.name);
    setPreviewEntryId(preset.form.entries[0]?.id || "");
    setStatus({ state: "info", text: `Loaded ${preset.kind} "${preset.name}".` });
  }, []);

  const deletePreset = useCallback(async (id: string) => {
    const next = presets.filter((p) => p.id !== id);
    try { await persistPresets(next); setPresets(next); setStatus({ state: "success", text: "Preset removed." }); }
    catch (e) { setStatus({ state: "error", text: e instanceof Error ? e.message : "Failed to delete preset." }); }
  }, [presets, persistPresets]);

  const handleSend = useCallback(async () => {
    if (!guildId || typeof guildId !== "string") return;
    if (form.entries.length === 0) { setStatus({ state: "error", text: "Add at least one message." }); return; }
    if (form.channel_ids.length === 0) { setStatus({ state: "error", text: "Select at least one channel." }); return; }
    setStatus({ state: "sending", text: "Sending announcement..." });
    try {
      const res = await fetch(`/api/guilds/${guildId}/announcements`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to send");
      setStatus({ state: "success", text: "Announcement sent successfully!" });
    } catch (err) {
      setStatus({ state: "error", text: err instanceof Error ? err.message : "Failed to send" });
    }
  }, [guildId, form]);

  const appendEmoji = useCallback((target: AnnouncementEmojiTarget | null, emojiText: string) => {
    if (!target) return;
    setForm((c) => ({
      ...c,
      entries: c.entries.map((entry) => {
        if (entry.id !== target.entryId) return entry;
        if (target.kind === "normal") return { ...entry, content: entry.content + emojiText };
        if (target.kind === "embedTitle") return { ...entry, embed: { ...entry.embed, title: entry.embed.title + emojiText } };
        if (target.kind === "embedDescription") return { ...entry, embed: { ...entry.embed, description: entry.embed.description + emojiText } };
        if (target.kind === "embedFooter") return { ...entry, embed: { ...entry.embed, footer_text: entry.embed.footer_text + emojiText } };
        return entry;
      }),
    }));
  }, []);

  if (loading) {
    return (
      <DashboardLayout guildId={String(guildId || "")} guildName="Guild" heading="Announcements" modules={[]}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <BoneyardCard lines={6} /><BoneyardCard lines={6} /><BoneyardCard lines={6} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout guildId={String(guildId || "")} guildName={guild?.name || "Guild"} heading="Announcements" modules={modules}>
      <div className="flex items-center gap-4 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Megaphone className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Announcements</h1>
          <p className="text-muted-foreground">Compose and send rich announcements with embeds, buttons, select menus, and more.</p>
        </div>
      </div>

      <StatusBanner status={status} />

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">

        {/* Editor */}
        <div className="dashboard-panel rounded-2xl p-5 space-y-6">

          {/* Messages list */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Messages ({form.entries.length})</h2>
              <button type="button" onClick={addEntry} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20">
                <Plus className="h-3 w-3" /> Add Message
              </button>
            </div>
            <div className="space-y-1">
              {form.entries.map((entry, i) => (
                <div key={entry.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  previewEntryId === entry.id ? "border-primary/40 bg-primary/5" : "border-border/60 bg-background/50 hover:bg-background/80"
                }`}>
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => moveEntry(entry.id, "up")} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                    <button type="button" onClick={() => moveEntry(entry.id, "down")} disabled={i === form.entries.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
                  </div>
                  <button type="button" onClick={() => setPreviewEntryId(entry.id)} className="min-w-0 flex-1 text-left truncate text-foreground/80">
                    {entry.content.trim() || entry.embed.title.trim() || entry.embed.description.trim() || `Message ${i + 1}`}
                  </button>
                  <button type="button" onClick={() => duplicateEntry(entry.id)} title="Duplicate" className="text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => removeEntry(entry.id)} title="Remove" className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </section>

          {/* Channel picker */}
          <section>
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Target Channels ({form.channel_ids.length})</h2>
            <div className="rounded-xl border border-border/60 bg-background/40 p-3 max-h-48 overflow-y-auto">
              {channels.length === 0 ? (
                <div className="text-xs text-muted-foreground">No text channels available.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {channels.map((ch) => (
                    <button key={ch.id} type="button" onClick={() => toggleChannel(ch.id)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                        form.channel_ids.includes(ch.id) ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
                      }`}>
                      # {ch.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Active entry editor */}
          {activeEntry && (
            <section>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Edit Message</h2>
              <div className="mb-3 flex gap-1 rounded-lg border border-border/60 bg-background/40 p-1">
                {(["content", "embed", "components"] as const).map((tab) => (
                  <button key={tab} type="button" onClick={() => setEditTab(tab)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      editTab === tab ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    {tab === "content" ? "Content" : tab === "embed" ? "Embed" : "Components"}
                  </button>
                ))}
              </div>

              {editTab === "content" && (
                <div className="space-y-3">
                  <Textarea value={activeEntry.content} onChange={(e) => updateEntry(activeEntry.id, { content: e.target.value })}
                    placeholder="Type your announcement message here..." rows={4}
                    className="w-full border-border/60 bg-background/50 text-foreground placeholder:text-muted-foreground resize-none" />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={activeEntry.edit_existing} onChange={(e) => updateEntry(activeEntry.id, { edit_existing: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-border bg-background" />
                    Edit existing message
                  </label>
                  {activeEntry.edit_existing && (
                    <Input type="text" value={activeEntry.message_link} onChange={(e) => updateEntry(activeEntry.id, { message_link: e.target.value })}
                      placeholder="https://discord.com/channels/..."
                      className="border-border/60 bg-background/50 text-foreground placeholder:text-muted-foreground" />
                  )}
                </div>
              )}

              {editTab === "embed" && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <input type="text" value={activeEntry.embed.title} onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, title: e.target.value } })}
                        placeholder="Embed title" className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                      <input type="text" value={activeEntry.embed.url} onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, url: e.target.value } })}
                        placeholder="Title URL (optional)" className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                      <textarea value={activeEntry.embed.description} onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, description: e.target.value } })}
                        placeholder="Embed description" rows={3}
                        className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none" />
                    </div>
                    <div className="flex flex-col items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-muted-foreground">Color</span>
                      <ColorSwatch value={activeEntry.embed.color} onChange={(v) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, color: v } })} />
                    </div>
                  </div>

                  <div className="border-t border-border/60 pt-3">
                    <h3 className="mb-2 text-xs font-medium text-foreground/80">Author</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={activeEntry.embed.author_name} onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, author_name: e.target.value } })}
                        placeholder="Author name" className="rounded border border-border/60 bg-background/50 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
                      <input type="text" value={activeEntry.embed.author_icon_url} onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, author_icon_url: e.target.value } })}
                        placeholder="Icon URL" className="rounded border border-border/60 bg-background/50 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
                      <input type="text" value={activeEntry.embed.author_url} onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, author_url: e.target.value } })}
                        placeholder="Author URL" className="rounded border border-border/60 bg-background/50 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
                    </div>
                  </div>

                  <div className="border-t border-border/60 pt-3">
                    <h3 className="mb-2 text-xs font-medium text-foreground/80">Fields ({activeEntry.embed.fields.length}/25)</h3>
                    <FieldEditor fields={activeEntry.embed.fields} onChange={(fields) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, fields } })} />
                  </div>

                  <div className="border-t border-border/60 pt-3">
                    <h3 className="mb-2 text-xs font-medium text-foreground/80">Images</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="mb-1 block text-[10px] text-muted-foreground">Thumbnail URL</label>
                        <input type="text" value={activeEntry.embed.thumbnail_url} onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, thumbnail_url: e.target.value } })}
                          placeholder="https://..." className="w-full rounded border border-border/60 bg-background/50 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" /></div>
                      <div><label className="mb-1 block text-[10px] text-muted-foreground">Image URL</label>
                        <input type="text" value={activeEntry.embed.image_url} onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, image_url: e.target.value } })}
                          placeholder="https://..." className="w-full rounded border border-border/60 bg-background/50 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" /></div>
                    </div>
                  </div>

                  <div className="border-t border-border/60 pt-3">
                    <h3 className="mb-2 text-xs font-medium text-foreground/80">Footer &amp; Timestamp</h3>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={activeEntry.embed.footer_text} onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, footer_text: e.target.value } })}
                          placeholder="Footer text" className="rounded border border-border/60 bg-background/50 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
                        <input type="text" value={activeEntry.embed.footer_icon_url} onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, footer_icon_url: e.target.value } })}
                          placeholder="Icon URL" className="rounded border border-border/60 bg-background/50 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
                      </div>
                      <input type="datetime-local" value={activeEntry.embed.timestamp} onChange={(e) => updateEntry(activeEntry.id, { embed: { ...activeEntry.embed, timestamp: e.target.value } })}
                        className="w-full rounded border border-border/60 bg-background/50 px-2 py-1.5 text-xs text-foreground focus:outline-none" />
                    </div>
                  </div>
                </div>
              )}

              {editTab === "components" && (
                <ComponentEditor rows={activeEntry.components} onChange={(components) => updateEntry(activeEntry.id, { components })} />
              )}
            </section>
          )}
        </div>

        {/* Preview + Controls */}
        <div className="space-y-4">
          <div className="dashboard-panel rounded-2xl p-5">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Preview</h2>
            {activeEntry ? (
              <DiscordMessagePreview entry={activeEntry} />
            ) : (
              <div className="flex items-center justify-center rounded-lg bg-background/50 py-12 text-sm text-muted-foreground">Select a message to preview</div>
            )}
          </div>

          {/* Emoji picker */}
          {emojis.length > 0 && (
            <div className="dashboard-panel rounded-2xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Emoji Picker</h2>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {emojis.map((emo) => (
                  <button key={emo.id} type="button" title={`:${emo.name}:`}
                    onClick={() => appendEmoji(emojiTarget, emo.mention)}
                    className={`rounded border p-1 transition-colors ${emojiTarget ? "hover:border-primary/50 hover:bg-primary/10" : "opacity-50 cursor-not-allowed"} ${emojiTarget?.entryId === activeEntry?.id ? "border-primary/30" : "border-border/60"}`}>
                    <img src={emo.url} alt={emo.name} className="h-6 w-6 object-contain" />
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">Click a field first to target emoji insertion</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {(["normal", "embedTitle", "embedDescription", "embedFooter"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => activeEntry && setEmojiTarget(emojiTarget?.kind === k && emojiTarget.entryId === activeEntry.id ? null : { kind: k, entryId: activeEntry.id })}
                    className={`rounded px-2 py-0.5 text-[10px] border transition-colors ${
                      emojiTarget?.kind === k && emojiTarget.entryId === activeEntry?.id ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
                    }`}>
                    {k === "normal" ? "Content" : k.replace("embed", "Embed ")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Presets */}
          <div className="dashboard-panel rounded-2xl p-5">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Presets</h2>
            <div className="flex gap-2">
              <input type="text" value={presetName} onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name..." className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
              <button type="button" onClick={() => savePreset("draft")} className="rounded-lg px-3 py-2 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20">
                <Save className="mr-1 inline h-3 w-3" />Draft
              </button>
              <button type="button" onClick={() => savePreset("template")} className="rounded-lg px-3 py-2 text-xs font-medium text-violet-400 hover:bg-violet-500/10" style={{ backgroundColor: "#a78bfa20" }}>
                <Save className="mr-1 inline h-3 w-3" />Template
              </button>
            </div>
            {presets.length > 0 && (
              <div className="mt-3 space-y-1">
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-sm">
                    <span className={`text-[10px] uppercase ${p.kind === "template" ? "text-violet-400" : "text-amber-400"}`}>{p.kind === "template" ? "T" : "D"}</span>
                    <button type="button" onClick={() => loadPreset(p)} className="min-w-0 flex-1 text-left text-foreground/70 hover:text-foreground">{p.name}</button>
                    <button type="button" onClick={() => deletePreset(p.id)} className="text-muted-foreground hover:text-red-400"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Send */}
          <div className="dashboard-panel rounded-2xl p-5">
            <button type="button" onClick={handleSend} disabled={status?.state === "sending"}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: ACCENT_COLOR }}>
              {status?.state === "sending" ? <>Sending...</> : <><Send className="h-4 w-4" /> Send Announcement</>}
            </button>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              {form.channel_ids.length} channel{form.channel_ids.length !== 1 ? "s" : ""} selected · {form.entries.length} message{form.entries.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
