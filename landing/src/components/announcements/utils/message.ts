import { nanoid } from "nanoid";
import { formatDate } from "@/lib/date";
import type { QueryDataMessage, QueryDataMessageData, QueryData, APIButtonComponent, APIEmbed, APIEmbedField } from "../types";
import { DISCORD_LIMITS } from "../types";

export function randomId(): string { return nanoid(8); }

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

// ── Discohook-style embed helpers ───────────────────────────────────────────

/** Check if an embed is effectively empty (no content to display). */
export function isEmbedEmpty(embed: APIEmbed): boolean {
  if (embed.title) return false;
  if (embed.description) return false;
  if (embed.url) return false;
  if (embed.color !== undefined && embed.color !== null) return false;
  if (embed.footer?.text) return false;
  if (embed.image?.url) return false;
  if (embed.thumbnail?.url) return false;
  if (embed.author?.name) return false;
  if (embed.fields && embed.fields.length > 0) return false;
  if (embed.timestamp) return false;
  return true;
}

/** Get combined text content from an embed for length checking. */
export function getEmbedText(embed: APIEmbed): string {
  let text = "";
  text += embed.title || "";
  text += embed.description || "";
  text += embed.author?.name || "";
  text += embed.footer?.text || "";
  if (embed.fields) {
    for (const field of embed.fields) {
      text += field.name;
      text += field.value;
    }
  }
  return text;
}

/** Get the total character length of an embed. */
export function getEmbedLength(embed: APIEmbed): number {
  return getEmbedText(embed).length;
}

/** Check if an embed has displayable content beyond just timestamp or color. */
export function embedHasDisplayContent(embed: APIEmbed): boolean {
  if (embed.title) return true;
  if (embed.description) return true;
  if (embed.fields && embed.fields.length > 0) return true;
  if (embed.image?.url) return true;
  if (embed.thumbnail?.url) return true;
  if (embed.footer?.text) return true;
  if (embed.author?.name) return true;
  return false;
}

/** Get an array of validation error messages for an embed. */
export function getEmbedErrors(embed: APIEmbed): string[] {
  const errors: string[] = [];
  if ((embed.title?.length ?? 0) > DISCORD_LIMITS.EMBED_TITLE) {
    errors.push(`Embed title too long (${embed.title!.length}/${DISCORD_LIMITS.EMBED_TITLE})`);
  }
  if ((embed.description?.length ?? 0) > DISCORD_LIMITS.EMBED_DESCRIPTION) {
    errors.push(`Embed description too long (${embed.description!.length}/${DISCORD_LIMITS.EMBED_DESCRIPTION})`);
  }
  if ((embed.footer?.text?.length ?? 0) > DISCORD_LIMITS.FOOTER_TEXT) {
    errors.push(`Embed footer too long (${embed.footer!.text.length}/${DISCORD_LIMITS.FOOTER_TEXT})`);
  }
  if ((embed.author?.name?.length ?? 0) > DISCORD_LIMITS.AUTHOR_NAME) {
    errors.push(`Embed author name too long (${embed.author!.name.length}/${DISCORD_LIMITS.AUTHOR_NAME})`);
  }
  if ((embed.fields?.length ?? 0) > DISCORD_LIMITS.EMBED_FIELDS) {
    errors.push(`Too many embed fields (${embed.fields!.length}/${DISCORD_LIMITS.EMBED_FIELDS})`);
  }
  for (const field of embed.fields ?? []) {
    if ((field.name?.length ?? 0) > DISCORD_LIMITS.FIELD_NAME) {
      errors.push(`Field name too long (${field.name.length}/${DISCORD_LIMITS.FIELD_NAME})`);
    }
    if ((field.value?.length ?? 0) > DISCORD_LIMITS.FIELD_VALUE) {
      errors.push(`Field value too long (${field.value.length}/${DISCORD_LIMITS.FIELD_VALUE})`);
    }
  }
  return errors;
}

/** Get total embed characters across all embeds in a message. */
export function getTotalEmbedLength(embeds: APIEmbed[] | null | undefined): number {
  if (!embeds) return 0;
  return embeds.reduce((sum, e) => sum + getEmbedLength(e), 0);
}

// ── Existing helpers ────────────────────────────────────────────────────────

export function getMessageLimitWarnings(msg: QueryDataMessageData): string[] {
  const warnings: string[] = [];
  const c = msg.content || "";
  if (c.length > DISCORD_LIMITS.CONTENT) warnings.push(`Message content is too long (${c.length.toLocaleString()}/${DISCORD_LIMITS.CONTENT.toLocaleString()} chars)`);

  const embeds = msg.embeds || [];
  if (embeds.length > DISCORD_LIMITS.EMBEDS_PER_MESSAGE) warnings.push(`Too many embeds (${embeds.length} max: ${DISCORD_LIMITS.EMBEDS_PER_MESSAGE})`);

  let totalEmbedChars = 0;
  for (const e of embeds) {
    warnings.push(...getEmbedErrors(e));
    totalEmbedChars += getEmbedLength(e);
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
    return formatDate(iso, "MMM d, yyyy, h:mm a");
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
