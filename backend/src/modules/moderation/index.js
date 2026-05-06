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

const CASE_MODAL_PREFIX = 'case:submit';
const CASE_ACTION_PREFIX = 'case:action';
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
        allowed_user_ids: { type: 'array', items: { type: 'string' } },
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

function getCaseCommandConfig(guildId, services, configCache) {
  const cached = configCache?.getModuleConfig?.(guildId, 'moderation');
  if (cached) {
    return services.moderationService.normalizeCaseCommandConfig(cached.config?.case_command);
  }

  return services.moderationService.normalizeCaseCommandConfig();
}

function canUseCaseCommand(member, userId, caseConfig) {
  const allowedRoles = Array.isArray(caseConfig.allowed_role_ids) ? caseConfig.allowed_role_ids : [];
  const allowedUsers = Array.isArray(caseConfig.allowed_user_ids) ? caseConfig.allowed_user_ids : [];
  const hasAllowList = allowedRoles.length > 0 || allowedUsers.length > 0;

  if (hasAllowList) {
    if (allowedUsers.includes(userId)) return true;
    return member?.roles?.cache?.some((role) => allowedRoles.includes(role.id)) ?? false;
  }

  return member?.permissions?.has(PermissionFlagsBits.ManageMessages) ?? false;
}

function resolveReportChannelId(modConfig, caseConfig) {
  return String(caseConfig.channel_id || modConfig.modlog_channel_id || '').trim() || null;
}

function getAttachmentLinks(message) {
  const attachments = [...(message.attachments?.values?.() ?? [])];
  if (attachments.length === 0) return 'None';
  return attachments
    .slice(0, 5)
    .map((attachment, index) => `[file ${index + 1}](${attachment.url})`)
    .join(', ');
}

function getMessagePreview(message) {
  const content = truncate(message.content, 800);
  if (content) return content;
  if (message.attachments?.size) return 'No text content.';
  return 'No text content.';
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
    `**Media**: ${report.attachmentLinks}`
  ].join('\n');

  const components = [
    {
      type: 17,
      components: [
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
          label: `Timeout (${report.timeoutMinutes}m)`
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
  const lines = [
    `${guildName}`,
    `Action: ${actionType}`,
    `Reason: ${reason || 'No reason provided'}`
  ];

  if (showModerator && moderatorName) {
    lines.push(`Moderator: ${moderatorName}`);
  }

  try {
    await member.send(lines.join('\n'));
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
  const { services, configCache } = context;

  if (!interaction.guildId || !interaction.guild || !interaction.targetMessage) {
    await interaction.reply({ content: 'This command can only be used on a server message.', ephemeral: true });
    return;
  }

  const modConfig = await services.moderationService.getModConfig(interaction.guildId);
  const caseConfig = getCaseCommandConfig(interaction.guildId, services, configCache);

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

  const token = `${interaction.guildId}.${targetMessage.id}.${interaction.user.id}`;
  pendingCaseReports.set(token, {
    guildId: interaction.guildId,
    reporterId: interaction.user.id,
    targetUserId: targetMessage.author.id,
    targetUsername: targetMessage.author.tag ?? targetMessage.author.username ?? 'Unknown',
    messageId: targetMessage.id,
    messageUrl: targetMessage.url,
    messageContent: getMessagePreview(targetMessage),
    attachmentLinks: getAttachmentLinks(targetMessage),
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

  const timeoutInput = new TextInputBuilder()
    .setCustomId('timeout')
    .setLabel('Timeout Minutes')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder(String(caseConfig.default_timeout_minutes));

  modal.addComponents(
    textInputRow(reasonInput),
    textInputRow(timeoutInput)
  );

  await interaction.showModal(modal);
}

async function handleCaseModal(interaction, context) {
  const token = interaction.customId.slice(`${CASE_MODAL_PREFIX}:`.length);
  const report = pendingCaseReports.get(token);

  if (!report || report.reporterId !== interaction.user.id || report.guildId !== interaction.guildId) {
    await interaction.reply({ content: 'This case report is no longer available.', ephemeral: true });
    return;
  }

  const reason = truncate(interaction.fields.getTextInputValue('reason'), 500);
  const timeoutRaw = truncate(interaction.fields.getTextInputValue('timeout'), 10);
  const timeoutMinutes = Math.max(1, Math.min(10080, Number.parseInt(timeoutRaw || String(report.timeoutMinutes), 10) || report.timeoutMinutes));
  const channel = await interaction.guild.channels.fetch(report.reportChannelId).catch(() => null);

  if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
    pendingCaseReports.delete(token);
    await interaction.reply({ content: 'The configured case report channel is unavailable.', ephemeral: true });
    return;
  }

  const finalizedReport = {
    ...report,
    reason,
    timeoutMinutes,
    reportedTimestamp: Math.floor(Date.now() / 1000),
    token
  };

  const sentMessage = await channel.send({
    flags: MessageFlags.IsComponentsV2,
    components: buildCaseReportComponents(finalizedReport),
    allowedMentions: { parse: [] }
  });

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

  const { services, configCache } = context;
  const caseConfig = getCaseCommandConfig(interaction.guildId, services, configCache);
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
  const modConfig = await services.moderationService.getModConfig(interaction.guildId);
  const durationSeconds = actionType === 'TIMEOUT' ? report.timeoutMinutes * 60 : undefined;

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

    await services.moderationService.createCase({
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

  const resolvedLabel = actionType === 'TIMEOUT'
    ? `TIMEOUT for ${report.timeoutMinutes} minute(s) by ${escapeMarkdown(moderatorName)}`
    : `${actionType} by ${escapeMarkdown(moderatorName)}`;

  await interaction.update({
    components: buildCaseReportComponents(report, resolvedLabel),
    allowedMentions: { parse: [] }
  });
  await interaction.followUp({ content: 'Case action completed.', ephemeral: true });
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

        if (interaction.isButton() && interaction.customId.startsWith(`${CASE_ACTION_PREFIX}:`)) {
          await handleCaseAction(interaction, context);
        }
      }
    },
    {
      name: 'messageDelete',
      async execute(message, { services }) {
        if (!message?.guild || !message.mentions?.users?.size) return;

        await services.moderationService.recordGhostPing({
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
      async execute(message, { services }) {
        if (!message.guild || message.author.bot) return;

        const afk = await services.moderationService.getAfk(message.guild.id, message.author.id);
        if (afk) {
          await services.moderationService.clearAfk(message.guild.id, message.author.id);
          await message.channel.send({
            embeds: [caseEmbed('Welcome Back', `<@${message.author.id}> your AFK status has been removed.`, 0x57f287)]
          });
        }

        await services.moderationService.touchLoaLastSeen(message.guild.id, message.author.id).catch(() => null);
      }
    }
  ]
};
