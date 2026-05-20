import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

const CASE_MODAL_PREFIX = 'case:submit';
const CASE_ACTION_PREFIX = 'case:action';
const CASE_TIMEOUT_MODAL_PREFIX = 'case:timeout';
const pendingCaseReports = new Map();

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
        channel_id: { type: 'string' },
        allowed_role_ids: { type: 'array', items: { type: 'string' } },
        default_timeout_minutes: { type: 'number' }
      }
    }
  }
};

function colorFor(type) {
  switch (type) {
    case 'BAN':
    case 'TEMPBAN':
      return 0xed4245;
    case 'KICK':
      return 0xfaa61a;
    case 'WARN':
      return 0xfee75c;
    case 'MUTE':
    case 'TIMEOUT':
      return 0x5865f2;
    case 'UNBAN':
    case 'UNMUTE':
      return 0x57f287;
    default:
      return 0x808080;
  }
}

function caseEmbed(title, description, color) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
}

function truncate(value, maxLength) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function escapeMarkdown(text) {
  return String(text ?? '').replace(/[[\]()]/g, '\\$&');
}

function textInputRow(textInput) {
  return new ActionRowBuilder().addComponents(textInput);
}

function getModerationService(context) {
  return context?.moderationService ?? context?.services?.moderationService ?? null;
}

async function getCaseCommandConfig(guildId, moderationService, configCache) {
  const normalize = moderationService?.normalizeCaseCommandConfig?.bind(moderationService);
  const fallback = {
    channel_id: null,
    allowed_role_ids: [],
    default_timeout_minutes: 10
  };

  if (!normalize) return fallback;

  const cached = configCache?.getModuleConfig?.(guildId, 'moderation');
  if (cached) return normalize(cached.config?.case_command);

  try {
    const live = await moderationService?.getCaseCommandConfig?.(guildId);
    return normalize(live);
  } catch {
    return fallback;
  }
}

function canUseCaseCommand(member, userId, caseConfig) {
  const allowedRoles = Array.isArray(caseConfig.allowed_role_ids) ? caseConfig.allowed_role_ids : [];
  if (allowedRoles.length === 0) return false;
  const roleCache = member?.roles?.cache;
  if (roleCache?.some) {
    return roleCache.some((role) => allowedRoles.includes(role.id));
  }

  const roleIds = Array.isArray(member?.roles)
    ? member.roles
    : Array.isArray(member?.roles?.values)
      ? member.roles.values
      : [];

  return roleIds.some((roleId) => allowedRoles.includes(String(roleId)));
}

function resolveReportChannelId(modConfig, caseConfig) {
  return String(caseConfig.channel_id || modConfig.modlog_channel_id || '').trim() || null;
}

function getAttachmentData(message) {
  const attachments = [...(message.attachments?.values?.() ?? [])];
  return attachments.slice(0, 5).map((attachment) => ({
    url: attachment.url,
    name: attachment.name ?? 'attachment',
    isImage: String(attachment.contentType ?? '').startsWith('image/')
      || /\.(png|jpe?g|gif|webp)$/i.test(String(attachment.url ?? '').split('?')[0])
  }));
}

function getMessagePreview(message) {
  const content = truncate(message.content, 800);
  if (content) return content;
  if (message.attachments?.size) return 'No text content.';
  return 'No text content.';
}

function buildMediaComponents(attachments = []) {
  const imageItems = attachments
    .filter((attachment) => attachment.isImage && attachment.url)
    .slice(0, 4)
    .map((attachment) => ({ media: { url: attachment.url } }));

  return imageItems.length
    ? [{
        type: 12,
        items: imageItems
      }]
    : [];
}

function getAttachmentLinks(attachments = []) {
  if (!attachments.length) return 'None';
  return attachments
    .map((attachment, index) => `[file ${index + 1}](${attachment.url})`)
    .join(', ');
}

function buildCaseReportComponents(report, resolvedLabel = '') {
  const body = [
    `# Message Case Report`,
    `**Message**: [message](${report.messageUrl})`,
    `**Author**: <@${report.targetUserId}> (${escapeMarkdown(report.targetUsername)})`,
    `**Reported By**: <@${report.reporterId}>`,
    `**Reported At**: <t:${report.reportedTimestamp}:F>`,
    `**Reason**: ${escapeMarkdown(report.reason)}`,
    `**Message Content**:`,
    report.messageContent,
    `**Media**: ${getAttachmentLinks(report.attachments)}`
  ].join('\n');

  const components = [
    {
      type: 17,
      components: [
        ...buildMediaComponents(report.attachments),
        {
          type: 10,
          content: body
        }
      ]
    }
  ];

  if (!resolvedLabel) {
    components[0].components.push({
      type: 1,
      components: [
        {
          type: 2,
          custom_id: `${CASE_ACTION_PREFIX}:warn:${report.token}`,
          style: ButtonStyle.Secondary,
          label: 'Warn'
        },
        {
          type: 2,
          custom_id: `${CASE_ACTION_PREFIX}:timeout:${report.token}`,
          style: ButtonStyle.Primary,
          label: 'Timeout'
        },
        {
          type: 2,
          custom_id: `${CASE_ACTION_PREFIX}:kick:${report.token}`,
          style: ButtonStyle.Danger,
          label: 'Kick'
        }
      ]
    });
  } else {
    components[0].components.push({
      type: 10,
      content: `**Action Taken**: ${resolvedLabel}`
    });
  }

  return components;
}

async function sendModerationDm({ member, guildName, actionType, reason, moderatorName, showModerator }) {
  try {
    const title = actionType === 'WARN'
      ? 'Warning Notice'
      : actionType === 'TIMEOUT'
        ? 'Timeout Notice'
        : 'Kick Notice';
    const lines = [
      `# ${title}`,
      `**Server**: ${escapeMarkdown(guildName)}`,
      `**Action**: ${actionType}`,
      `**Reason**: ${escapeMarkdown(reason || 'No reason provided')}`
    ];

    if (showModerator && moderatorName) {
      lines.push(`**Moderator**: ${escapeMarkdown(moderatorName)}`);
    }

    await member.send({
      flags: MessageFlags.IsComponentsV2,
      components: [
        {
          type: 17,
          components: [
            {
              type: 10,
              content: lines.join('\n')
            }
          ]
        }
      ],
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

async function handleCaseCommand(interaction, context) {
  const { configCache } = context;
  const moderationService = getModerationService(context);

  if (!interaction.guildId || !interaction.guild || !interaction.targetMessage) {
    await interaction.reply({ content: 'This command can only be used on a server message.', ephemeral: true });
    return;
  }

  const caseConfig = await getCaseCommandConfig(interaction.guildId, moderationService, configCache);

  // FIX 1: Added .catch() so a failed getModConfig doesn't throw an unhandled
  // rejection that crashes the handler and leaves Discord with no reply,
  // causing the "An interaction failed / internal error" you were seeing.
  const modConfig = await moderationService.getModConfig(interaction.guildId).catch(() => ({
    modlog_channel_id: null
  }));

  if (!canUseCaseCommand(interaction.member, interaction.user.id, caseConfig)) {
    await interaction.reply({ content: 'You are not allowed to use this command.', ephemeral: true });
    return;
  }

  const reportChannelId = resolveReportChannelId(modConfig, caseConfig);
  if (!reportChannelId) {
    await interaction.reply({ content: 'No case report channel is configured.', ephemeral: true });
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

  const token = `${interaction.guildId}.${targetMessage.id}.${interaction.user.id}`;
  pendingCaseReports.set(token, {
    guildId: interaction.guildId,
    reporterId: interaction.user.id,
    targetUserId: targetMessage.author.id,
    targetUsername: targetMessage.author.tag ?? targetMessage.author.username ?? 'Unknown',
    messageId: targetMessage.id,
    messageUrl: targetMessage.url,
    messageContent: getMessagePreview(targetMessage),
    attachments: getAttachmentData(targetMessage),
    reportChannelId,
    timeoutMinutes: caseConfig.default_timeout_minutes
  });

  const modal = new ModalBuilder()
    .setCustomId(`${CASE_MODAL_PREFIX}:${token}`)
    .setTitle('Open Case');

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Reason')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500)
    .setPlaceholder('Enter the report reason');

  modal.addComponents(textInputRow(reasonInput));

  try {
    await interaction.showModal(modal);
  } catch (error) {
    pendingCaseReports.delete(token);
    await interaction.reply({ content: 'Unable to open the case form right now. Please try again.', ephemeral: true });
  }
}

async function handleCaseModal(interaction, context) {
  const token = interaction.customId.slice(`${CASE_MODAL_PREFIX}:`.length);
  const report = pendingCaseReports.get(token);

  if (!report || report.reporterId !== interaction.user.id || report.guildId !== interaction.guildId) {
    await interaction.reply({ content: 'This case report is no longer available.', ephemeral: true });
    return;
  }

  // FIX 2: Guard against double-submit (network retry / double tap) re-posting
  // the report to the channel a second time.
  if (report.resolved || report.reportMessageId) {
    await interaction.reply({ content: 'This case report has already been submitted.', ephemeral: true });
    return;
  }

  const reason = truncate(interaction.fields.getTextInputValue('reason'), 500);
  const channel = await interaction.guild.channels.fetch(report.reportChannelId).catch(() => null);

  if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
    pendingCaseReports.delete(token);
    await interaction.reply({ content: 'The configured case report channel is unavailable.', ephemeral: true });
    return;
  }

  const finalizedReport = {
    ...report,
    reason,
    reportedTimestamp: Math.floor(Date.now() / 1000),
    token
  };

  let sentMessage;
  try {
    sentMessage = await channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: buildCaseReportComponents(finalizedReport),
      allowedMentions: { parse: [] }
    });
  } catch (error) {
    await interaction.reply({ content: 'Failed to send case report to the configured channel.', ephemeral: true });
    return;
  }

  pendingCaseReports.set(token, {
    ...finalizedReport,
    reportMessageId: sentMessage.id,
    resolved: false
  });

  await interaction.reply({ content: 'Case report sent.', ephemeral: true });
}

async function handleCaseAction(interaction, context) {
  const actionKey = interaction.customId.slice(`${CASE_ACTION_PREFIX}:`.length).split(':', 1)[0];
  const token = interaction.customId.slice(`${CASE_ACTION_PREFIX}:${actionKey}:`.length);
  const report = pendingCaseReports.get(token);

  if (!report || report.guildId !== interaction.guildId) {
    await interaction.reply({ content: 'This case report is no longer available.', ephemeral: true });
    return;
  }

  if (report.resolved) {
    await interaction.reply({ content: 'This case report has already been resolved.', ephemeral: true });
    return;
  }

  const { configCache } = context;
  const moderationService = getModerationService(context);
  const caseConfig = await getCaseCommandConfig(interaction.guildId, moderationService, configCache);
  if (!canUseCaseCommand(interaction.member, interaction.user.id, caseConfig)) {
    await interaction.reply({ content: 'You are not allowed to use this action.', ephemeral: true });
    return;
  }

  const guild = interaction.guild;
  const member = await guild.members.fetch(report.targetUserId).catch(() => null);
  if (!member) {
    await interaction.reply({ content: 'The reported user is no longer available in this server.', ephemeral: true });
    return;
  }

  const actionType = actionKey === 'warn' ? 'WARN' : actionKey === 'timeout' ? 'TIMEOUT' : actionKey === 'kick' ? 'KICK' : null;
  if (!actionType) {
    await interaction.reply({ content: 'Unsupported case action.', ephemeral: true });
    return;
  }

  const moderatorName = interaction.user.tag ?? interaction.user.username;
  const modConfig = await moderationService.getModConfig(interaction.guildId).catch(() => ({
    dm_on_punish: false,
    show_mod_in_dm: false
  }));
  if (member.id === interaction.user.id) {
    await interaction.reply({ content: 'You cannot action a case against yourself.', ephemeral: true });
    return;
  }

  if (actionType === 'TIMEOUT') {
    const modal = new ModalBuilder()
      .setCustomId(`${CASE_TIMEOUT_MODAL_PREFIX}:${token}`)
      .setTitle('Timeout Duration');
    const durationInput = new TextInputBuilder()
      .setCustomId('minutes')
      .setLabel('Minutes')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(6)
      .setPlaceholder('60');
    modal.addComponents(textInputRow(durationInput));
    try {
      await interaction.showModal(modal);
    } catch (error) {
      await interaction.reply({ content: 'Unable to open timeout form right now. Please try again.', ephemeral: true });
    }
    return;
  }

  // FIX 3: WARN and KICK don't use durationSeconds — pass null explicitly
  // instead of undefined so createCase receives a clean value.
  const durationSeconds = null;

  try {
    if (modConfig.dm_on_punish) {
      await sendModerationDm({
        member,
        guildName: guild.name,
        actionType,
        reason: report.reason,
        moderatorName,
        showModerator: Boolean(modConfig.show_mod_in_dm)
      });
    }

    await performGuildAction({
      member,
      actionType,
      reason: report.reason,
      durationSeconds
    });

    await moderationService.createCase({
      guildId: interaction.guildId,
      targetUserId: report.targetUserId,
      targetUsername: report.targetUsername,
      moderatorUserId: interaction.user.id,
      moderatorUsername: moderatorName,
      type: actionType,
      reason: `${report.reason} (reported message: ${report.messageUrl})`,
      durationSeconds
    });
  } catch (error) {
    await interaction.reply({ content: `Failed to apply action: ${error.message}`, ephemeral: true });
    return;
  }

  report.resolved = true;
  pendingCaseReports.set(token, report);

  // FIX 4: Removed the stale TIMEOUT branch from resolvedLabel here — TIMEOUT
  // always goes through the modal and is handled in handleCaseTimeoutModal,
  // so this code only ever runs for WARN and KICK.
  const resolvedLabel = `${actionType} by ${escapeMarkdown(moderatorName)}`;

  await interaction.update({
    components: buildCaseReportComponents(report, resolvedLabel),
    allowedMentions: { parse: [] }
  });
  await interaction.followUp({ content: 'Case action completed.', ephemeral: true });
}

async function handleCaseTimeoutModal(interaction, context) {
  const token = interaction.customId.slice(`${CASE_TIMEOUT_MODAL_PREFIX}:`.length);
  const report = pendingCaseReports.get(token);

  if (!report || report.guildId !== interaction.guildId || report.resolved) {
    await interaction.reply({ content: 'This case report is no longer available.', ephemeral: true });
    return;
  }

  const { configCache } = context;
  const moderationService = getModerationService(context);
  const caseConfig = await getCaseCommandConfig(interaction.guildId, moderationService, configCache);
  if (!canUseCaseCommand(interaction.member, interaction.user.id, caseConfig)) {
    await interaction.reply({ content: 'You are not allowed to use this action.', ephemeral: true });
    return;
  }

  const minutes = Math.max(1, Math.min(10080, Number.parseInt(interaction.fields.getTextInputValue('minutes'), 10) || 0));
  const guild = interaction.guild;
  const member = await guild.members.fetch(report.targetUserId).catch(() => null);
  if (!member || member.id === interaction.user.id) {
    await interaction.reply({ content: 'The reported user is not available for this action.', ephemeral: true });
    return;
  }

  const moderatorName = interaction.user.tag ?? interaction.user.username;
  const modConfig = await moderationService.getModConfig(interaction.guildId).catch(() => ({
    dm_on_punish: false,
    show_mod_in_dm: false
  }));
  const durationSeconds = minutes * 60;

  try {
    if (modConfig.dm_on_punish) {
      await sendModerationDm({
        member,
        guildName: guild.name,
        actionType: 'TIMEOUT',
        reason: `${report.reason}\nDuration: ${minutes} minute(s)`,
        moderatorName,
        showModerator: Boolean(modConfig.show_mod_in_dm)
      });
    }

    await performGuildAction({
      member,
      actionType: 'TIMEOUT',
      reason: report.reason,
      durationSeconds
    });

    await moderationService.createCase({
      guildId: interaction.guildId,
      targetUserId: report.targetUserId,
      targetUsername: report.targetUsername,
      moderatorUserId: interaction.user.id,
      moderatorUsername: moderatorName,
      type: 'TIMEOUT',
      reason: `${report.reason} (reported message: ${report.messageUrl})`,
      durationSeconds
    });
  } catch (error) {
    await interaction.reply({ content: `Failed to apply timeout: ${error.message}`, ephemeral: true });
    return;
  }

  report.resolved = true;
  report.timeoutMinutes = minutes;
  pendingCaseReports.set(token, report);

  const channel = await interaction.guild.channels.fetch(report.reportChannelId).catch(() => null);
  const message = channel?.isTextBased?.()
    ? await channel.messages.fetch(report.reportMessageId).catch(() => null)
    : null;

  if (message) {
    await message.edit({
      components: buildCaseReportComponents(report, `TIMEOUT for ${minutes} minute(s) by ${escapeMarkdown(moderatorName)}`),
      allowedMentions: { parse: [] }
    });
  }

  await interaction.reply({ content: 'Case action completed.', ephemeral: true });
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
      async execute(interaction, context) {
        await handleCaseCommand(interaction, context);
      }
    }
  ],
  events: [
    {
      name: 'interactionCreate',
      async execute(interaction, context) {
        if (interaction.isModalSubmit() && interaction.customId.startsWith(`${CASE_MODAL_PREFIX}:`)) {
          await handleCaseModal(interaction, context);
          return;
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith(`${CASE_TIMEOUT_MODAL_PREFIX}:`)) {
          await handleCaseTimeoutModal(interaction, context);
          return;
        }

        if (interaction.isButton() && interaction.customId.startsWith(`${CASE_ACTION_PREFIX}:`)) {
          await handleCaseAction(interaction, context);
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