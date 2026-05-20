import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

const CASE_ACTION_PREFIX = 'case:a';
const CASE_TIMEOUT_SELECT_PREFIX = 'case:s';
const CASE_TIMEOUT_MODAL_PREFIX = 'case:t';
const CASE_KICK_MODAL_PREFIX = 'case:k';
const CASE_WARN_MODAL_PREFIX = 'case:w';

const CASE_REPORT_CHANNEL_ID = '1475835319571189820';
const CASE_ALLOWED_ROLE_ID = '1457403601512169724';
const CASE_WEBHOOK_NAME = 'AOI Case Logger';

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

function getAttachmentData(message) {
  const attachments = [...(message.attachments?.values?.() ?? [])];
  return attachments.slice(0, 5).map((a) => {
    const contentType = String(a.contentType ?? '');
    const urlPath = String(a.url ?? '').split('?')[0];
    // GIFs, images all go to the media gallery
    const isMedia = contentType.startsWith('image/')
      || /\.(png|jpe?g|gif|webp)$/i.test(urlPath);
    return {
      url: a.url,
      name: a.name ?? 'attachment',
      isMedia
    };
  });
}

function buildMessageUrl(guildId, channelId, messageId) {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

function buildTimeoutPresetText() {
  return TIMEOUT_PRESETS.map((p, i) => `${i + 1}. ${p.label}`).join(', ');
}

function buildTimeoutSelectOptions() {
  return TIMEOUT_PRESETS.map((preset) => ({
    label: preset.label,
    value: String(preset.minutes)
  }));
}

function stripLikelyMediaUrls(text) {
  return String(text ?? '')
    .replace(/https?:\/\/\S+\.(?:png|jpe?g|gif|webp|mp4|mov|webm)(\?\S*)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
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
  // Scaffold for the preview (no reason line)
  const scaffold = [
    '# Message Case Report',
    `**Author**: <@${targetUserId}> (${escapeMarkdown(targetUsername)})`,
    `**Reported By**: <@${reporterId}>`,
    `**Reported At**: <t:${Math.floor(Date.now() / 1000)}:F>`,
    `[](${messageUrl})`
  ].join('\n');
  return Math.max(0, 4000 - scaffold.length - 16);
}

// Preview body shown in the ephemeral before an action is chosen — no reason yet
function buildPreviewBody(report) {
  const linkLabel = report.messageContent || 'view message';
  return [
    '# Message Case Report',
    `**Author**: <@${report.targetUserId}> (${escapeMarkdown(report.targetUsername)})`,
    `**Reported By**: <@${report.reporterId}>`,
    `**Reported At**: <t:${report.reportedTimestamp}:F>`,
    `[${linkLabel}](${report.messageUrl})`
  ].join('\n');
}

// Log body shown after action is taken — includes reason and action
function buildLogBody(report, reason, resolvedLabel) {
  const linkLabel = report.messageContent || 'view message';
  return [
    '# Message Case Report',
    `**Author**: <@${report.targetUserId}> (${escapeMarkdown(report.targetUsername)})`,
    `**Reported By**: <@${report.reporterId}>`,
    `**Reported At**: <t:${report.reportedTimestamp}:F>`,
    `**Reason**: ${escapeMarkdown(reason)}`,
    `[${linkLabel}](${report.messageUrl})`,
    `**Action Taken**: ${resolvedLabel}`
  ].join('\n');
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
    if (!fetched) continue;
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

// Preview shown in ephemeral — no reason, no action taken, has buttons
function buildPreviewComponents(report) {
  const token = buildStatelessToken(report);
  return [
    {
      type: 1,
      components: [
        { type: 2, custom_id: `${CASE_ACTION_PREFIX}:warn:${token}`, style: ButtonStyle.Secondary, label: 'Warn' },
        { type: 2, custom_id: `${CASE_ACTION_PREFIX}:timeout:${token}`, style: ButtonStyle.Primary, label: 'Timeout' },
        { type: 2, custom_id: `${CASE_ACTION_PREFIX}:kick:${token}`, style: ButtonStyle.Danger, label: 'Kick' }
      ]
    }
  ];
}

// Log sent to the report channel — reason + action taken, gallery between content and action
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
    throw new Error('Case report channel unavailable');
  }

  try {
    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find((h) => h.name === CASE_WEBHOOK_NAME && h.owner?.id === client.user?.id);
    if (!webhook) webhook = await channel.createWebhook({ name: CASE_WEBHOOK_NAME });

    // Ping line outside the container, sent by webhook itself.
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
  } catch {
    await channel.send({
      flags: MessageFlags.IsComponentsV2,
      components,
      allowedMentions: { parse: [] },
      ...(files.length ? { files } : {})
    });
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
    ephemeral: true,
    content: buildPreviewBody(report),
    components: buildPreviewComponents(report),
    allowedMentions: { parse: [] }
  });
}

// Central action handler. reason and token passed explicitly.
async function applyModerationAction(interaction, context, actionType, reason, token, durationSeconds = null, timeoutLabel = null) {
  const respond = async (content) => {
    const payload = {
      content,
      components: [],
      allowedMentions: { parse: [] }
    };
    if (
      interaction.isButton?.() ||
      interaction.isStringSelectMenu?.() ||
      interaction.isFromMessage?.()
    ) {
      await interaction.update(payload);
      return;
    }
    await interaction.reply({ ...payload, ephemeral: true });
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
  const moderatorName = interaction.user.tag ?? interaction.user.username;

  try {
    await performGuildAction({ member, actionType, reason, durationSeconds });

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
  } catch (error) {
    await respond(`Failed to apply action: ${error.message}`);
    return;
  }

  const resolvedLabel = actionType === 'TIMEOUT'
    ? `TIMEOUT (${timeoutLabel ?? `${Math.floor(durationSeconds / 60)} minute(s)`})`
    : actionType;

  const { components, files } = await buildLoggedComponents(report, reason, resolvedLabel);

  await sendCaseLogToChannel(
    { ...context, guildId: interaction.guildId },
    components,
    files,
    report.targetUserId
  );

  await respond(`Done. ${resolvedLabel}`);
}

// Warn and kick open reason modals. Timeout first opens a one-select duration menu.
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
      textInputRow(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason for warning')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
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
    await interaction.update({
      content: 'Select timeout duration:',
      components: [
        {
          type: 1,
          components: [
            {
              type: 3,
              custom_id: `${CASE_TIMEOUT_SELECT_PREFIX}:${token}`,
              placeholder: 'Choose duration',
              min_values: 1,
              max_values: 1,
              options: buildTimeoutSelectOptions()
            }
          ]
        }
      ],
      allowedMentions: { parse: [] }
    });
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
  }
}

async function handleTimeoutDurationSelect(interaction) {
  const token = interaction.customId.slice(`${CASE_TIMEOUT_SELECT_PREFIX}:`.length);
  const minutes = Number.parseInt(interaction.values?.[0] ?? '', 10);
  const preset = TIMEOUT_PRESETS.find((p) => p.minutes === minutes);

  if (!preset || !token) {
    await interaction.update({
      content: `Invalid duration selection. Choose one of: ${buildTimeoutPresetText()}`,
      components: [],
      allowedMentions: { parse: [] }
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`${CASE_TIMEOUT_MODAL_PREFIX}:${preset.minutes}:${token}`)
    .setTitle('Timeout Reason');
  modal.addComponents(
    textInputRow(
      new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason for timeout')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500)
    )
  );
  try {
    await interaction.showModal(modal);
  } catch (error) {
    await interaction.reply({ content: `Failed to open timeout reason form: ${error?.message ?? 'unknown error'}`, ephemeral: true });
  }
}

async function handleCaseWarnModal(interaction, context) {
  const reason = truncate(interaction.fields.getTextInputValue('reason'), 500);
  const token = interaction.customId.slice(`${CASE_WARN_MODAL_PREFIX}:`.length);
  await applyModerationAction(interaction, context, 'WARN', reason, token);
}

async function handleCaseTimeoutModal(interaction, context) {
  const reason = truncate(interaction.fields.getTextInputValue('reason'), 500);
  const raw = interaction.customId.slice(`${CASE_TIMEOUT_MODAL_PREFIX}:`.length);
  const [minutesText, ...tokenParts] = raw.split(':');
  const minutes = Number.parseInt(minutesText, 10);
  const token = tokenParts.join(':');
  const preset = TIMEOUT_PRESETS.find((p) => p.minutes === minutes);

  if (!preset || !token) {
    await interaction.reply({ content: 'Invalid timeout payload.', ephemeral: true });
    return;
  }

  await applyModerationAction(interaction, context, 'TIMEOUT', reason, token, preset.minutes * 60, preset.label);
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
        await handleCaseCommand(interaction);
      }
    }
  ],
  events: [
    {
      name: 'interactionCreate',
      async execute(interaction, context) {
        if (interaction.isButton() && interaction.customId.startsWith(`${CASE_ACTION_PREFIX}:`)) {
          await handleCaseAction(interaction);
          return;
        }
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith(`${CASE_TIMEOUT_SELECT_PREFIX}:`)) {
          await handleTimeoutDurationSelect(interaction);
          return;
        }
        if (interaction.isModalSubmit() && interaction.customId.startsWith(`${CASE_WARN_MODAL_PREFIX}:`)) {
          await handleCaseWarnModal(interaction, context);
          return;
        }
        if (interaction.isModalSubmit() && interaction.customId.startsWith(`${CASE_TIMEOUT_MODAL_PREFIX}:`)) {
          await handleCaseTimeoutModal(interaction, context);
          return;
        }
        if (interaction.isModalSubmit() && interaction.customId.startsWith(`${CASE_KICK_MODAL_PREFIX}:`)) {
          await handleCaseKickModal(interaction, context);
        }
      }
    },
    {
      name: 'messageDelete',
      async execute(message, context) {
        const moderationService = getModerationService(context);
        if (!message?.guild || !message.mentions?.users?.size) return;
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
        if (!message.guild || message.author.bot) return;
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
