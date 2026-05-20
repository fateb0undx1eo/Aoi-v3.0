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

// ─── Prefixes ────────────────────────────────────────────────────────────────
const CASE_MODAL_PREFIX          = 'case:submit';
const CASE_ACTION_PREFIX         = 'case:action';
const CASE_TIMEOUT_MODAL_PREFIX  = 'case:timeout';
const CASE_KICK_MODAL_PREFIX     = 'case:kick';

// ─── In-memory store with TTL ─────────────────────────────────────────────────
// Entries expire after CASE_TTL_MS so the Map never grows unbounded on
// long-running bots. The timer is cleared immediately if a report is resolved
// or deleted early so there are no dangling timer references.
const CASE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const pendingCaseTimers = new Map(); // token -> NodeJS.Timeout

const pendingCaseReports = {
  _store: new Map(),

  set(token, value) {
    // Clear any existing timer before (re)setting so updates don't stack timers
    this._clearTimer(token);
    this._store.set(token, value);
    const timer = setTimeout(() => {
      this._store.delete(token);
      pendingCaseTimers.delete(token);
    }, CASE_TTL_MS);
    // Allow the Node process to exit cleanly even with pending timers
    timer.unref?.();
    pendingCaseTimers.set(token, timer);
    return this;
  },

  get(token) {
    return this._store.get(token);
  },

  delete(token) {
    this._clearTimer(token);
    return this._store.delete(token);
  },

  _clearTimer(token) {
    const existing = pendingCaseTimers.get(token);
    if (existing) {
      clearTimeout(existing);
      pendingCaseTimers.delete(token);
    }
  }
};

// ─── Timeout preset options (label → minutes) ─────────────────────────────
// Discord max timeout = 28 days = 40320 minutes
const TIMEOUT_PRESETS = [
  { label: '1 minute',   minutes: 1     },
  { label: '5 minutes',  minutes: 5     },
  { label: '10 minutes', minutes: 10    },
  { label: '30 minutes', minutes: 30    },
  { label: '1 hour',     minutes: 60    },
  { label: '3 hours',    minutes: 180   },
  { label: '6 hours',    minutes: 360   },
  { label: '12 hours',   minutes: 720   },
  { label: '1 day',      minutes: 1440  },
  { label: '3 days',     minutes: 4320  },
  { label: '7 days',     minutes: 10080 },
  { label: '28 days',    minutes: 40320 }
];

// ─── Hardcoded case config ────────────────────────────────────────────────────
// Channel where report cards are posted
const CASE_REPORT_CHANNEL_ID = '1475835319571189820';
// Role allowed to trigger the context menu and use Warn / Timeout
// (Kick remains admin/owner only regardless of this role)
const CASE_ALLOWED_ROLE_ID = '1457403601512169724';

// ─── Config schema ────────────────────────────────────────────────────────────
const MODERATION_SCHEMA = {
  type: 'object',
  properties: {
    ghost_ping_window_seconds: { type: 'number' },
    ping_protection_roles: { type: 'array', items: { type: 'string' } },
    afk:  { type: 'object' },
    loa:  { type: 'object' },
    case_command: {
      type: 'object',
      properties: {
        // Only admins/owner can use Kick (enforced in code, not configurable)
        default_timeout_minutes: { type: 'number' }
      }
    }
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function caseEmbed(title, description, color) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
}

// Returns true if member has Administrator permission or is the guild owner
function isAdminOrOwner(member, guild) {
  if (!member) return false;
  if (member.id === guild.ownerId) return true;
  return member.permissions?.has?.(PermissionFlagsBits.Administrator) ?? false;
}

// ─── Permission gate ──────────────────────────────────────────────────────────
// WHO CAN TRIGGER THE CONTEXT MENU COMMAND:
//   • Server owner — always
//   • Members with Administrator permission — always
//   • Members who have at least one of the configured allowed_role_ids
//
// WHO CAN USE KICK:
//   • Server owner only, OR members with Administrator permission
//   • Configured roles CANNOT kick — they only get Warn / Timeout
function canUseCaseCommand(member, guild) {
  if (isAdminOrOwner(member, guild)) return true;
  const roleCache = member?.roles?.cache;
  if (roleCache?.some) return roleCache.some((r) => r.id === CASE_ALLOWED_ROLE_ID);
  const roleIds = Array.isArray(member?.roles) ? member.roles : [];
  return roleIds.some((id) => String(id) === CASE_ALLOWED_ROLE_ID);
}

function canKick(member, guild) {
  return isAdminOrOwner(member, guild);
}

// ─── Config helpers ───────────────────────────────────────────────────────────

async function getCaseCommandConfig(guildId, moderationService, configCache) {
  // Channel and role are hardcoded; only default_timeout_minutes comes from config
  const fallback = { default_timeout_minutes: 10 };
  const normalize = moderationService?.normalizeCaseCommandConfig?.bind(moderationService);
  if (!normalize) return fallback;
  const cached = configCache?.getModuleConfig?.(guildId, 'moderation');
  if (cached) return { ...fallback, ...normalize(cached.config?.case_command) };
  try {
    return { ...fallback, ...normalize(await moderationService?.getCaseCommandConfig?.(guildId)) };
  } catch {
    return fallback;
  }
}

// ─── Attachment helpers ───────────────────────────────────────────────────────

function getAttachmentData(message) {
  const attachments = [...(message.attachments?.values?.() ?? [])];
  return attachments.slice(0, 5).map((a) => ({
    url:     a.url,
    name:    a.name ?? 'attachment',
    isImage: String(a.contentType ?? '').startsWith('image/') ||
             /\.(png|jpe?g|gif|webp)$/i.test(String(a.url ?? '').split('?')[0])
  }));
}

function getMessagePreview(message) {
  // Cap at 400 chars — the body template adds ~350 chars of metadata,
  // keeping the total well under Discord's 4000-char component content limit
  // even for Nitro users sending max-length (4000 char) messages.
  const content = truncate(message.content, 400);
  if (content) return content;
  return 'No text content.';
}

// ─── Components V2 builders ───────────────────────────────────────────────────

// Builds the spoiler-wrapped media gallery component (type 12 = media gallery)
// Attachments are wrapped in ||spoiler|| via markdown inside a text component
// below the gallery (Discord doesn't support spoiler natively on gallery items,
// so we use a text block with masked links as a spoiler fallback).
function buildMediaSection(attachments = []) {
  const imageAttachments = attachments.filter((a) => a.isImage && a.url).slice(0, 4);
  const nonImageAttachments = attachments.filter((a) => !a.isImage && a.url);

  const sections = [];

  if (imageAttachments.length) {
    // Spoiler text block with links comes first so moderators know to expand
    const spoilerLinks = imageAttachments
      .map((a, i) => `||[image ${i + 1}](${a.url})||`)
      .join('  ');
    sections.push({ type: 10, content: `**Media** (spoiler): ${spoilerLinks}` });
  }

  if (nonImageAttachments.length) {
    const fileLinks = nonImageAttachments
      .map((a, i) => `[file ${i + 1}](${a.url})`)
      .join(', ');
    sections.push({ type: 10, content: `**Files**: ${fileLinks}` });
  }

  return sections;
}

// Main case report card — no accent color (accentColor omitted → default/none)
function buildCaseReportComponents(report, resolvedLabel = '') {
  // Message content line: clicking the hyperlink jumps to the original message
  const contentLine = `**[Message Content](${report.messageUrl})**: ${report.messageContent}`;

  const bodyLines = [
    `# Message Case Report`,
    `**Author**: <@${report.targetUserId}> (${escapeMarkdown(report.targetUsername)})`,
    `**Reported At**: <t:${report.reportedTimestamp}:F>`,
    `**Reason**: ${escapeMarkdown(report.reason)}`,
    contentLine
  ];

  const innerComponents = [
    { type: 10, content: bodyLines.join('\n') },
    ...buildMediaSection(report.attachments)
  ];

  if (!resolvedLabel) {
    // Warn + Timeout available to allowed roles; Kick only for admins/owner
    // (enforced at action time — we render the button for everyone but gate it)
    innerComponents.push({
      type: 1,
      components: [
        { type: 2, custom_id: `${CASE_ACTION_PREFIX}:warn:${report.token}`,    style: ButtonStyle.Secondary, label: 'Warn'    },
        { type: 2, custom_id: `${CASE_ACTION_PREFIX}:timeout:${report.token}`, style: ButtonStyle.Primary,   label: 'Timeout' },
        { type: 2, custom_id: `${CASE_ACTION_PREFIX}:kick:${report.token}`,    style: ButtonStyle.Danger,    label: 'Kick'    }
      ]
    });
  } else {
    innerComponents.push({ type: 10, content: `**Action Taken**: ${resolvedLabel}` });
  }

  return [{ type: 17, components: innerComponents }];
}



// ─── DM helper ───────────────────────────────────────────────────────────────

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

// ─── Guild action helper ──────────────────────────────────────────────────────

async function performGuildAction({ member, actionType, reason, durationSeconds }) {
  switch (actionType) {
    case 'WARN':    return;
    case 'TIMEOUT': await member.timeout(durationSeconds * 1000, reason || 'Timed out by moderator'); return;
    case 'KICK':    await member.kick(reason || 'Kicked by moderator'); return;
    default: throw new Error('Unsupported case action');
  }
}

// ─── Handler: context menu command ───────────────────────────────────────────

async function handleCaseCommand(interaction, context) {
  const { configCache } = context;
  const moderationService = getModerationService(context);

  if (!interaction.guildId || !interaction.guild || !interaction.targetMessage) {
    await interaction.reply({ content: 'This command can only be used on a server message.', ephemeral: true });
    return;
  }

  const caseConfig = await getCaseCommandConfig(interaction.guildId, moderationService, configCache);

  if (!canUseCaseCommand(interaction.member, interaction.guild)) {
    await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    return;
  }

  const reportChannelId = CASE_REPORT_CHANNEL_ID;

  const targetMessage = interaction.targetMessage;
  if (!targetMessage.author?.id) {
    await interaction.reply({ content: 'This message cannot be reported.', ephemeral: true });
    return;
  }
  if (targetMessage.author.id === interaction.user.id) {
    await interaction.reply({ content: 'You cannot open a case on your own message.', ephemeral: true });
    return;
  }

  const token = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  pendingCaseReports.set(token, {
    guildId:         interaction.guildId,
    reporterId:      interaction.user.id,
    targetUserId:    targetMessage.author.id,
    targetUsername:  targetMessage.author.tag ?? targetMessage.author.username ?? 'Unknown',
    messageId:       targetMessage.id,
    messageUrl:      targetMessage.url,
    messageContent:  getMessagePreview(targetMessage),
    attachments:     getAttachmentData(targetMessage),
    reportChannelId,
    timeoutMinutes:  caseConfig.default_timeout_minutes
  });

  const modal = new ModalBuilder()
    .setCustomId(`${CASE_MODAL_PREFIX}:${token}`)
    .setTitle('Open Case');

  modal.addComponents(
    textInputRow(
      new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason for report')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500)
        .setPlaceholder('Describe what this user did…')
    )
  );

  try {
    await interaction.showModal(modal);
  } catch {
    pendingCaseReports.delete(token);
    await interaction.reply({ content: 'Unable to open the case form right now. Please try again.', ephemeral: true });
  }
}

// ─── Handler: reason modal submit ────────────────────────────────────────────

async function handleCaseModal(interaction, context) {
  const token  = interaction.customId.slice(`${CASE_MODAL_PREFIX}:`.length);
  const report = pendingCaseReports.get(token);

  if (!report || report.reporterId !== interaction.user.id || report.guildId !== interaction.guildId) {
    await interaction.reply({ content: 'This case report is no longer available.', ephemeral: true });
    return;
  }
  if (report.resolved || report.reportMessageId) {
    await interaction.reply({ content: 'This case report has already been submitted.', ephemeral: true });
    return;
  }

  const reason  = truncate(interaction.fields.getTextInputValue('reason'), 500);
  const channel = await interaction.guild.channels.fetch(report.reportChannelId).catch(() => null);

  if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
    pendingCaseReports.delete(token);
    await interaction.reply({ content: 'The configured case report channel is unavailable.', ephemeral: true });
    return;
  }

  const finalizedReport = { ...report, reason, reportedTimestamp: Math.floor(Date.now() / 1000), token };

  let sentMessage;
  try {
    sentMessage = await channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: buildCaseReportComponents(finalizedReport),
      allowedMentions: { parse: [] }
    });
  } catch {
    await interaction.reply({ content: 'Failed to send case report to the configured channel.', ephemeral: true });
    return;
  }

  pendingCaseReports.set(token, { ...finalizedReport, reportMessageId: sentMessage.id, resolved: false });
  await interaction.reply({ content: 'Case report sent.', ephemeral: true });
}

// ─── Handler: action button ───────────────────────────────────────────────────

async function handleCaseAction(interaction, context) {
  const actionKey = interaction.customId.slice(`${CASE_ACTION_PREFIX}:`.length).split(':', 1)[0];
  const token     = interaction.customId.slice(`${CASE_ACTION_PREFIX}:${actionKey}:`.length);
  const report    = pendingCaseReports.get(token);

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

  if (!canUseCaseCommand(interaction.member, interaction.guild)) {
    await interaction.reply({ content: 'You do not have permission to use this action.', ephemeral: true });
    return;
  }

  const actionType = actionKey === 'warn' ? 'WARN' : actionKey === 'timeout' ? 'TIMEOUT' : actionKey === 'kick' ? 'KICK' : null;
  if (!actionType) {
    await interaction.reply({ content: 'Unsupported case action.', ephemeral: true });
    return;
  }

  // Kick is restricted to admins/owner — configured roles cannot kick
  if (actionType === 'KICK' && !canKick(interaction.member, interaction.guild)) {
    await interaction.reply({ content: 'Only administrators and the server owner can use the Kick action.', ephemeral: true });
    return;
  }

  const member = await interaction.guild.members.fetch(report.targetUserId).catch(() => null);
  if (!member) {
    await interaction.reply({ content: 'The reported user is no longer in this server.', ephemeral: true });
    return;
  }
  if (member.id === interaction.user.id) {
    await interaction.reply({ content: 'You cannot action a case against yourself.', ephemeral: true });
    return;
  }

  // TIMEOUT → open duration + reason modal
  if (actionType === 'TIMEOUT') {
    const presetList = TIMEOUT_PRESETS
      .map((p, i) => `${i + 1}. ${p.label}`)
      .join('\n');

    const modal = new ModalBuilder()
      .setCustomId(`${CASE_TIMEOUT_MODAL_PREFIX}:${token}`)
      .setTitle('Timeout');

    modal.addComponents(
      textInputRow(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Why are you timing this user out?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500)
          .setPlaceholder('Be specific — false timeouts can result in staff role removal.')
      ),
      textInputRow(
        new TextInputBuilder()
          .setCustomId('duration')
          .setLabel('Duration (enter the number from the list)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(2)
          .setPlaceholder(`1–${TIMEOUT_PRESETS.length}  |  ${presetList.replace(/\n/g, ', ')}`)
      )
    );

    try {
      await interaction.showModal(modal);
    } catch {
      await interaction.reply({ content: 'Unable to open timeout form right now. Please try again.', ephemeral: true });
    }
    return;
  }

  // KICK → open reason modal
  if (actionType === 'KICK') {
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
          .setPlaceholder('Provide a clear reason for kicking this user…')
      )
    );

    try {
      await interaction.showModal(modal);
    } catch {
      await interaction.reply({ content: 'Unable to open kick form right now. Please try again.', ephemeral: true });
    }
    return;
  }

  // WARN — no extra modal needed
  const moderatorName = interaction.user.tag ?? interaction.user.username;
  const modConfig = await moderationService.getModConfig(interaction.guildId).catch(() => ({ dm_on_punish: false, show_mod_in_dm: false }));

  try {
    if (modConfig.dm_on_punish) {
      await sendModerationDm({ member, guildName: interaction.guild.name, actionType: 'WARN', reason: report.reason, moderatorName, showModerator: Boolean(modConfig.show_mod_in_dm) });
    }
    await performGuildAction({ member, actionType: 'WARN', reason: report.reason, durationSeconds: null });
    await moderationService.createCase({
      guildId:           interaction.guildId,
      targetUserId:      report.targetUserId,
      targetUsername:    report.targetUsername,
      moderatorUserId:   interaction.user.id,
      moderatorUsername: moderatorName,
      type:              'WARN',
      reason:            `${report.reason} (reported message: ${report.messageUrl})`,
      durationSeconds:   null
    });
  } catch (error) {
    await interaction.reply({ content: `Failed to apply action: ${error.message}`, ephemeral: true });
    return;
  }

  report.resolved = true;
  pendingCaseReports.set(token, report);

  const resolvedLabel = `WARN by ${escapeMarkdown(moderatorName)}`;

  await interaction.update({ components: buildCaseReportComponents(report, resolvedLabel), allowedMentions: { parse: [] } });
  await interaction.followUp({ content: 'Case action completed.', ephemeral: true });
    return;
  }

  const { configCache } = context;
  const moderationService = getModerationService(context);
  const caseConfig = await getCaseCommandConfig(interaction.guildId, moderationService, configCache);
  if (!canUseCaseCommand(interaction.member, interaction.guild)) {
    await interaction.reply({ content: 'You do not have permission to use this action.', ephemeral: true });
    return;
  }

  const reason        = truncate(interaction.fields.getTextInputValue('reason'), 500);
  const durationInput = interaction.fields.getTextInputValue('duration').trim();
  const presetIndex   = Number.parseInt(durationInput, 10) - 1;

  if (Number.isNaN(presetIndex) || presetIndex < 0 || presetIndex >= TIMEOUT_PRESETS.length) {
    await interaction.reply({ content: `Invalid duration. Enter a number between 1 and ${TIMEOUT_PRESETS.length}.`, ephemeral: true });
    return;
  }

  const { minutes } = TIMEOUT_PRESETS[presetIndex];
  const durationSeconds = minutes * 60;

  const member = await interaction.guild.members.fetch(report.targetUserId).catch(() => null);
  if (!member || member.id === interaction.user.id) {
    await interaction.reply({ content: 'The reported user is not available for this action.', ephemeral: true });
    return;
  }

  const moderatorName = interaction.user.tag ?? interaction.user.username;
  const modConfig = await moderationService.getModConfig(interaction.guildId).catch(() => ({ dm_on_punish: false, show_mod_in_dm: false }));

  try {
    if (modConfig.dm_on_punish) {
      await sendModerationDm({ member, guildName: interaction.guild.name, actionType: 'TIMEOUT', reason: `${reason}\nDuration: ${minutes} minute(s)`, moderatorName, showModerator: Boolean(modConfig.show_mod_in_dm) });
    }
    await performGuildAction({ member, actionType: 'TIMEOUT', reason, durationSeconds });
    await moderationService.createCase({
      guildId:           interaction.guildId,
      targetUserId:      report.targetUserId,
      targetUsername:    report.targetUsername,
      moderatorUserId:   interaction.user.id,
      moderatorUsername: moderatorName,
      type:              'TIMEOUT',
      reason:            `${reason} (reported message: ${report.messageUrl})`,
      durationSeconds
    });
  } catch (error) {
    await interaction.reply({ content: `Failed to apply timeout: ${error.message}`, ephemeral: true });
    return;
  }

  report.resolved      = true;
  report.timeoutMinutes = minutes;
  report.reason         = reason; // update reason to the timeout-specific one
  pendingCaseReports.set(token, report);

  const resolvedLabel = `TIMEOUT for ${TIMEOUT_PRESETS[presetIndex].label} by ${escapeMarkdown(moderatorName)}`;

  // Edit the original report card
  const channel = await interaction.guild.channels.fetch(report.reportChannelId).catch(() => null);
  const message = channel?.isTextBased?.()
    ? await channel.messages.fetch(report.reportMessageId).catch(() => null)
    : null;
  if (message) {
    await message.edit({ components: buildCaseReportComponents(report, resolvedLabel), allowedMentions: { parse: [] } });
  }

  await interaction.reply({ content: 'Case action completed.', ephemeral: true });
    return;
  }

  // Re-check kick permission at modal submit time (belt-and-suspenders)
  if (!canKick(interaction.member, interaction.guild)) {
    await interaction.reply({ content: 'Only administrators and the server owner can kick.', ephemeral: true });
    return;
  }

  const reason = truncate(interaction.fields.getTextInputValue('reason'), 500);
  const member = await interaction.guild.members.fetch(report.targetUserId).catch(() => null);
  if (!member || member.id === interaction.user.id) {
    await interaction.reply({ content: 'The reported user is not available for this action.', ephemeral: true });
    return;
  }

  const moderationService = getModerationService(context);
  const moderatorName = interaction.user.tag ?? interaction.user.username;
  const modConfig = await moderationService.getModConfig(interaction.guildId).catch(() => ({ dm_on_punish: false, show_mod_in_dm: false }));

  try {
    if (modConfig.dm_on_punish) {
      await sendModerationDm({ member, guildName: interaction.guild.name, actionType: 'KICK', reason, moderatorName, showModerator: Boolean(modConfig.show_mod_in_dm) });
    }
    await performGuildAction({ member, actionType: 'KICK', reason, durationSeconds: null });
    await moderationService.createCase({
      guildId:           interaction.guildId,
      targetUserId:      report.targetUserId,
      targetUsername:    report.targetUsername,
      moderatorUserId:   interaction.user.id,
      moderatorUsername: moderatorName,
      type:              'KICK',
      reason:            `${reason} (reported message: ${report.messageUrl})`,
      durationSeconds:   null
    });
  } catch (error) {
    await interaction.reply({ content: `Failed to kick: ${error.message}`, ephemeral: true });
    return;
  }

  report.resolved = true;
  report.reason   = reason;
  pendingCaseReports.set(token, report);

  const resolvedLabel = `KICK by ${escapeMarkdown(moderatorName)}`;

  // Edit the original report card
  const channel = await interaction.guild.channels.fetch(report.reportChannelId).catch(() => null);
  const message = channel?.isTextBased?.()
    ? await channel.messages.fetch(report.reportMessageId).catch(() => null)
    : null;
  if (message) {
    await message.edit({ components: buildCaseReportComponents(report, resolvedLabel), allowedMentions: { parse: [] } });
  }

  await interaction.reply({ content: 'Case action completed.', ephemeral: true });
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