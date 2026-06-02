import {
  ActionRowBuilder,
  ApplicationCommandType,
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

const CASE_ACTION_PREFIX = 'case:a';
const CASE_TIMEOUT_MODAL_PREFIX = 'case:t';
const CASE_KICK_MODAL_PREFIX = 'case:k';
const CASE_WARN_MODAL_PREFIX = 'case:w';

const CASE_REPORT_CHANNEL_ID = '1475835319571189820';
const CASE_ALLOWED_ROLE_ID = '1457403601512169724';
const CASE_WEBHOOK_NAME = 'AOI Case Logger';
const CASE_WEBHOOK_AVATAR_URL = ''; // e.g. https://example.com/avatar.png

const TIMEOUT_PRESETS = [
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

const MODERATION_SCHEMA = {
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
};

function getModerationService(context) {
  return context?.moderationService ?? context?.services?.moderationService ?? null;
}

function truncate(value, maxLength) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function escapeMarkdown(text) {
  return String(text ?? '').replace(/[[\]()]/g, '\\$&');
}

function textInputRow(textInput) {
  return new ActionRowBuilder().addComponents(textInput);
}

function caseEmbed(title, description, color) {
  return new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
}

function isAdminOrOwner(member, guild) {
  if (!member) return false;
  if (member.id === guild.ownerId) return true;
  return member.permissions?.has?.(PermissionFlagsBits.Administrator) ?? false;
}

function hasAllowedRole(member) {
  const roleCache = member?.roles?.cache;
  if (roleCache?.some) return roleCache.some((role) => role.id === CASE_ALLOWED_ROLE_ID);
  const roleIds = Array.isArray(member?.roles) ? member.roles : [];
  return roleIds.some((id) => String(id) === CASE_ALLOWED_ROLE_ID);
}

function canUseCaseCommand(member, guild) {
  return isAdminOrOwner(member, guild) || hasAllowedRole(member);
}

function canKick(member, guild) {
  return isAdminOrOwner(member, guild);
}

function looksLikeMediaUrl(url) {
  const value = String(url ?? '').trim();
  if (!value) return false;
  const path = value.split('?')[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|mp4|mov|webm)$/i.test(path)) return true;
  return /tenor\.com|giphy\.com|cdn\.discordapp\.com|media\.discordapp\.net/i.test(value);
}

function extractUrlsFromText(text) {
  const matches = String(text ?? '').match(/https?:\/\/\S+/gi);
  return matches ? matches.map((m) => m.trim()) : [];
}

function getAttachmentData(message) {
  const items = [];
  const pushUnique = (url, name = 'attachment', isMedia = true) => {
    if (!url) return;
    if (items.some((entry) => entry.url === url)) return;
    items.push({ url, name, isMedia });
  };

  const attachments = [...(message.attachments?.values?.() ?? [])];
  for (const a of attachments) {
    const contentType = String(a.contentType ?? '');
    const urlPath = String(a.url ?? '').split('?')[0];
    const isMedia = contentType.startsWith('image/')
      || /\.(png|jpe?g|gif|webp|mp4|mov|webm)$/i.test(urlPath);
    pushUnique(a.url, a.name ?? 'attachment', isMedia);
  }

  for (const embed of message.embeds ?? []) {
    const embedCandidates = [
      embed.image?.url,
      embed.video?.url,
      embed.thumbnail?.url,
      embed.url
    ];
    for (const url of embedCandidates) {
      if (looksLikeMediaUrl(url)) {
        pushUnique(url, 'embed-media', true);
      }
    }
  }

  for (const url of extractUrlsFromText(message.content)) {
    if (looksLikeMediaUrl(url)) {
      pushUnique(url, 'linked-media', true);
    }
  }

  return items.slice(0, 5);
}

function buildMessageUrl(guildId, channelId, messageId) {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}


function getWebhookIdentity() {
  const name = String(process.env.CASE_WEBHOOK_NAME ?? CASE_WEBHOOK_NAME).trim() || CASE_WEBHOOK_NAME;
  const avatarUrl = String(process.env.CASE_WEBHOOK_AVATAR_URL ?? CASE_WEBHOOK_AVATAR_URL).trim();
  return {
    name,
    avatarUrl: avatarUrl || null
  };
}

async function fetchAvatarBuffer(avatarUrl) {
  if (!avatarUrl) return null;
  try {
    const response = await fetch(avatarUrl);
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    return Buffer.from(bytes);
  } catch {
    return null;
  }
}

function stripLikelyMediaUrls(text) {
  let cleaned = String(text ?? '');
  for (const url of extractUrlsFromText(cleaned)) {
    if (looksLikeMediaUrl(url)) {
      cleaned = cleaned.replace(url, '');
    }
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

function extractDisplayMessageContent(message, limit) {
  const raw = String(message?.content ?? '').trim();
  if (!raw) return 'No text content.';
  const sanitized = stripLikelyMediaUrls(raw);
  if (!sanitized) return 'No text content.';
  return truncate(sanitized, limit);
}

function computeMessageContentLimit({ guildId, channelId, messageId, targetUserId, reporterId, targetUsername }) {
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

function buildPreviewContainerText(report) {
  const hasContent = report.messageContent && report.messageContent !== 'No text content.';
  const lines = [
    '# CASE REPORT',
    `**Author**: <@${report.targetUserId}> (${escapeMarkdown(report.targetUsername)})`,
    `**Reported By**: <@${report.reporterId}>`,
    `**Reported At**: <t:${report.reportedTimestamp}:F>`
  ];
  if (hasContent) {
    lines.push(`**Message Content**: [${report.messageContent}](${report.messageUrl})`);
  } else {
    lines.push(`[view message](${report.messageUrl})`);
  }
  return lines.join('\n');
}

function buildLogBody(report, reason, resolvedLabel) {
  const hasContent = report.messageContent && report.messageContent !== 'No text content.';
  const lines = [
    '# CASE REPORT',
    `**Author**: <@${report.targetUserId}> (${escapeMarkdown(report.targetUsername)})`,
    `**Reported By**: <@${report.reporterId}>`,
    `**Reported At**: <t:${report.reportedTimestamp}:F>`,
    `**Reason**: ${escapeMarkdown(reason)}`
  ];
  if (hasContent) {
    lines.push(`**Message Content**: [${report.messageContent}](${report.messageUrl})`);
  } else {
    lines.push(`[view message](${report.messageUrl})`);
  }
  lines.push(`**Action Taken**: ${resolvedLabel}`);
  return lines.join('\n');
}

async function fetchAttachmentBuffer(url, name) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, name };
  } catch {
    return null;
  }
}

async function prepareReuploadedMedia(attachments = []) {
  const files = [];
  const mediaGalleryItems = [];

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

function buildNonMediaFileSection(attachments = []) {
  const fileAttachments = attachments.filter((a) => !a.isMedia && a.url);
  if (!fileAttachments.length) return [];
  const links = fileAttachments.map((a, i) => `[file ${i + 1}](${a.url})`).join(', ');
  return [{ type: 10, content: `**Files**: ${links}` }];
}

function buildStatelessToken(report) {
  return `${report.messageId}:${report.targetUserId}:${report.reporterId}`;
}

function parseStatelessToken(token) {
  const [messageId, targetUserId, reporterId] = String(token ?? '').split(':');
  if (!messageId || !targetUserId || !reporterId) return null;
  return { messageId, targetUserId, reporterId };
}

function buildPreviewComponents(report) {
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
            { type: 2, custom_id: `${CASE_ACTION_PREFIX}:timeout:${token}`, style: ButtonStyle.Primary, label: 'Timeout' },
            { type: 2, custom_id: `${CASE_ACTION_PREFIX}:kick:${token}`, style: ButtonStyle.Danger, label: 'Kick' }
          ]
        }
      ]
    }
  ];
}

async function buildLoggedComponents(report, reason, resolvedLabel) {
  const { files, mediaGalleryItems } = await prepareReuploadedMedia(report.attachments);

  const innerComponents = [
    { type: 10, content: buildLogBody(report, reason, resolvedLabel) },
    ...(mediaGalleryItems.length ? [{ type: 12, items: mediaGalleryItems }] : []),
    ...buildNonMediaFileSection(report.attachments)
  ];

  return {
    components: [{ type: 17, components: innerComponents }],
    files
  };
}

async function performGuildAction({ member, actionType, reason, durationSeconds }) {
  switch (actionType) {
    case 'WARN':
      return;
    case 'TIMEOUT':
      if (!durationSeconds || durationSeconds <= 0) throw new Error('Duration required for timeout');
      await member.timeout(durationSeconds * 1000, reason || 'Timed out by moderator');
      return;
    case 'KICK':
      await member.kick(reason || 'Kicked by moderator');
      return;
    default:
      throw new Error('Unsupported case action');
  }
}

async function sendCaseLogToChannel(context, components, files = [], pingUserId = null) {
  const client = context?.discordClient ?? context?.client;
  const guild = client?.guilds?.cache?.get?.(context?.guildId);
  const channel = guild ? await guild.channels.fetch(CASE_REPORT_CHANNEL_ID).catch(() => null) : null;
  if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
    return false;
  }

  try {
    const identity = getWebhookIdentity();
    const avatarBuffer = await fetchAvatarBuffer(identity.avatarUrl);
    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find((h) => h.owner?.id === client.user?.id && h.name === identity.name)
      ?? webhooks.find((h) => h.owner?.id === client.user?.id);

    if (!webhook) {
      webhook = await channel.createWebhook({
        name: identity.name,
        ...(avatarBuffer ? { avatar: avatarBuffer } : {})
      });
    } else if (webhook.name !== identity.name || avatarBuffer) {
      webhook = await webhook.edit({
        name: identity.name,
        ...(avatarBuffer ? { avatar: avatarBuffer } : {})
      });
    }

    if (pingUserId) {
      await webhook.send({
        content: `<@${pingUserId}>`,
        allowedMentions: { users: [pingUserId], parse: [] }
      });
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
    } catch {
      return false;
    }
  }
}

async function buildReportFromToken(interaction, token) {
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

async function handleCaseCommand(interaction) {
  if (!interaction.guildId || !interaction.guild || !interaction.targetMessage) {
    await interaction.reply({ content: 'This command can only be used on a server message.', ephemeral: true });
    return;
  }

  if (!canUseCaseCommand(interaction.member, interaction.guild)) {
    await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    return;
  }

  const targetMessage = interaction.targetMessage;
  if (!targetMessage.author?.id) {
    await interaction.reply({ content: 'This message cannot be reported.', ephemeral: true });
    return;
  }
  if (targetMessage.author.id === interaction.user.id) {
    await interaction.reply({ content: 'You cannot open a case on your own message.', ephemeral: true });
    return;
  }

  const limit = computeMessageContentLimit({
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    messageId: targetMessage.id,
    targetUserId: targetMessage.author.id,
    reporterId: interaction.user.id,
    targetUsername: targetMessage.author.tag ?? targetMessage.author.username ?? 'Unknown'
  });

  const report = {
    guildId: interaction.guildId,
    reporterId: interaction.user.id,
    targetUserId: targetMessage.author.id,
    targetUsername: targetMessage.author.tag ?? targetMessage.author.username ?? 'Unknown',
    messageId: targetMessage.id,
    channelId: interaction.channelId,
    messageUrl: buildMessageUrl(interaction.guildId, interaction.channelId, targetMessage.id),
    reportedTimestamp: Math.floor(Date.now() / 1000),
    messageContent: extractDisplayMessageContent(targetMessage, limit),
    attachments: getAttachmentData(targetMessage)
  };

  await interaction.reply({
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: buildPreviewComponents(report),
    allowedMentions: { parse: [] }
  });
}

// FIX: Explicitly gate on isModalSubmit so modals always use reply(),
// and buttons/selects always use update(). Previously, interaction.message
// being present on modal submissions caused update() to be attempted on
// modal interactions, which Discord rejects — the silent catch() then
// prevented the fallback reply() from ever running.
async function applyModerationAction(interaction, context, actionType, reason, token, durationSeconds = null, timeoutLabel = null) {
  const isModal = interaction.isModalSubmit?.();

  const respond = async (content) => {
    const v2Payload = {
      components: [{ type: 17, components: [{ type: 10, content }] }],
      allowedMentions: { parse: [] }
    };

    if (isModal) {
      // Modals must always use reply(), never update()
      await interaction.reply({ content, components: [], ephemeral: true, allowedMentions: { parse: [] } });
      return;
    }

    const shouldEditInPlace =
      interaction.isButton?.() ||
      interaction.isStringSelectMenu?.() ||
      interaction.isFromMessage?.();

    if (shouldEditInPlace) {
      try {
        await interaction.update(v2Payload);
        return;
      } catch {}
    }

    await interaction.reply({ content, components: [], ephemeral: true, allowedMentions: { parse: [] } });
  };

  const report = await buildReportFromToken(interaction, token);
  if (!report) {
    await respond('The source message is unavailable for this case.');
    return;
  }

  const member = await interaction.guild.members.fetch(report.targetUserId).catch(() => null);
  if (!member || member.id === interaction.user.id) {
    await respond('The reported user is not available for this action.');
    return;
  }

  if (actionType === 'KICK' && !canKick(interaction.member, interaction.guild)) {
    await respond('Only administrators and the server owner can use Kick.');
    return;
  }

  const moderationService = getModerationService(context);
  if (!moderationService) {
    await respond('Moderation service unavailable.');
    return;
  }

  const moderatorName = interaction.user.tag ?? interaction.user.username;

  try {
    const caseData = await moderationService.createCase({
      guildId: interaction.guildId,
      targetUserId: report.targetUserId,
      targetUsername: report.targetUsername,
      moderatorUserId: interaction.user.id,
      moderatorUsername: moderatorName,
      type: actionType,
      reason: `${reason} (reported message: ${report.messageUrl})`,
      durationSeconds
    });

    await performGuildAction({ member, actionType, reason, durationSeconds });
  } catch (error) {
    await respond(`Failed to apply action: ${error.message}`);
    return;
  }

  const resolvedLabel = actionType === 'TIMEOUT'
    ? `TIMEOUT (expires <t:${Math.floor(Date.now() / 1000) + durationSeconds}:R>)`
    : actionType;

  const { components, files } = await buildLoggedComponents(report, reason, resolvedLabel);

  const didLog = await sendCaseLogToChannel(
    { ...context, guildId: interaction.guildId },
    components,
    files,
    report.targetUserId
  );

  await respond(didLog ? `Done. ${resolvedLabel}` : `Done. ${resolvedLabel} (action applied, log failed)`);
}

async function handleCaseAction(interaction) {
  const parts = interaction.customId.split(':');
  const prefix = `${parts[0]}:${parts[1]}`;
  if (prefix !== CASE_ACTION_PREFIX) return;

  const actionKey = parts[2];
  const token = parts.slice(3).join(':');

  if (actionKey === 'warn') {
    const modal = new ModalBuilder()
      .setCustomId(`${CASE_WARN_MODAL_PREFIX}:${token}`)
      .setTitle('Warn User');
    modal.addComponents(
      {
        type: 18,
        label: 'Select a preset reason',
        component: {
          type: 3,
          custom_id: 'reason_preset',
          placeholder: 'Choose a reason',
          required: false,
          min_values: 0,
          options: [
            { label: 'No preset (write below)', value: '__none__' },
            { label: 'Inappropriate language', value: 'Inappropriate language' },
            { label: 'Spam', value: 'Spam' },
            { label: 'Harassment', value: 'Harassment' },
            { label: 'Breaking server rules', value: 'Breaking server rules' },
            { label: 'Advertising', value: 'Advertising' }
          ]
        }
      },
      new ActionRowBuilder()
        .addComponents(
          new TextInputBuilder()
            .setCustomId('custom_reason')
            .setLabel('Custom reason')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(500)
        )
    );
    try {
      await interaction.showModal(modal);
    } catch (error) {
      await interaction.reply({ content: `Failed to open warn form: ${error?.message ?? 'unknown error'}`, ephemeral: true });
    }
    return;
  }

  if (actionKey === 'timeout') {
    const modal = new ModalBuilder()
      .setCustomId(`${CASE_TIMEOUT_MODAL_PREFIX}:${token}`)
      .setTitle('Timeout User');
    modal.addComponents(
      textInputRow(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason for timeout')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500)
      ),
      {
        type: 18,
        label: 'Select duration',
        component: {
          type: 3,
          custom_id: 'duration_preset',
          placeholder: 'Choose a duration',
          required: false,
          min_values: 0,
          options: [
            { label: 'No preset (type below)', value: '__none__' },
            ...TIMEOUT_PRESETS.map((p) => ({ label: p.label, value: String(p.minutes) }))
          ]
        }
      },
      textInputRow(
        new TextInputBuilder()
          .setCustomId('custom_duration')
          .setLabel('Or type custom minutes')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('e.g. 30 (1-10080)')
      )
    );
    try {
      await interaction.showModal(modal);
    } catch (error) {
      await interaction.reply({ content: `Failed to open timeout form: ${error?.message ?? 'unknown error'}`, ephemeral: true });
    }
    return;
  }

  if (actionKey === 'kick') {
    const modal = new ModalBuilder()
      .setCustomId(`${CASE_KICK_MODAL_PREFIX}:${token}`)
      .setTitle('Kick User');
    modal.addComponents(
      textInputRow(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason for kick')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500)
      )
    );
    try {
      await interaction.showModal(modal);
    } catch (error) {
      await interaction.reply({ content: `Failed to open kick form: ${error?.message ?? 'unknown error'}`, ephemeral: true });
    }
    return;
  }
}

async function handleCaseWarnModal(interaction, context) {
  const [presetReason] = interaction.fields.getStringSelectValues('reason_preset');
  const customReason = interaction.fields.getTextInputValue('custom_reason');

  const hasPreset = presetReason && presetReason !== '__none__';
  const hasCustom = customReason && customReason.trim().length > 0;

  if (!hasPreset && !hasCustom) {
    await interaction.reply({ content: 'Please select a preset reason or provide a custom reason.', ephemeral: true });
    return;
  }

  const reason = truncate(hasCustom ? customReason : presetReason, 500);
  const token = interaction.customId.slice(`${CASE_WARN_MODAL_PREFIX}:`.length);
  await applyModerationAction(interaction, context, 'WARN', reason, token);
}

async function handleCaseTimeoutModal(interaction, context) {
  const reason = truncate(interaction.fields.getTextInputValue('reason'), 500);
  const token = interaction.customId.slice(`${CASE_TIMEOUT_MODAL_PREFIX}:`.length);

  if (!token) {
    await interaction.reply({ content: 'Invalid timeout payload.', ephemeral: true });
    return;
  }

  const [presetMinutes] = interaction.fields.getStringSelectValues('duration_preset');
  const customMinutesText = interaction.fields.getTextInputValue('custom_duration');

  const hasPreset = presetMinutes && presetMinutes !== '__none__';
  const hasCustom = customMinutesText && customMinutesText.trim().length > 0;

  if (!hasPreset && !hasCustom) {
    await interaction.reply({ content: 'Please select a preset duration or type a custom duration in minutes.', ephemeral: true });
    return;
  }

  const durationMinutes = hasPreset
    ? Number.parseInt(presetMinutes, 10)
    : Number.parseInt(customMinutesText, 10);

  if (!durationMinutes || durationMinutes < 1 || durationMinutes > 10080) {
    await interaction.reply({ content: 'Duration must be between 1 and 10080 minutes.', ephemeral: true });
    return;
  }

  const preset = TIMEOUT_PRESETS.find((p) => p.minutes === durationMinutes);
  const label = preset?.label ?? `${durationMinutes} minute(s)`;

  await applyModerationAction(interaction, context, 'TIMEOUT', reason, token, durationMinutes * 60, label);
}

async function handleCaseKickModal(interaction, context) {
  const reason = truncate(interaction.fields.getTextInputValue('reason'), 500);
  const token = interaction.customId.slice(`${CASE_KICK_MODAL_PREFIX}:`.length);
  await applyModerationAction(interaction, context, 'KICK', reason, token);
}

export default {
  name: 'moderation',
  configSchema: MODERATION_SCHEMA,
  commands: [
    {
      name: 'case',
      type: ApplicationCommandType.Message,
      defer: false,
      ephemeral: true,
      async execute(interaction) {
        try {
          await handleCaseCommand(interaction);
        } catch (error) {
          await interaction.reply({ content: `Case command failed: ${error?.message ?? 'unknown error'}`, ephemeral: true }).catch(() => null);
        }
      }
    }
  ],
  events: [
    {
      name: 'interactionCreate',
      async execute(interaction, context) {
        try {
          if (interaction.isButton() && interaction.customId?.startsWith(`${CASE_ACTION_PREFIX}:`)) {
            await handleCaseAction(interaction);
            return;
          }
          if (interaction.isModalSubmit() && interaction.customId?.startsWith(`${CASE_WARN_MODAL_PREFIX}:`)) {
            await handleCaseWarnModal(interaction, context);
            return;
          }
          if (interaction.isModalSubmit() && interaction.customId?.startsWith(`${CASE_TIMEOUT_MODAL_PREFIX}:`)) {
            await handleCaseTimeoutModal(interaction, context);
            return;
          }
          if (interaction.isModalSubmit() && interaction.customId?.startsWith(`${CASE_KICK_MODAL_PREFIX}:`)) {
            await handleCaseKickModal(interaction, context);
          }
        } catch (error) {
          if (!interaction.deferred && !interaction.replied) {
            await interaction.reply({ content: `Case action failed: ${error?.message ?? 'unknown error'}`, ephemeral: true }).catch(() => null);
            return;
          }
          await interaction.followUp({ content: `Case action failed: ${error?.message ?? 'unknown error'}`, ephemeral: true }).catch(() => null);
        }
      }
    },
    {
      name: 'messageDelete',
      async execute(message, context) {
        const moderationService = getModerationService(context);
        if (!moderationService || !message?.guild || !message.mentions?.users?.size) return;
        await moderationService.recordGhostPing({
          guild_id: message.guild.id,
          message_id: message.id,
          channel_id: message.channel.id,
          author_id: message.author?.id ?? null,
          mentions: [...message.mentions.users.keys()],
          created_at: new Date().toISOString()
        });
      }
    },
    {
      name: 'messageCreate',
      async execute(message, context) {
        const moderationService = getModerationService(context);
        if (!moderationService || !message.guild || message.author.bot) return;
        const afk = await moderationService.getAfk(message.guild.id, message.author.id);
        if (afk) {
          await moderationService.clearAfk(message.guild.id, message.author.id);
          await message.channel.send({
            embeds: [caseEmbed('Welcome Back', `<@${message.author.id}> your AFK status has been removed.`, 0x57f287)]
          });
        }
        await moderationService.touchLoaLastSeen(message.guild.id, message.author.id).catch(() => null);
      }
    }
  ]
};
