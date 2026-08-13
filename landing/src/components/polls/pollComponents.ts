import type { QueryDataMessageData, APITopLevelComponent, APIV2ChildComponent } from "@/components/announcements/types";
import type { PollDraft, PollOptionDraft, PollType } from "./types";

export type APIV2Component = APITopLevelComponent;

const TYPE_TAGS: Record<PollType, string> = {
  vs: "⚔️ VS",
  music: "🎵 MUSIC",
};

export function emojiObject(emoji: string | null | undefined): { name: string; id?: string; animated?: boolean } | null {
  const raw = (emoji ?? "").trim();
  if (!raw) return null;
  const match = /^<a?:(\w+):(\d+)>$/.exec(raw);
  if (match) {
    return { name: match[1] ?? "", id: match[2], animated: raw.startsWith("<a:") };
  }
  return { name: raw };
}

export function buildResultBar(pct: number): string {
  const filled = Math.round(pct / 10);
  return "▰".repeat(filled) + "▱".repeat(10 - filled);
}

export interface PreviewComponentsOptions {
  mediaUrl?: string | null;
  pollId?: string;
  totals?: Record<string, number>;
  totalVotes?: number;
  status?: "open" | "closed";
  trackCards?: (string | null)[];
  trackCardsLoading?: boolean;
}

/**
 * Mirrors the backend `buildPollComponents` so the studio preview is
 * pixel-identical to what gets posted to Discord.
 */
export function buildPreviewComponents(
  draft: PollDraft,
  opts: PreviewComponentsOptions = {},
): QueryDataMessageData {
  const settings = draft.settings;
  const status = opts.status ?? "open";
  const isMusic = draft.type === "music";
  const totals = draft.options.map((option) => {
    const count = Number(opts.totals?.[option.id]) || 0;
    return { option, count, pct: opts.totalVotes ? Math.round((count / opts.totalVotes) * 100) : 0 };
  });
  const totalVotes = opts.totalVotes ?? 0;

  const showResults =
    settings.show_results === "always" || (settings.show_results === "closed" && status === "closed");

  const typeTag = TYPE_TAGS[draft.type];

  const children: APIV2ChildComponent[] = [];

  if (!isMusic) {
    children.push({ type: 10, content: typeTag });
    children.push({ type: 10, content: draft.title });
    if (draft.subtitle) children.push({ type: 10, content: draft.subtitle });

    if (opts.mediaUrl) {
      children.push({ type: 12, items: [{ media: { url: opts.mediaUrl } }] });
    }
  }

  const instructions: string[] = [];
  if (settings.instructions) instructions.push(settings.instructions);
  if (settings.ends_at) {
    const ts = Math.floor(new Date(settings.ends_at).getTime() / 1000);
    if (Number.isFinite(ts)) instructions.push(`Ends <t:${ts}:R>`);
  }
  if (!isMusic && settings.vote_method === "reactions") {
    instructions.push("React with your choice below.");
  }

  if (instructions.length > 0) {
    children.push({ type: 10, content: instructions.join(" • ") });
  }

  if (isMusic) {
    draft.options.forEach((option, index) => {
      const link = option.track_url ?? "";
      children.push({ type: 10, content: link ? `Would you listen to this [track](${link})?` : `Would you listen to this track?` });
      if (showResults) {
        const listen = Number(opts.totals?.[`${option.id}:listen`] ?? 0);
        const skip = Number(opts.totals?.[`${option.id}:skip`] ?? 0);
        children.push({ type: 10, content: `👍 Listen ${listen} • 👎 Skip ${skip}` });
      }
      const cover = opts.trackCards?.[index] ?? (opts.trackCardsLoading ? "loading://track" : option.image_url ?? null);
      if (cover) {
        children.push({ type: 12, items: [{ media: { url: cover } }] });
      }
    });
  } else if (showResults && totalVotes > 0) {
    children.push({ type: 10, content: `${totalVotes} vote${totalVotes === 1 ? "" : "s"}` });
    for (const { option, count, pct } of totals) {
      const emoji = option.emoji ? `${option.emoji} ` : "";
      children.push({
        type: 10,
        content: `${buildResultBar(pct)} ${emoji}**${option.label}** — ${count} (${pct}%)`,
      });
    }
  } else if (showResults) {
    children.push({ type: 10, content: "No votes yet — be the first!" });
  }

  if (settings.vote_method === "buttons") {
    const disabled = status !== "open";
    const pollId = opts.pollId ?? "preview";
    if (isMusic) {
      const closed = status === "closed";
      for (const option of draft.options) {
        const listen = Number(opts.totals?.[`${option.id}:listen`] ?? 0);
        const skip = Number(opts.totals?.[`${option.id}:skip`] ?? 0);
        children.push({
          type: 1,
          components: [
            { type: 2, style: 2, custom_id: `vp:vote:${pollId}:${option.id}:listen`, label: closed ? `LISTEN:${listen}` : "LISTEN", disabled: closed },
            { type: 2, style: 2, custom_id: `vp:vote:${pollId}:${option.id}:skip`, label: closed ? `SKIP:${skip}` : "SKIP", disabled: closed },
          ],
        } as APIV2ChildComponent);
      }
    } else {
      const rows: { type: 2; style: number; custom_id: string; label: string; disabled: boolean; emoji?: { name: string; id?: string; animated?: boolean } }[][] = [];
      draft.options.forEach((option, index) => {
        const rowIndex = Math.floor(index / 5);
        rows[rowIndex] ??= [];
        const row = rows[rowIndex];
        if (row) {
          row.push({
            type: 2,
            style: 2,
            custom_id: `vp:vote:${pollId}:${option.id}`,
            label: option.label.slice(0, 80),
            disabled,
            ...(option.emoji ? { emoji: emojiObject(option.emoji) ?? undefined } : {}),
          });
        }
      });
      for (const row of rows) {
        children.push({ type: 1, components: row } as APIV2ChildComponent);
      }
    }
  }

  return {
    components: [{ type: 17, components: children }],
    flags: 1 << 15,
    content: null,
    embeds: null,
    attachments: [],
  };
}

export function previewTotals(draft: PollDraft): { totals: Record<string, number>; totalVotes: number } {
  const totals: Record<string, number> = {};
  let totalVotes = 0;
  for (const option of draft.options) {
    const count = Math.max(0, Math.floor((option.id.charCodeAt(0) % 9) * 3));
    if (!option.label.trim()) continue;
    totals[option.id] = count;
    totalVotes += count;
  }
  return { totals, totalVotes };
}

export function requiredImages(draft: PollDraft): PollOptionDraft[] {
  return draft.options.filter((o) => o.image_url);
}
