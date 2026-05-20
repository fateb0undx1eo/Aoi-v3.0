import {
  ActionRowBuilder,
  ApplicationCommandType,
  AttachmentBuilder,
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
  return attachments.slice(0, 5).map((a) => ({
    url: a.url,
    name: a.name ?? 'attachment',
    isImage: String(a.contentType ?? '').startsWith('image/')
      || /\.(png|jpe?g|gif|webp)$/i.test(String(a.url ?? '').split('?')[0])
  }));
}

function buildMessageUrl(guildId, channelId, messageId) {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

function buildTimeoutPresetText() {
  return TIMEOUT_PRESETS.map((p, i) => `${i + 1}. ${p.label}`).join(', ');
}

function computeMessageContentLimit({ guildId, channelId, messageId, targetUserId, reporterId, targetUsername, reason }) {
  const messageUrl = buildMessageUrl(guildId, channelId, messageId);
  const scaffold = [
    '# Message Case Report',
    `**Author**: <@${targetUserId}> (${escapeMarkdown(targetUsername)})`,
    `**Reported By**: <@${reporterId}>`,
    `**Reported At**: <t:${Math.floor(Date.now() / 1000)}:F>`,
    `**Reason**: ${escapeMarkdown(reason)}`,
    `**Message Content**: [msg](${messageUrl})`
  ].join('\n');
  const maxComponentLength = 4000;
  return Math.max(0, maxComponentLength - scaffold.length - 16);
}

function buildCaseBody(report) {
  return [
    '# Message Case Report',
    `**Author**: <@${report.targetUserId}> (${escapeMarkdown(report.targetUsername)})`,
    `**Reported By**: <@${report.reporterId}>`,
    `**Reported At**: <t:${report.reportedTimestamp}:F>`,
    `**Reason**: ${escapeMarkdown(report.reason)}`,
    `**Message Content**: [msg](${report.messageUrl})`,
    report.messageContent
  ].join('\n');
}

/**
 * Fetch an attachment URL and return a Buffer + filename for re-uploading.
 * Returns null if the fetch fails (e.g. message was deleted).
 */
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

/**
 * Re-upload attachments and return:
 *   - files: AttachmentBuilder[] to pass to the send call
 *   - mediaGalleryItems: array of { media: { url: string }, spoiler: true } for the gallery component
 */
async function prepareReuploadedMedia(attachments = []) {
  const files = [];
  const mediaGalleryItems = [];

  for (const attachment of attachments.slice(0, 5)) {
    const fetched = await fetchAttachmentBuffer(attachment.url, attachment.name);
    if (!fetched) continue;

    // Prefix with SPOILER_ so Discord renders it with a spoiler overlay
    const spoilerName = fetched.name.startsWith('SPOILER_')
      ? fetched.name
      : `SPOILER_${fetched.name}`;

    const builder = new AttachmentBuilder(fetched.buffer, { name: spoilerName });
    files.push(builder);

    if (attachment.isImage) {
      // attachment:// URLs reference the re-uploaded file by its name
      mediaGalleryItems.push({
        media: { url: `attachment://${spoilerName}` },
        spoiler: true
      });
    }
  }

  return { files, mediaGalleryItems };
}

function buildMediaTextSection(attachments = []) {
  // Only non-image files get a text link section; images go into the gallery component
  const fileAttachments = attachments.filter((a) => !a.isImage && a.url);
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
  return [{
    type: 17,
    components: [
      { type: 10, content: buildCaseBody(report) },
      ...buildMediaTextSection(report.attachments),
      {
        type: 1,
        components: [
          { type: 2, custom_id: `${CASE_ACTION_PREFIX}:warn:${token}`, style: ButtonStyle.Secondary, label: 'Warn' },
          { type: 2, custom_id: `${CASE_ACTION_PREFIX}:timeout:${token}`, style: ButtonStyle.Primary, label: 'Timeout' },
          { type: 2, custom_id: `${CASE_ACTION_PREFIX}:kick:${token}`, style: ButtonStyle.Danger, label: 'Kick' }
        ]
      }
    ]
  }];
}

/**
 * Build logged components. Re-uploads attachments so they persist even if the
 * original message is deleted. Images are placed in a media gallery with spoiler.
 */
async function buildLoggedComponents(report, resolvedLabel) {
  const { files, mediaGalleryItems } = await prepareReuploadedMedia(report.attachments);

  const components = [
    {
      type: 17,
      components: [
        { type: 10, content: `${buildCaseBody(report)}\n**Action Taken**: ${resolvedLabel}` },
        ...buildMediaTextSection(report.attachments),
        ...(mediaGalleryItems.length
          ? [{ type: 12, items: mediaGalleryItems }]
          : [])
      ]
    }
  ];

  return { components, files };
}

async function sendModerationDm({ member, guildName, actionType, reason, moderatorName, showModerator }) {
  try {
    const title = actionType === 'WARN' ? 'Warning Notice' : actionType === 'TIMEOUT' ? 'Timeout Notice' : 'Kick Notice';
    const lines = [
      `# ${title}`,
      `**Server**: ${escapeMarkdown(guildName)}`,
      `**Action**: ${actionType}`,
      `**Reason**: ${escapeMarkdown(reason || 'No reason provided')}`
    ];
    if (showModerator && moderatorName) lines.push(`**Moderator**: ${escapeMarkdown(moderatorName)}`);
    await member.send({
      flags: MessageFlags.IsComponentsV2,
      components: [{ type: 17, components: [{ type: 10, content: lines.join('\n') }] }],
      allowedMentions: { parse: [] }
    });
  } catch {}
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

async function sendCaseLogToChannel(context, components, files = []) {
  const client = context?.discordClient ?? context?.client;
  const guild = client?.guilds?.cache?.get?.(context?.guildId);
  const channel = guild ? await guild.channels.fetch(CASE_REPORT_CHANNEL_ID).catch(() => null) : null;
  if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
    throw new Error('Case report channel unavailable');
  }

  const payload = {
    flags: MessageFlags.IsComponentsV2,
    components,
    allowedMentions: { parse: [] },
    ...(files.length ? { files } : {})
  };

  try {
    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find((h) => h.name === CASE_WEBHOOK_NAME && h.owner?.id === client.user?.id);
    if (!webhook) webhook = await channel.createWebhook({ name: CASE_WEBHOOK_NAME });
    await webhook.send(payload);
  } catch {
    await channel.send(payload);
  }
}

async function buildReportFromToken(interaction, token, reasonOverride = null) {
  const parsed = parseStatelessToken(token);
  if (!parsed) return null;

  const sourceChannel = interaction.channel;
  const sourceMessage = sourceChannel?.isTextBased?.()
    ? await sourceChannel.messages.fetch(parsed.messageId).catch(() => null)
    : null;
  if (!sourceMessage?.author?.id) return null;

  const reason = reasonOverride ?? 'No reason provided';
  const limit = computeMessageContentLimit({
    guildId: interaction.guildId,
    channelId: sourceChannel.id,
    messageId: sourceMessage.id,
    targetUserId: sourceMessage.author.id,
    reporterId: parsed.reporterId,
    targetUsername: sourceMessage.author.tag ?? sourceMessage.author.username ?? 'Unknown',
    reason
  });

  return {
    guildId: interaction.guildId,
    reporterId: parsed.reporterId,
    targetUserId: sourceMessage.author.id,
    targetUsername: sourceMessage.author.tag ?? sourceMessage.author.username ?? 'Unknown',
    messageId: sourceMessage.id,
    channelId: sourceChannel.id,
    messageUrl: buildMessageUrl(interaction.guildId, sourceChannel.id, sourceMessage.id),
    reason,
    reportedTimestamp: Math.floor(Date.now() / 1000),
    messageContent: truncate(sourceMessage.content, limit),
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

  const defaultReason = 'Reported via context menu';
  const limit = computeMessageContentLimit({
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    messageId: targetMessage.id,
    targetUserId: targetMessage.author.id,
    reporterId: interaction.user.id,
    targetUsername: targetMessage.author.tag ?? targetMessage.author.username ?? 'Unknown',
    reason: defaultReason
  });

  const report = {
    guildId: interaction.guildId,
    reporterId: interaction.user.id,
    targetUserId: targetMessage.author.id,
    targetUsername: targetMessage.author.tag ?? targetMessage.author.username ?? 'Unknown',
    messageId: targetMessage.id,
    channelId: interaction.channelId,
    messageUrl: buildMessageUrl(interaction.guildId, interaction.channelId, targetMessage.id),
    reason: defaultReason,
    reportedTimestamp: Math.floor(Date.now() / 1000),
    messageContent: truncate(targetMessage.content, limit),
    attachments: getAttachmentData(targetMessage)
  };

  await interaction.reply({
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: buildPreviewComponents(report),
    allowedMentions: { parse: [] }
  });
}

async function applyModerationAction(interaction, context, actionType, reason, durationSeconds = null, timeoutLabel = null) {
  // Extract token from the stored customId (already normalised by callers)
  const token = interaction.customId.split(':').slice(3).join(':');
  const report = await buildReportFromToken(interaction, token, reason);
  if (!report) {
    await interaction.reply({ content: 'The source message is unavailable for this case.', ephemeral: true });
    return;
  }

  const member = await interaction.guild.members.fetch(report.targetUserId).catch(() => null);
  if (!member || member.id === interaction.user.id) {
    await interaction.reply({ content: 'The reported user is not available for this action.', ephemeral: true });
    return;
  }

  if (actionType === 'KICK' && !canKick(interaction.member, interaction.guild)) {
    await interaction.reply({ content: 'Only administrators and the server owner can use Kick.', ephemeral: true });
    return;
  }

  const moderationService = getModerationService(context);
  const moderatorName = interaction.user.tag ?? interaction.user.username;
  const modConfig = await moderationService.getModConfig(interaction.guildId).catch(() => ({ dm_on_punish: false, show_mod_in_dm: false }));

  try {
    if (modConfig.dm_on_punish) {
      const dmReason = actionType === 'TIMEOUT'
        ? `${reason}\nDuration: ${timeoutLabel ?? `${Math.floor(durationSeconds / 60)} minute(s)`}`
        : reason;
      await sendModerationDm({
        member,
        guildName: interaction.guild.name,
        actionType,
        reason: dmReason,
        moderatorName,
        showModerator: Boolean(modConfig.show_mod_in_dm)
      });
    }

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
    await interaction.reply({ content: `Failed to apply action: ${error.message}`, ephemeral: true });
    return;
  }

  // Action label: just the action type (+ duration for timeout), no moderator name
  const resolvedLabel = actionType === 'TIMEOUT'
    ? `TIMEOUT (${timeoutLabel ?? `${Math.floor(durationSeconds / 60)} minute(s)`})`
    : actionType;

  const { components, files } = await buildLoggedComponents(report, resolvedLabel);

  await sendCaseLogToChannel({ ...context, guildId: interaction.guildId }, components, files);

  // Build the updated preview (no buttons, action taken shown, media re-uploaded)
  const previewBody = `${buildCaseBody(report)}\n**Action Taken**: ${resolvedLabel}`;
  const previewWithoutButtons = [{
    type: 17,
    components: [
      { type: 10, content: previewBody },
      ...buildMediaTextSection(report.attachments)
    ]
  }];

  if (interaction.isButton()) {
    await interaction.update({ components: previewWithoutButtons, allowedMentions: { parse: [] } });
    await interaction.followUp({ content: 'Case action completed and logged.', ephemeral: true });
    return;
  }

  // Coming from a modal submit — use reply (modals cannot be updated via interaction.update)
  await interaction.reply({
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: previewWithoutButtons,
    allowedMentions: { parse: [] }
  });
  await interaction.followUp({ content: 'Case action completed and logged.', ephemeral: true });
}

async function handleCaseAction(interaction) {
  const parts = interaction.customId.split(':');
  const prefix = `${parts[0]}:${parts[1]}`;
  const actionKey = parts[2];
  if (prefix !== CASE_ACTION_PREFIX) return;

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
    await interaction.showModal(modal);
    return;
  }

  if (actionKey === 'timeout') {
    const modal = new ModalBuilder()
      .setCustomId(`${CASE_TIMEOUT_MODAL_PREFIX}:${token}`)
      .setTitle('Timeout');
    modal.addComponents(
      textInputRow(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason for timeout')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500)
      ),
      textInputRow(
        new TextInputBuilder()
          .setCustomId('duration')
          .setLabel('Duration (preset number)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(2)
          .setPlaceholder(buildTimeoutPresetText())
      )
    );
    await interaction.showModal(modal);
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
    await interaction.showModal(modal);
    return;
  }
}

async function handleCaseWarnModal(interaction, context) {
  const reason = truncate(interaction.fields.getTextInputValue('reason'), 500);
  const token = interaction.customId.slice(`${CASE_WARN_MODAL_PREFIX}:`.length);
  // Normalise customId so applyModerationAction can extract the token via split(':').slice(3)
  interaction.customId = `${CASE_ACTION_PREFIX}:warn:${token}`;
  await applyModerationAction(interaction, context, 'WARN', reason);
}

async function handleCaseTimeoutModal(interaction, context) {
  const reason = truncate(interaction.fields.getTextInputValue('reason'), 500);
  const presetIndex = Number.parseInt(interaction.fields.getTextInputValue('duration').trim(), 10) - 1;
  if (Number.isNaN(presetIndex) || presetIndex < 0 || presetIndex >= TIMEOUT_PRESETS.length) {
    await interaction.reply({ content: `Invalid duration. Enter a number between 1 and ${TIMEOUT_PRESETS.length}.`, ephemeral: true });
    return;
  }
  const preset = TIMEOUT_PRESETS[presetIndex];
  const token = interaction.customId.slice(`${CASE_TIMEOUT_MODAL_PREFIX}:`.length);
  interaction.customId = `${CASE_ACTION_PREFIX}:timeout:${token}`;
  await applyModerationAction(interaction, context, 'TIMEOUT', reason, preset.minutes * 60, preset.label);
}

async function handleCaseKickModal(interaction, context) {
  const reason = truncate(interaction.fields.getTextInputValue('reason'), 500);
  const token = interaction.customId.slice(`${CASE_KICK_MODAL_PREFIX}:`.length);
  interaction.customId = `${CASE_ACTION_PREFIX}:kick:${token}`;
  await applyModerationAction(interaction, context, 'KICK', reason);
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