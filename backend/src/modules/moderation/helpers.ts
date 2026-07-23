import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

import type { BotContext, InteractionResult } from '../../types/index.js';

export const CASE_ACTION_PREFIX = 'case:a';
export const CASE_TIMEOUT_MODAL_PREFIX = 'case:t';
export const CASE_KICK_MODAL_PREFIX = 'case:k';
export const CASE_WARN_MODAL_PREFIX = 'case:w';

export const CASE_REPORT_CHANNEL_ID = '1475835319571189820';
export const CASE_ALLOWED_ROLE_ID = '1457403601512169724';
export const CASE_WEBHOOK_NAME = 'AOI Case Logger';
export const CASE_WEBHOOK_AVATAR_URL = '';

export const TIMEOUT_PRESETS = [
  { label: '1 minute', minutes: 1 },
  { label: '5 minutes', minutes: 5 },
  { label: '10 minutes', minutes: 10 },
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '3 hours', minutes: 180 },
  { label: '6 hours', minutes: 360 },
  { label: '12 hours', minutes: 720 },
  { label: '1 day', minutes: 1440 },
  { label: '3 days', minutes: 4320 },
  { label: '7 days', minutes: 10080 },
  { label: '28 days', minutes: 40320 }
];

export const MODERATION_SCHEMA = {
  type: 'object',
  properties: {
    ghost_ping_window_seconds: { type: 'number' },
    ping_protection_roles: { type: 'array', items: { type: 'string' } },
    afk: { type: 'object' },
    loa: { type: 'object' },
    case_command: {
      type: 'object',
      properties: {
        default_timeout_minutes: { type: 'number' }
      }
    }
  }
} as const;

export interface CaseReport {
  guildId: string;
  reporterId: string;
  targetUserId: string;
  targetUsername: string;
  messageId: string;
  channelId: string;
  messageUrl: string;
  reportedTimestamp: number;
  messageContent: string;
  attachments: AttachmentEntry[];
}

export interface AttachmentEntry {
  url: string;
  name: string;
  isMedia: boolean;
}

export interface StatelessToken {
  messageId: string;
  targetUserId: string;
  reporterId: string;
}

export interface GuildActionParams {
  member: any;
  actionType: string;
  reason: string;
  durationSeconds?: number;
}

export interface MessageContentLimitParams {
  guildId: string;
  channelId: string;
  messageId: string;
  targetUserId: string;
  reporterId: string;
  targetUsername: string;
}

export function getModerationService(context: BotContext): any {
  return context?.moderationService ?? context?.services?.moderationService ?? null;
}

export function truncate(value: any, maxLength: number): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function escapeMarkdown(text: any): string {
  return String(text ?? '').replace(/[[\]()]/g, '\\$&');
}

export function textInputRow(textInput: TextInputBuilder): ActionRowBuilder<TextInputBuilder> {
  return new ActionRowBuilder<TextInputBuilder>().addComponents(textInput);
}

export function caseEmbed(title: string, description: string, color: number): EmbedBuilder {
  return new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
}

export function isAdminOrOwner(member: any, guild: any): boolean {
  if (!member) return false;
  if (member.id === guild.ownerId) return true;
  return member.permissions?.has?.(PermissionFlagsBits.Administrator) ?? false;
}

export function hasAllowedRole(member: any): boolean {
  const roleCache = member?.roles?.cache;
  if (roleCache?.some) return roleCache.some((role: any) => role.id === CASE_ALLOWED_ROLE_ID);
  const roleIds = Array.isArray(member?.roles) ? member.roles : [];
  return roleIds.some((id: any) => String(id) === CASE_ALLOWED_ROLE_ID);
}

export function canUseCaseCommand(member: any, guild: any): boolean {
  return isAdminOrOwner(member, guild) || hasAllowedRole(member);
}

export function canKick(member: any, guild: any): boolean {
  return isAdminOrOwner(member, guild);
}

export function looksLikeMediaUrl(url: any): boolean {
  const value = String(url ?? '').trim();
  if (!value) return false;
  const path = (value.split('?')[0] ?? '').toLowerCase();
  if (/\.(png|jpe?g|gif|webp|mp4|mov|webm)$/i.test(path)) return true;
  return /tenor\.com|giphy\.com|cdn\.discordapp\.com|media\.discordapp\.net/i.test(value);
}

export function extractUrlsFromText(text: any): string[] {
  const matches = String(text ?? '').match(/https?:\/\/\S+/gi);
  return matches ? matches.map((m: string) => m.trim()) : [];
}

export function getAttachmentData(message: any): AttachmentEntry[] {
  const items: AttachmentEntry[] = [];
  const pushUnique = (url: string, name = 'attachment', isMedia = true) => {
    if (!url) return;
    if (items.some((entry) => entry.url === url)) return;
    items.push({ url, name, isMedia });
  };

  for (const a of [...(message.attachments?.values?.() ?? [])]) {
    const contentType = String(a.contentType ?? '');
    const urlPath = (String(a.url ?? '').split('?')[0] ?? '');
    const isMedia = contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|mp4|mov|webm)$/i.test(urlPath);
    pushUnique(a.url, a.name ?? 'attachment', isMedia);
  }

  for (const embed of message.embeds ?? []) {
    for (const url of [embed.image?.url, embed.video?.url, embed.thumbnail?.url, embed.url]) {
      if (looksLikeMediaUrl(url)) pushUnique(url, 'embed-media', true);
    }
  }

  for (const url of extractUrlsFromText(message.content)) {
    if (looksLikeMediaUrl(url)) pushUnique(url, 'linked-media', true);
  }

  return items.slice(0, 5);
}

export function buildMessageUrl(guildId: string, channelId: string, messageId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

export function getWebhookIdentity(): { name: string; avatarUrl: string | null } {
  const name = String(process.env.CASE_WEBHOOK_NAME ?? CASE_WEBHOOK_NAME).trim() || CASE_WEBHOOK_NAME;
  const avatarUrl = String(process.env.CASE_WEBHOOK_AVATAR_URL ?? CASE_WEBHOOK_AVATAR_URL).trim();
  return { name, avatarUrl: avatarUrl || null };
}

export async function fetchAvatarBuffer(avatarUrl: string | null): Promise<Buffer | null> {
  if (!avatarUrl) return null;
  try {
    const response = await fetch(avatarUrl);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch { return null; }
}

export function stripLikelyMediaUrls(text: any): string {
  let cleaned = String(text ?? '');
  for (const url of extractUrlsFromText(cleaned)) {
    if (looksLikeMediaUrl(url)) cleaned = cleaned.replace(url, '');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

export function extractDisplayMessageContent(message: any, limit: number): string {
  const raw = String(message?.content ?? '').trim();
  if (!raw) return 'No text content.';
  const sanitized = stripLikelyMediaUrls(raw);
  if (!sanitized) return 'No text content.';
  return truncate(sanitized, limit);
}

export function computeMessageContentLimit({ guildId, channelId, messageId, targetUserId, reporterId, targetUsername }: MessageContentLimitParams): number {
  const messageUrl = buildMessageUrl(guildId, channelId, messageId);
  const scaffold = [
    '# Message Case Report',
    `**Author**: <@${targetUserId}> (${escapeMarkdown(targetUsername)})`,
    `**Reported By**: <@${reporterId}>`,
    `**Reported At**: <t:${Math.floor(Date.now() / 1000)}:F>`,
    `[](${messageUrl})`
  ].join('\n');
  return Math.max(0, 4000 - scaffold.length - 16);
}

export function buildPreviewContainerText(report: CaseReport): string {
  const hasContent = report.messageContent && report.messageContent !== 'No text content.';
  const lines = [
    '# CASE REPORT',
    `_ _ **Author**: <@${report.targetUserId}> (${escapeMarkdown(report.targetUsername)})`,
    `_ _ **Reported By**: <@${report.reporterId}>`,
    `_ _ **Reported At**: <t:${report.reportedTimestamp}:F>`
  ];
  if (hasContent) {
    lines.push(`_ _ **Message Content**: [${report.messageContent}](${report.messageUrl})`);
  } else {
    lines.push(`_ _ [view message](${report.messageUrl})`);
  }
  return lines.join('\n');
}

export function buildLogBody(report: CaseReport, reason: string, resolvedLabel: string): string {
  const hasContent = report.messageContent && report.messageContent !== 'No text content.';
  const lines = [
    '# CASE REPORT',
    `_ _ **Author**: <@${report.targetUserId}> (${escapeMarkdown(report.targetUsername)})`,
    `_ _ **Reported By**: <@${report.reporterId}>`,
    `_ _ **Reported At**: <t:${report.reportedTimestamp}:F>`,
    `_ _ **Reason**: ${escapeMarkdown(reason)}`
  ];
  if (hasContent) {
    lines.push(`_ _ **Message Content**: [${report.messageContent}](${report.messageUrl})`);
  } else {
    lines.push(`_ _ [view message](${report.messageUrl})`);
  }
  lines.push(`_ _ **Action Taken**: ${resolvedLabel}`);
  return lines.join('\n');
}

export async function fetchAttachmentBuffer(url: string, name: string): Promise<{ buffer: Buffer; name: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return { buffer: Buffer.from(await res.arrayBuffer()), name };
  } catch { return null; }
}

export async function prepareReuploadedMedia(attachments: AttachmentEntry[] = []): Promise<{ files: AttachmentBuilder[]; mediaGalleryItems: any[] }> {
  const files: AttachmentBuilder[] = [];
  const mediaGalleryItems: any[] = [];

  for (const attachment of attachments.filter((a) => a.isMedia).slice(0, 4)) {
    const fetched = await fetchAttachmentBuffer(attachment.url, attachment.name);
    if (!fetched) {
      mediaGalleryItems.push({ media: { url: attachment.url }, spoiler: true });
      continue;
    }
    const spoilerName = fetched.name.startsWith('SPOILER_') ? fetched.name : `SPOILER_${fetched.name}`;
    files.push(new AttachmentBuilder(fetched.buffer, { name: spoilerName }));
    mediaGalleryItems.push({ media: { url: `attachment://${spoilerName}` }, spoiler: true });
  }

  return { files, mediaGalleryItems };
}

export function buildNonMediaFileSection(attachments: AttachmentEntry[] = []): any[] {
  const fileAttachments = attachments.filter((a) => !a.isMedia && a.url);
  if (!fileAttachments.length) return [];
  const links = fileAttachments.map((a, i) => `[file ${i + 1}](${a.url})`).join(', ');
  return [{ type: 10, content: `**Files**: ${links}` }];
}

export function buildStatelessToken(report: CaseReport): string {
  return `${report.messageId}:${report.targetUserId}:${report.reporterId}`;
}

export function parseStatelessToken(token: string): StatelessToken | null {
  const [messageId, targetUserId, reporterId] = String(token ?? '').split(':');
  if (!messageId || !targetUserId || !reporterId) return null;
  return { messageId, targetUserId, reporterId };
}

export function buildPreviewComponents(report: CaseReport): any[] {
  const token = buildStatelessToken(report);
  return [
    {
      type: 17,
      components: [
        { type: 10, content: buildPreviewContainerText(report) },
        {
          type: 1,
          components: [
            { type: 2, custom_id: `${CASE_ACTION_PREFIX}:warn:${token}`, style: ButtonStyle.Secondary, label: 'Warn' },
            { type: 2, custom_id: `${CASE_ACTION_PREFIX}:timeout:${token}`, style: ButtonStyle.Secondary, label: 'Timeout' },
            { type: 2, custom_id: `${CASE_ACTION_PREFIX}:kick:${token}`, style: ButtonStyle.Secondary, label: 'Kick' }
          ]
        }
      ]
    }
  ];
}

export async function buildLoggedComponents(report: CaseReport, reason: string, resolvedLabel: string): Promise<{ components: any[]; files: AttachmentBuilder[] }> {
  const { files, mediaGalleryItems } = await prepareReuploadedMedia(report.attachments);
  const innerComponents = [
    { type: 10, content: buildLogBody(report, reason, resolvedLabel) },
    ...(mediaGalleryItems.length ? [{ type: 12, items: mediaGalleryItems }] : []),
    ...buildNonMediaFileSection(report.attachments)
  ];
  return { components: [{ type: 17, components: innerComponents }], files };
}

export async function performGuildAction({ member, actionType, reason, durationSeconds }: GuildActionParams): Promise<void> {
  switch (actionType) {
    case 'WARN': return;
    case 'TIMEOUT':
      if (!durationSeconds || durationSeconds <= 0) throw new Error('Duration required for timeout');
      await member.timeout(durationSeconds * 1000, reason || 'Timed out by moderator');
      return;
    case 'KICK':
      await member.kick(reason || 'Kicked by moderator');
      return;
    default: throw new Error('Unsupported case action');
  }
}

export async function sendCaseLogToChannel(context: any, components: any[], files: any[] = [], pingUserId: string | null = null): Promise<boolean> {
  const client = context?.discordClient ?? context?.client;
  const guild = client?.guilds?.cache?.get?.(context?.guildId);
  const channel = guild ? await guild.channels.fetch(CASE_REPORT_CHANNEL_ID).catch(() => null) : null;
  if (!channel?.isTextBased?.() || typeof channel.send !== 'function') return false;

  try {
    const identity = getWebhookIdentity();
    const avatarBuffer = await fetchAvatarBuffer(identity.avatarUrl);
    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find((h: any) => h.owner?.id === client.user?.id && h.name === identity.name)
      ?? webhooks.find((h: any) => h.owner?.id === client.user?.id);

    if (!webhook) {
      webhook = await channel.createWebhook({
        name: identity.name,
        ...(avatarBuffer ? { avatar: avatarBuffer } : {})
      });
    } else if (webhook.name !== identity.name || avatarBuffer) {
      webhook = await webhook.edit({ name: identity.name, ...(avatarBuffer ? { avatar: avatarBuffer } : {}) });
    }

    if (pingUserId) {
      await webhook.send({ content: `<@${pingUserId}>`, allowedMentions: { users: [pingUserId], parse: [] } });
    }

    await webhook.send({
      flags: MessageFlags.IsComponentsV2,
      components,
      allowedMentions: { parse: [] },
      ...(files.length ? { files } : {})
    });
    return true;
  } catch {
    try {
      await channel.send({
        flags: MessageFlags.IsComponentsV2,
        components,
        allowedMentions: { parse: [] },
        ...(files.length ? { files } : {})
      });
      return true;
    } catch { return false; }
  }
}

export async function buildReportFromToken(interaction: any, token: string): Promise<CaseReport | null> {
  const parsed = parseStatelessToken(token);
  if (!parsed) return null;

  const sourceChannel = interaction.channel;
  const sourceMessage = sourceChannel?.isTextBased?.()
    ? await sourceChannel.messages.fetch(parsed.messageId).catch(() => null)
    : null;
  if (!sourceMessage?.author?.id) return null;

  const limit = computeMessageContentLimit({
    guildId: interaction.guildId,
    channelId: sourceChannel.id,
    messageId: sourceMessage.id,
    targetUserId: sourceMessage.author.id,
    reporterId: parsed.reporterId,
    targetUsername: sourceMessage.author.tag ?? sourceMessage.author.username ?? 'Unknown'
  });

  return {
    guildId: interaction.guildId,
    reporterId: parsed.reporterId,
    targetUserId: sourceMessage.author.id,
    targetUsername: sourceMessage.author.tag ?? sourceMessage.author.username ?? 'Unknown',
    messageId: sourceMessage.id,
    channelId: sourceChannel.id,
    messageUrl: buildMessageUrl(interaction.guildId, sourceChannel.id, sourceMessage.id),
    reportedTimestamp: Math.floor(Date.now() / 1000),
    messageContent: extractDisplayMessageContent(sourceMessage, limit),
    attachments: getAttachmentData(sourceMessage)
  };
}

export async function applyModerationAction(interaction: any, context: BotContext, actionType: string, reason: string, token: string, durationSeconds: number | null = null): Promise<InteractionResult> {
  const isModal = interaction.isModalSubmit?.();

  const respond = (content: string): InteractionResult => {
    const v2Payload = {
      components: [{ type: 17, components: [{ type: 10, content }] }],
      allowedMentions: { parse: [] }
    };

    if (isModal) {
      return { type: 'REPLY', message: content, components: [], ephemeral: true, allowedMentions: { parse: [] } };
    }

    const shouldEditInPlace = interaction.isButton?.() || interaction.isStringSelectMenu?.() || interaction.isFromMessage?.();
    if (shouldEditInPlace) {
      return { type: 'UPDATE', content: null as any, components: v2Payload.components, allowedMentions: { parse: [] } } as any;
    }

    return { type: 'REPLY', message: content, components: [], ephemeral: true, allowedMentions: { parse: [] } };
  };

  const report = await buildReportFromToken(interaction, token);
  if (!report) return respond('The source message is unavailable for this case.');

  const member = await interaction.guild.members.fetch(report.targetUserId).catch(() => null);
  if (!member || member.id === interaction.user.id) return respond('The reported user is not available for this action.');

  if (actionType === 'KICK' && !canKick(interaction.member, interaction.guild)) return respond('Only administrators and the server owner can use Kick.');

  const moderationService = getModerationService(context);
  if (!moderationService) return respond('Moderation service unavailable.');

  const moderatorName = interaction.user.tag ?? interaction.user.username;

  try {
    await moderationService.createCase({
      guildId: interaction.guildId,
      targetUserId: report.targetUserId,
      targetUsername: report.targetUsername,
      moderatorUserId: interaction.user.id,
      moderatorUsername: moderatorName,
      type: actionType,
      reason: `${reason} (reported message: ${report.messageUrl})`,
      durationSeconds
    });

    await performGuildAction({ member, actionType, reason, durationSeconds: durationSeconds ?? undefined });
  } catch (error: any) {
    return respond(`Failed to apply action: ${error.message}`);
  }

  const resolvedLabel = actionType === 'TIMEOUT'
    ? `TIMEOUT (expires <t:${Math.floor(Date.now() / 1000) + (durationSeconds ?? 0)}:R>)`
    : actionType;

  const { components, files } = await buildLoggedComponents(report, reason, resolvedLabel);

  const didLog = await sendCaseLogToChannel(
    { ...context, guildId: interaction.guildId },
    components, files, report.targetUserId
  );

  return respond(didLog ? `Done. ${resolvedLabel}` : `Done. ${resolvedLabel} (action applied, log failed)`);
}
