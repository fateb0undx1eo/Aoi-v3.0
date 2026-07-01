import type { Client, Guild, TextBasedChannel } from 'discord.js';
import { AttachmentBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../utils/logger.js';
import type { UploadService } from './upload/uploadService.js';
import { replaceAttachmentUris } from './upload/urlReplacer.js';

interface FlatEmbed {
  title: string;
  description: string;
  url: string;
  color: number | null;
  author_name: string;
  author_icon_url: string;
  author_url: string;
  fields: { name: string; value: string; inline: boolean }[];
  footer_text: string;
  footer_icon_url: string;
  image_url: string;
  thumbnail_url: string;
  timestamp: string;
}

interface FlowAction {
  ri: number;
  ci: number;
  type: string;
  role_id?: string;
  option_value?: string;
  channel_id?: string;
  message_content?: string;
  thread_name?: string;
  custom_event?: string;
  custom_data?: string;
}

interface ContainerBlock {
  type: string;
  content: string;
}

interface NormalizedComponent {
  type: string | number;
  style?: number;
  label?: string;
  custom_id?: string;
  url?: string;
  emoji?: any;
  disabled?: boolean;
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  options?: any[];
  items?: { media: { url: string } }[];
  content?: string;
  divider?: boolean;
  spacing?: number;
  accessory?: any;
  components?: any[];
  accent_color?: number;
  spoiler?: boolean | undefined;
}

interface LegacyEntry {
  id: string;
  type: 'normal' | 'embed' | 'container';
  edit_existing: boolean;
  message_link: string;
  content: string;
  embed: Partial<FlatEmbed>;
  embeds: Partial<FlatEmbed>[];
  container_blocks: ContainerBlock[];
  components: NormalizedComponent[][];
  flows: FlowAction[];
  _files?: AttachmentBuilder[];
}

interface NewEntry {
  id: string;
  type: 'new';
  edit_existing: boolean;
  message_link: string;
  content: string;
  embed: Partial<FlatEmbed>;
  embeds: Partial<FlatEmbed>[];
  container_blocks: ContainerBlock[];
  components: NormalizedComponent[][];
  _rawComponents?: NormalizedComponent[];
  flows: FlowAction[];
  flags?: number;
  thread_name: string;
  allowed_mentions?: any;
  _files?: AttachmentBuilder[];
}

type NormalizedEntry = LegacyEntry | NewEntry;

interface NormalizedPayload {
  channel_ids: string[];
  entries: NormalizedEntry[];
}

interface SendResult {
  requested_channels: number;
  delivered_channels: number;
  failed_channels: number;
  message_count: number;
  edited_messages: number;
  failed_edits: number;
}

interface AnnouncementServiceOptions {
  client: Client;
  uploadService: UploadService;
}

// ─── Helper Functions ──────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimString(value: any, maxLength: number = 1000): string {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeColor(value: any): number | null {
  const raw = trimString(value, 16).replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(raw)) {
    return null;
  }
  return Number.parseInt(raw, 16);
}

function normalizeFields(fields: any): { name: string; value: string; inline: boolean }[] {
  if (!Array.isArray(fields)) return [];
  return fields.slice(0, 25).map((f: any) => ({
    name: trimString(f.name, 256) || '\u200b',
    value: trimString(f.value, 1024) || '\u200b',
    inline: Boolean(f.inline),
  }));
}

function normalizeComponentItem(comp: any): NormalizedComponent | null {
  if (!comp || !comp.type) return null;
  const type = comp.type === 2 ? 'button' : comp.type === 3 ? 'select' : comp.type;
  if (type === 'button' || comp.type === 'button') {
    return {
      type: 'button',
      style: Math.min(Math.max(Number(comp.style) || 1, 1), 5),
      label: trimString(comp.label, 80),
      custom_id: trimString(comp.custom_id, 100),
      url: trimString(comp.url, 512),
      emoji: comp.emoji || null,
      disabled: Boolean(comp.disabled),
    };
  }
  if (type === 'select' || comp.type === 'select') {
    return {
      type: 'select',
      custom_id: trimString(comp.custom_id, 100),
      placeholder: trimString(comp.placeholder, 150),
      min_values: Math.max(Number(comp.min_values) || 1, 0),
      max_values: Math.max(Number(comp.max_values) || 1, 1),
      disabled: Boolean(comp.disabled),
      options: (comp.options || []).slice(0, 25).map((opt: any) => ({
        label: trimString(opt.label, 100) || 'Option',
        value: trimString(opt.value, 100) || `opt_${Date.now()}`,
        description: opt.description ? trimString(opt.description, 100) : undefined,
        emoji: opt.emoji || undefined,
      })),
    };
  }
  return null;
}

function normalizeComponents(rows: any): NormalizedComponent[][] {
  if (!Array.isArray(rows)) return [];
  if (rows.length > 0 && !Array.isArray(rows[0]) && typeof rows[0] === 'object' && rows[0].type === 1) {
    return rows
      .map((row: any) => (row.components || []).map(normalizeComponentItem).filter(Boolean) as NormalizedComponent[])
      .filter((row: any) => row.length > 0 && row.length <= 5);
  }
  return rows
    .map((row: any) => {
      if (!Array.isArray(row)) return [];
      return row.map(normalizeComponentItem).filter(Boolean) as NormalizedComponent[];
    })
    .filter((row: any) => row.length > 0 && row.length <= 5);
}

function isV2Components(components: any): boolean {
  return Array.isArray(components) && components.some((c: any) => c && typeof c.type === 'number' && c.type !== 1);
}

function normalizeRawV2Component(comp: any): NormalizedComponent | null {
  if (!comp || typeof comp.type !== 'number') return null;
  if (comp.type === 10) return { type: 10, content: trimString(comp.content, 2000) };
  if (comp.type === 14) return { type: 14, divider: true, spacing: Math.max(1, Math.min(Number(comp.spacing) || 1, 4)) };
  if (comp.type === 11 || comp.type === 12 || comp.type === 13) {
    const items = Array.isArray(comp.items) ? comp.items.map((item: any) => ({
      media: { url: trimString(item?.media?.url, 2000) },
    })).filter((item: any) => item.media.url) : [];
    return { type: comp.type, items };
  }
  if (comp.type === 9) {
    const sectionChildren = Array.isArray(comp.components) ? comp.components.map(normalizeRawV2Component).filter(Boolean) : [];
    let accessory: any = null;
    if (comp.accessory) {
      if (comp.accessory.type === 2) {
        accessory = {
          type: 2,
          style: Math.min(Math.max(Number(comp.accessory.style) || 1, 1), 6),
          label: trimString(comp.accessory.label, 80),
          custom_id: trimString(comp.accessory.custom_id, 100),
          url: trimString(comp.accessory.url, 512),
          emoji: comp.accessory.emoji || undefined,
          disabled: Boolean(comp.accessory.disabled),
        };
      } else if (comp.accessory.type === 11) {
        const items = Array.isArray(comp.accessory.items) ? comp.accessory.items.map((item: any) => ({
          media: { url: trimString(item?.media?.url, 2000) },
        })).filter((item: any) => item.media.url) : [];
        accessory = { type: 11, items };
      }
    }
    return { type: 9, components: sectionChildren, ...(accessory ? { accessory } : {}) };
  }
  if (comp.type === 17) {
    const children = Array.isArray(comp.components) ? comp.components.map(normalizeRawV2Component).filter(Boolean) : [];
    return {
      type: 17,
      components: children,
      accent_color: comp.accent_color != null ? Number(comp.accent_color) : undefined,
      spoiler: Boolean(comp.spoiler) || undefined,
    };
  }
  return null;
}

function normalizeFlows(rawFlows: any): FlowAction[] {
  if (!Array.isArray(rawFlows)) return [];
  return rawFlows.map((f: any) => {
    if (!f || typeof f.type !== 'string') return null;
    const type = f.type;
    if (type === 'add_role' || type === 'remove_role') {
      return {
        ri: Number.isInteger(f.ri) ? f.ri : 0,
        ci: Number.isInteger(f.ci) ? f.ci : 0,
        type,
        role_id: trimString(f.role_id, 32),
        option_value: f.option_value ? trimString(f.option_value, 100) : undefined,
      };
    }
    if (type === 'send_message') {
      return {
        ri: Number.isInteger(f.ri) ? f.ri : 0,
        ci: Number.isInteger(f.ci) ? f.ci : 0,
        type,
        channel_id: trimString(f.channel_id, 32),
        message_content: f.message_content ? trimString(f.message_content, 2000) : undefined,
        option_value: f.option_value ? trimString(f.option_value, 100) : undefined,
      };
    }
    if (type === 'create_thread') {
      return {
        ri: Number.isInteger(f.ri) ? f.ri : 0,
        ci: Number.isInteger(f.ci) ? f.ci : 0,
        type,
        thread_name: trimString(f.thread_name, 100),
        channel_id: f.channel_id ? trimString(f.channel_id, 32) : undefined,
        option_value: f.option_value ? trimString(f.option_value, 100) : undefined,
      };
    }
    if (type === 'custom') {
      return {
        ri: Number.isInteger(f.ri) ? f.ri : 0,
        ci: Number.isInteger(f.ci) ? f.ci : 0,
        type,
        custom_event: trimString(f.custom_event, 100),
        custom_data: f.custom_data ? trimString(f.custom_data, 4000) : undefined,
        option_value: f.option_value ? trimString(f.option_value, 100) : undefined,
      };
    }
    return null;
  }).filter(Boolean) as FlowAction[];
}

function normalizeContainerBlocks(blocks: any): ContainerBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .map((block: any) => ({
      type: String(block?.type ?? '').trim(),
      content: trimString(block?.content, 2000),
    }))
    .filter((block) => block.type === 'text' || block.type === 'image' || block.type === 'separator');
}

function buildContainerComponents(blocks: any): NormalizedComponent[] {
  const components: NormalizedComponent[] = [];
  for (const block of normalizeContainerBlocks(blocks)) {
    if (block.type === 'text' && block.content) {
      components.push({ type: 10, content: block.content });
      continue;
    }
    if (block.type === 'image' && block.content) {
      components.push({ type: 12, items: [{ media: { url: block.content } }] });
      continue;
    }
    if (block.type === 'separator') {
      components.push({ type: 14, divider: true, spacing: 1 });
    }
  }
  if (!components.length) return [];
  return [{ type: 17, components }];
}

function hasLegacyType(entry: any): entry is LegacyEntry {
  return entry?.type === 'normal' || entry?.type === 'embed' || entry?.type === 'container';
}

function apiEmbedToFlat(e: any): Partial<FlatEmbed> {
  if (!e) return {};
  return {
    title: trimString(e.title, 256),
    description: trimString(e.description, 4000),
    url: trimString(e.url, 1000),
    color: e.color != null ? e.color : null,
    author_name: trimString(e.author?.name, 256),
    author_icon_url: trimString(e.author?.icon_url, 1000),
    author_url: trimString(e.author?.url, 1000),
    fields: normalizeFields(e.fields),
    footer_text: trimString(e.footer?.text, 2048),
    footer_icon_url: trimString(e.footer?.icon_url, 1000),
    image_url: trimString(e.image?.url, 1000),
    thumbnail_url: trimString(e.thumbnail?.url, 1000),
    timestamp: trimString(e.timestamp, 64),
  };
}

function normalizeEntry(rawEntry: Record<string, any> = {}): NormalizedEntry {
  if (hasLegacyType(rawEntry)) {
    const type = rawEntry.type as 'normal' | 'embed' | 'container';
    const legacyEmbed = {
      title: trimString(rawEntry?.embed?.title, 256),
      description: trimString(rawEntry?.embed?.description, 4000),
      footer_text: trimString(rawEntry?.embed?.footer_text, 2048),
      image_url: trimString(rawEntry?.embed?.image_url, 1000),
      color: normalizeColor(rawEntry?.embed?.color),
    };
    return {
      id: trimString(rawEntry.id, 64),
      type,
      edit_existing: Boolean(rawEntry?.edit_existing),
      message_link: trimString(rawEntry?.message_link, 500),
      content: trimString(rawEntry.content, 2000),
      embed: legacyEmbed,
      embeds: [legacyEmbed],
      container_blocks: normalizeContainerBlocks(rawEntry?.container_blocks),
      components: [],
      flows: normalizeFlows(rawEntry.flows),
    } as LegacyEntry;
  }

  const embeds: Partial<FlatEmbed>[] = [];
  if (Array.isArray(rawEntry.embeds)) {
    for (const e of rawEntry.embeds) {
      if (e && (e.title || e.description || (e.fields && e.fields.length) || e.image?.url || e.thumbnail?.url || e.footer?.text || e.author?.name)) {
        embeds.push(apiEmbedToFlat(e));
      }
    }
  } else if (rawEntry.embed) {
    const flat = {
      title: trimString(rawEntry.embed.title, 256),
      description: trimString(rawEntry.embed.description, 4000),
      url: trimString(rawEntry.embed.url, 1000),
      color: normalizeColor(rawEntry.embed.color),
      author_name: trimString(rawEntry.embed.author_name, 256),
      author_icon_url: trimString(rawEntry.embed.author_icon_url, 1000),
      author_url: trimString(rawEntry.embed.author_url, 1000),
      fields: normalizeFields(rawEntry.embed.fields),
      footer_text: trimString(rawEntry.embed.footer_text, 2048),
      footer_icon_url: trimString(rawEntry.embed.footer_icon_url, 1000),
      image_url: trimString(rawEntry.embed.image_url, 1000),
      thumbnail_url: trimString(rawEntry.embed.thumbnail_url, 1000),
      timestamp: trimString(rawEntry.embed.timestamp, 64),
    };
    if (flat.title || flat.description || flat.fields.length > 0 || flat.image_url || flat.thumbnail_url || flat.footer_text || flat.author_name) {
      embeds.push(flat);
    }
  }

  const rawComponents = Array.isArray(rawEntry.components) ? rawEntry.components : [];
  const hasV2 = isV2Components(rawComponents);

  return {
    id: trimString(rawEntry.id, 64),
    type: 'new',
    edit_existing: Boolean(rawEntry?.edit_existing),
    message_link: trimString(rawEntry?.message_link, 500),
    content: trimString(rawEntry.content, 2000),
    embed: embeds[0] || {},
    embeds,
    container_blocks: [],
    components: hasV2 ? [] : normalizeComponents(rawEntry?.components),
    _rawComponents: hasV2 ? rawComponents.map(normalizeRawV2Component).filter(Boolean) as NormalizedComponent[] : undefined,
    flows: normalizeFlows(rawEntry.flows),
    flags: rawEntry.flags ? Number(rawEntry.flags) : undefined,
    thread_name: trimString(rawEntry.thread_name, 100),
    allowed_mentions: rawEntry.allowed_mentions || undefined,
  } as NewEntry;
}

function normalizePayload(rawPayload: Record<string, any> = {}): NormalizedPayload {
  const channelIds = Array.isArray(rawPayload?.channel_ids)
    ? Array.from(new Set(rawPayload.channel_ids.map((value: any) => trimString(value, 32)).filter(Boolean)))
    : [];

  const entryFiles: Record<string, any> = rawPayload._entryFiles || {};

  const entries: NormalizedEntry[] = [];
  for (const raw of (Array.isArray(rawPayload?.entries) ? rawPayload.entries : [])) {
    const entry = normalizeEntry(raw);
    const files = entryFiles[entry.id] || [];
    if (files.length > 0) {
      (entry as any)._rawFiles = files.slice(0, 10);
    }
    if (hasLegacyType(entry)) {
      if (entry.type === 'normal') { if (Boolean(entry.content)) entries.push(entry); }
      else if (entry.type === 'embed') { if (Boolean(entry.embed.title || entry.embed.description || entry.embed.image_url || entry.embed.footer_text)) entries.push(entry); }
      else { if (entry.container_blocks.length > 0) entries.push(entry); }
    } else {
      if (Boolean(entry.content) || entry.embeds.length > 0 || entry.components.length > 0 || (entry._rawComponents && entry._rawComponents.length > 0) || ((entry as any)._rawFiles && (entry as any)._rawFiles.length > 0)) entries.push(entry);
    }
  }

  return { channel_ids: channelIds, entries };
}

function parseMessageLink(link: string): { guildId: string; channelId: string; messageId: string } | null {
  const match = String(link ?? '').trim().match(/discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/i);
  if (!match) return null;
  return { guildId: match[1]!, channelId: match[2]!, messageId: match[3]! };
}

function buildEmbed(embed: Partial<FlatEmbed>): EmbedBuilder {
  const builder = new EmbedBuilder();
  if (embed.color !== null) builder.setColor(embed.color as number);
  if (embed.title) builder.setTitle(embed.title);
  if (embed.description) builder.setDescription(embed.description);
  if (embed.url) builder.setURL(embed.url);
  if (embed.author_name) {
    const authorOpts: Record<string, any> = { name: embed.author_name };
    if (embed.author_icon_url) authorOpts.iconURL = embed.author_icon_url;
    if (embed.author_url) authorOpts.url = embed.author_url;
    builder.setAuthor(authorOpts as any);
  }
  if (embed.fields && embed.fields.length > 0) builder.addFields(embed.fields as any);
  if (embed.footer_text) {
    const footerOpts: Record<string, any> = { text: embed.footer_text };
    if (embed.footer_icon_url) footerOpts.iconURL = embed.footer_icon_url;
    builder.setFooter(footerOpts as any);
  }
  if (embed.image_url) builder.setImage(embed.image_url);
  if (embed.thumbnail_url) builder.setThumbnail(embed.thumbnail_url);
  if (embed.timestamp) {
    try { builder.setTimestamp(new Date(embed.timestamp)); } catch {}
  }
  return builder;
}

function buildDiscordComponents(componentRows: NormalizedComponent[][]): ActionRowBuilder<any>[] {
  return componentRows.map((row) => {
    const actionRow = new ActionRowBuilder();
    const items = row.map((comp) => {
      if (comp.type === 'button') {
        const btn = new ButtonBuilder()
          .setStyle(comp.style as number)
          .setLabel(comp.label || '\u200b')
          .setDisabled(comp.disabled as boolean);
        if (comp.emoji) btn.setEmoji(comp.emoji);
        if (comp.style === ButtonStyle.Link) {
          btn.setURL(comp.url || 'https://discord.com');
        } else {
          btn.setCustomId(comp.custom_id || `btn_${Date.now()}`);
        }
        return btn;
      }
      if (comp.type === 'select') {
        const select = new StringSelectMenuBuilder()
          .setCustomId(comp.custom_id || `select_${Date.now()}`)
          .setPlaceholder(comp.placeholder || 'Select an option')
          .setMinValues(comp.min_values as number)
          .setMaxValues(comp.max_values as number)
          .setDisabled(comp.disabled as boolean);
        if (comp.options && comp.options.length > 0) select.addOptions(comp.options as any);
        return select;
      }
      return null;
    }).filter(Boolean) as any[];
    actionRow.addComponents(items as any);
    return actionRow;
  });
}

function buildEntryPayload(entry: NormalizedEntry): Record<string, any> | null {
  if (hasLegacyType(entry)) {
    const payload: Record<string, any> = { allowedMentions: { parse: [] } };
    if (entry.type === 'normal') {
      payload.content = entry.content;
      payload.embeds = [];
      payload.components = [];
      return payload;
    }
    if (entry.type === 'embed') {
      const embed = new EmbedBuilder();
      if (entry.embed.color !== null) embed.setColor(entry.embed.color as number);
      if (entry.embed.title) embed.setTitle(entry.embed.title);
      if (entry.embed.description) embed.setDescription(entry.embed.description);
      if (entry.embed.footer_text) embed.setFooter({ text: entry.embed.footer_text });
      if (entry.embed.image_url) embed.setImage(entry.embed.image_url);
      payload.content = '';
      payload.embeds = [embed];
      payload.components = [];
      return payload;
    }
    const components = buildContainerComponents(entry.container_blocks);
    if (!components.length) return null;
    payload.content = '';
    payload.embeds = [];
    payload.flags = MessageFlags.IsComponentsV2;
    payload.components = components;
    return payload;
  }

  const payload: Record<string, any> = { allowedMentions: { parse: [] } };
  if (entry.content) payload.content = entry.content;
  if (entry.embeds.length > 0) {
    payload.embeds = entry.embeds.map(buildEmbed);
  }
  if (entry._rawComponents && entry._rawComponents.length > 0) {
    payload.components = entry._rawComponents;
    payload.flags = (payload.flags || 0) | MessageFlags.IsComponentsV2;
  } else if (entry.components.length > 0) {
    payload.components = buildDiscordComponents(entry.components);
  }
  if (entry.flags) {
    payload.flags = (payload.flags || 0) | entry.flags;
  }
  if (entry.thread_name) {
    payload.thread_name = entry.thread_name;
  }
  if (entry.allowed_mentions) {
    payload.allowedMentions = entry.allowed_mentions;
  }
  return payload;
}

function buildComponentsV2EntryPayload(entry: NormalizedEntry): Record<string, any> | null {
  if (hasLegacyType(entry)) {
    const components: NormalizedComponent[] = [];
    if (entry.type === 'normal') {
      if (entry.content) components.push({ type: 10, content: entry.content });
    } else if (entry.type === 'embed') {
      if (entry.embed.title) components.push({ type: 10, content: `## ${entry.embed.title}` });
      if (entry.embed.description) components.push({ type: 10, content: entry.embed.description });
      if (entry.embed.image_url) components.push({ type: 12, items: [{ media: { url: entry.embed.image_url } }] });
      if (entry.embed.footer_text) {
        if (components.length > 0) components.push({ type: 14, divider: true, spacing: 1 });
        components.push({ type: 10, content: `*${entry.embed.footer_text}*` });
      }
    } else {
      return buildEntryPayload(entry);
    }
    if (!components.length) return null;
    return { flags: MessageFlags.IsComponentsV2, components: [{ type: 17, components }], allowedMentions: { parse: [] } };
  }
  return buildEntryPayload(entry);
}

// ─── Service Class ─────────────────────────────────────────────

export class AnnouncementService {
  private client: Client;
  private uploadService: UploadService;

  constructor({ client, uploadService }: AnnouncementServiceOptions) {
    this.client = client;
    this.uploadService = uploadService;
  }

  async resolveGuild(guildId: string): Promise<Guild | null> {
    return this.client.guilds.cache.get(guildId) ?? await this.client.guilds.fetch(guildId).catch(() => null);
  }

  async resolveChannels(guild: Guild, channelIds: string[]): Promise<TextBasedChannel[]> {
    const results = await Promise.allSettled(
      channelIds.map(async (channelId) => {
        const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
        return channel?.isTextBased() ? (channel as TextBasedChannel) : null;
      })
    );
    return results
      .filter((r): r is PromiseFulfilledResult<TextBasedChannel | null> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((c): c is TextBasedChannel => c !== null);
  }

  async sendEntry(channel: TextBasedChannel, entry: NormalizedEntry): Promise<void> {
    const payload = buildEntryPayload(entry);
    if (!payload) return;
    if (entry._files?.length) {
      payload.files = entry._files;
    }
    await (channel as any).send(payload);
  }

  async editExistingEntry(guild: Guild, entry: NormalizedEntry): Promise<void> {
    const link = parseMessageLink(entry.message_link);
    if (!link || link.guildId !== guild.id) {
      throw new Error('That message link is invalid for this server.');
    }
    const channel = guild.channels.cache.get(link.channelId) ?? await guild.channels.fetch(link.channelId).catch(() => null);
    if (!channel?.isTextBased()) {
      throw new Error('The target message channel could not be resolved.');
    }
    const message = await (channel as TextBasedChannel).messages.fetch(link.messageId).catch(() => null);
    if (!message) {
      throw new Error('The target message could not be found.');
    }
    if (message.author?.id !== this.client.user?.id) {
      throw new Error('Only messages sent by this bot can be edited.');
    }
    const payload = message.flags?.has?.(MessageFlags.IsComponentsV2)
      ? buildComponentsV2EntryPayload(entry)
      : buildEntryPayload(entry);
    if (!payload && entry._files?.length) {
      const filePayload: Record<string, any> = { files: entry._files, allowedMentions: { parse: [] } };
      await (message as any).edit(filePayload);
      return;
    }
    if (!payload) {
      throw new Error('Add at least one message component before editing this message.');
    }
    if (entry._files?.length) {
      payload.files = entry._files;
    }
    await (message as any).edit(payload);
  }

  async send(guildId: string, rawPayload: Record<string, any>): Promise<SendResult> {
    logger.info({ guildId, hasEntryFiles: !!rawPayload._entryFiles, entryFileKeys: Object.keys(rawPayload._entryFiles || {}) }, 'send called');
    const payload = normalizePayload(rawPayload);
    logger.info({ channelCount: payload.channel_ids.length, entryCount: payload.entries.length }, 'payload normalized');

    const uploadResult = await this.uploadService.processEntries(payload.entries);
    replaceAttachmentUris(payload.entries, uploadResult.urlMap);

    for (const fb of uploadResult.fallbacks) {
      const entry = payload.entries.find(e => e.id === fb.entryId);
      if (!entry) continue;
      if (!entry._files) entry._files = [];
      entry._files.push(new AttachmentBuilder(fb.buffer, {
        name: fb.originalname,
        description: fb.description,
        spoiler: fb.spoiler,
      } as any));
    }

    logger.info({ stats: uploadResult.stats }, 'upload: batch complete');
    const newEntries = payload.entries.filter((entry) => !entry.edit_existing);
    const editEntries = payload.entries.filter((entry) => entry.edit_existing);
    const requestedChannels = newEntries.length > 0 ? payload.channel_ids.length : 0;

    if (!payload.channel_ids.length && newEntries.length > 0) {
      throw new Error('Select at least one target channel.');
    }
    if (!payload.entries.length) {
      throw new Error('Add at least one announcement message before sending.');
    }

    const guild = await this.resolveGuild(guildId);
    if (!guild) {
      throw new Error('Guild not found.');
    }

    const channels = newEntries.length > 0
      ? await this.resolveChannels(guild, payload.channel_ids)
      : [];
    if (!channels.length && newEntries.length > 0) {
      throw new Error('None of the selected channels could be used.');
    }

    let editedMessages = 0, deliveredChannels = 0, failedChannels = 0, failedEdits = 0;
    let firstFailureMessage = '';

    for (const entry of editEntries) {
      try {
        await this.editExistingEntry(guild, entry);
        editedMessages += 1;
      } catch (error: any) {
        failedEdits += 1;
        if (!firstFailureMessage) {
          firstFailureMessage = error instanceof Error ? error.message : 'Failed to edit the linked announcement message.';
        }
      }
    }

    if (newEntries.length > 0) {
      for (const channel of channels) {
        try {
          for (const entry of newEntries) {
            await this.sendEntry(channel, entry);
            await sleep(250);
          }
          deliveredChannels += 1;
        } catch (error: any) {
          failedChannels += 1;
          if (!firstFailureMessage) {
            firstFailureMessage = error instanceof Error ? error.message : 'Failed to send the announcement.';
          }
        }
        await sleep(500);
      }
    }

    if (editedMessages === 0 && deliveredChannels === 0 && (failedEdits > 0 || failedChannels > 0)) {
      throw new Error(firstFailureMessage || 'Announcement delivery failed.');
    }

    return {
      requested_channels: requestedChannels,
      delivered_channels: deliveredChannels,
      failed_channels: failedChannels,
      message_count: newEntries.length,
      edited_messages: editedMessages,
      failed_edits: failedEdits,
    };
  }
}
