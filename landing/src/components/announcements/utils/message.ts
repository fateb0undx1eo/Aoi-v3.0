import type { QueryDataMessage, QueryDataMessageData, QueryData, APIButtonComponent } from "../types";
import { DISCORD_LIMITS } from "../constants";

export function randomId(): string { return Math.random().toString(36).slice(2, 10); }

export function createMessage(flags?: number): QueryDataMessage {
  return { _id: randomId(), data: { flags }, reference: undefined, thread_id: undefined };
}

export function createDefaultComponent(): APIButtonComponent {
  return { type: 2, style: 1, label: "Button", custom_id: `btn_${randomId()}`, disabled: false };
}

export function cloneQueryData(data: QueryData): QueryData {
  return JSON.parse(JSON.stringify(data));
}

export function isComponentsV2(flags?: number): boolean {
  return !!(flags && (flags & (1 << 15)));
}

export function hasFlag(flags: number | undefined | null, bit: number): boolean {
  return !!(flags && (flags & bit));
}

export function getMessageLimitWarnings(msg: QueryDataMessageData): string[] {
  const warnings: string[] = [];
  const c = msg.content || "";
  if (c.length > DISCORD_LIMITS.CONTENT) warnings.push(`Message content is too long (${c.length.toLocaleString()}/${DISCORD_LIMITS.CONTENT.toLocaleString()} chars)`);

  const embeds = msg.embeds || [];
  if (embeds.length > DISCORD_LIMITS.EMBEDS_PER_MESSAGE) warnings.push(`Too many embeds (${embeds.length} max: ${DISCORD_LIMITS.EMBEDS_PER_MESSAGE})`);

  let totalEmbedChars = 0;
  for (const e of embeds) {
    if ((e.title?.length || 0) > DISCORD_LIMITS.EMBED_TITLE) warnings.push(`Embed title too long (max ${DISCORD_LIMITS.EMBED_TITLE} chars)`);
    if ((e.description?.length || 0) > DISCORD_LIMITS.EMBED_DESCRIPTION) warnings.push(`Embed description too long (max ${DISCORD_LIMITS.EMBED_DESCRIPTION.toLocaleString()} chars)`);
    if ((e.footer?.text?.length || 0) > DISCORD_LIMITS.FOOTER_TEXT) warnings.push(`Embed footer too long (max ${DISCORD_LIMITS.FOOTER_TEXT.toLocaleString()} chars)`);
    if ((e.author?.name?.length || 0) > DISCORD_LIMITS.AUTHOR_NAME) warnings.push(`Embed author name too long (max ${DISCORD_LIMITS.AUTHOR_NAME} chars)`);
    const fields = e.fields || [];
    if (fields.length > DISCORD_LIMITS.EMBED_FIELDS) warnings.push(`Too many embed fields (${fields.length} max: ${DISCORD_LIMITS.EMBED_FIELDS})`);
    for (const f of fields) {
      if ((f.name?.length || 0) > DISCORD_LIMITS.FIELD_NAME) warnings.push(`Field name too long (max ${DISCORD_LIMITS.FIELD_NAME} chars)`);
      if ((f.value?.length || 0) > DISCORD_LIMITS.FIELD_VALUE) warnings.push(`Field value too long (max ${DISCORD_LIMITS.FIELD_VALUE.toLocaleString()} chars)`);
    }
    totalEmbedChars += (e.title?.length || 0) + (e.description?.length || 0) + (e.author?.name?.length || 0) + (e.footer?.text?.length || 0);
    totalEmbedChars += fields.reduce((a, f) => a + (f.name?.length || 0) + (f.value?.length || 0), 0);
  }
  if (totalEmbedChars > DISCORD_LIMITS.TOTAL_EMBED_CHARS) warnings.push(`All embed content too long (${totalEmbedChars.toLocaleString()}/${DISCORD_LIMITS.TOTAL_EMBED_CHARS.toLocaleString()} chars)`);

  const comps = msg.components || [];
  const isV2 = comps.some((r) => r.type !== 1);
  if (!isV2) {
    if (comps.length > DISCORD_LIMITS.V1_ROWS) warnings.push(`Too many action rows (max ${DISCORD_LIMITS.V1_ROWS})`);
    for (const row of comps) {
      if (row.type === 1 && row.components.length > DISCORD_LIMITS.V1_COMPONENTS_PER_ROW) warnings.push(`A row has too many components (max ${DISCORD_LIMITS.V1_COMPONENTS_PER_ROW} per row)`);
    }
  } else {
    const total = comps.reduce((a, r) => a + 1 + ("components" in r ? (r as any).components?.length || 0 : 0), 0);
    if (total > DISCORD_LIMITS.V2_TOTAL_COMPONENTS) warnings.push(`Too many V2 components (max ${DISCORD_LIMITS.V2_TOTAL_COMPONENTS})`);
  }

  return warnings;
}

export function formatTimestamp(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  } catch { return iso; }
}

export function getMessageDisplayName(_label: string | undefined, i: number, msg: QueryDataMessage): string {
  if (msg.name) return msg.name;
  const c = msg.data.content;
  if (c) return c.length > 40 ? c.slice(0, 40) + "…" : c;
  if (msg.data.embeds && msg.data.embeds.length > 0) {
    const title = msg.data.embeds[0]?.title;
    if (title) return title.length > 40 ? title.slice(0, 40) + "…" : title;
  }
  return `Message ${i + 1}`;
}

export function getNewMessageData(messageCount: number, isV2: boolean): QueryDataMessageData {
  return isV2
    ? { content: "", components: [{ type: 17, components: [{ type: 10, content: `Message #${messageCount + 1}` }] }], flags: 1 << 15 }
    : { content: `Message #${messageCount + 1}` };
}
