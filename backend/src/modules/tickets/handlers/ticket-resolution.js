import { MessageFlags } from 'discord.js';
import { ticketService } from '../services/ticket-service.js';
import { cooldownService } from '../services/cooldown-service.js';
import { lockService } from '../services/lock-service.js';
import { webhookService } from '../services/webhook-service.js';
import { 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  AUTO_ARCHIVE_24H,
  AUTO_ARCHIVE_1H,
  LOG_COLORS,
  TICKET_LOG_CHANNEL_ID
} from '../utils/constants.js';
import { 
  markThreadNameClosed, 
  markThreadNameOpen,
  isThreadNameClosed,
  buildThreadLink,
  safeUpdateThreadName,
  canManageUsers
} from '../utils/thread-utils.js';
import { isTicketStaffFromInteraction } from '../utils/permissions.js';

/**
 * Handle ticket resolution/reopening with distributed mutex protection
 */
export async function toggleResolved(interaction, creatorId) {
  // Defer reply
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => null);
  }

  const reply = async (content) => {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content }).catch(() => null);
      return;
    }
    await interaction.reply({ content, ephemeral: true }).catch(() => null);
  };

  // Validate interaction context
  if (!interaction.inGuild() || !interaction.channel?.isThread?.()) {
    await reply(ERROR_MESSAGES.NOT_TICKET_THREAD);
    return;
  }

  if (!isTicketStaffFromInteraction(interaction)) {
    await reply(ERROR_MESSAGES.NOT_TICKET_STAFF);
    return;
  }

  const thread = interaction.channel;
  const threadId = thread.id;

  // Get ticket from database
  const ticket = await ticketService.getTicketByThreadId(threadId);
  if (!ticket) {
    await reply(ERROR_MESSAGES.INVALID_TICKET_STATE);
    return;
  }

  const isCurrentlyClosed = isThreadNameClosed(thread.name);

  if (!isCurrentlyClosed) {
    // Close ticket
    await closeTicket(interaction, thread, ticket, creatorId, reply);
  } else {
    // Reopen ticket
    await reopenTicket(interaction, thread, ticket, creatorId, reply);
  }
}

/**
 * Close ticket with mutex protection
 */
async function closeTicket(interaction, thread, ticket, creatorId, reply) {
  const threadId = thread.id;
  
  // Acquire distributed mutex
  const lockValue = await lockService.acquireResolveMutex(threadId);
  if (!lockValue) {
    await reply('This ticket is already being closed by another staff member.');
    return;
  }

  try {
    // Update thread name safely
    const closedName = markThreadNameClosed(thread.name);
    await safeUpdateThreadName(thread, closedName);

    // Remove creator from thread
    await thread.members.remove(creatorId).catch(() => null);

    // Update thread settings
    await Promise.all([
      thread.setAutoArchiveDuration(AUTO_ARCHIVE_1H).catch(() => null),
      thread.setLocked(true).catch(() => null),
      thread.setArchived(true).catch(() => null)
    ]);

    // Update database
    await ticketService.resolveTicket(threadId, interaction.user.id);

    // Set cooldown
    await cooldownService.setCooldown(
      interaction.guildId,
      creatorId,
      10 * 60 * 1000 // 10 minutes
    );

    // Update log message
    await updateResolvedLog(thread, ticket, interaction.user.id);

    await reply(SUCCESS_MESSAGES.TICKET_RESOLVED);
  } catch (error) {
    console.error('Error closing ticket:', error);
    await reply(ERROR_MESSAGES.FAILED_OPERATION);
  } finally {
    // Always release the lock
    await lockService.releaseResolveMutex(threadId, lockValue);
  }
}

/**
 * Reopen ticket
 */
async function reopenTicket(interaction, thread, ticket, creatorId, reply) {
  try {
    // Update thread name
    const openName = markThreadNameOpen(thread.name);
    await safeUpdateThreadName(thread, openName);

    // Update thread settings
    await Promise.all([
      thread.setArchived(false).catch(() => null),
      thread.setLocked(false).catch(() => null),
      thread.setAutoArchiveDuration(AUTO_ARCHIVE_24H).catch(() => null)
    ]);

    // Add creator back to thread
    await thread.members.add(creatorId).catch(() => null);

    // Update database
    await ticketService.reopenTicket(threadId);

    // Clear cooldown
    await cooldownService.clearCooldown(interaction.guildId, creatorId);

    // Reset log message to "Created" state
    await resetLogToCreated(thread, ticket);

    await reply(SUCCESS_MESSAGES.TICKET_REOPENED);
  } catch (error) {
    console.error('Error reopening ticket:', error);
    await reply(ERROR_MESSAGES.FAILED_OPERATION);
  }
}

/**
 * Update resolved log message
 */
async function updateResolvedLog(thread, ticket, resolverId) {
  const logChannel = await thread.guild.channels.fetch(TICKET_LOG_CHANNEL_ID).catch(() => null);
  
  if (!logChannel?.isTextBased?.()) return;

  const webhook = await webhookService.getOrCreateLogWebhook(logChannel);
  if (!webhook) return;

  const { EmbedBuilder } = await import('discord.js');
  const threadLink = buildThreadLink(thread.guildId, thread.id);
  const now = Math.floor(Date.now() / 1000);

  // If we have a log message ID, edit it
  if (ticket.log_message_id) {
    try {
      const existingMessage = await webhook.fetchMessage(ticket.log_message_id);
      if (existingMessage) {
        const existingDescription = existingMessage.embeds?.[0]?.description ?? '';
        const createdBy = parseLogDescriptionField(existingDescription, 'Created By') ?? `<@${ticket.creator_id}>`;
        const createdAt = parseLogDescriptionField(existingDescription, 'Created At') ?? `<t:${now}:F>`;
        const storedTag = parseLogDescriptionField(existingDescription, 'Ticket Tag') ?? ticket.tag_label;

        const lines = [
          `<:Pointer:1502993771317694655> Created By: ${createdBy}`,
          `<:Pointer:1502993771317694655> Created At: ${createdAt}`,
          `<:Pointer:1502993771317694655> Resolved At: <t:${now}:F>`,
          `<:Pointer:1502993771317694655> Resolved By: <@${resolverId}>`,
          `<:Pointer:1502993771317694655> Ticket Tag: ${storedTag}`,
          `<:Pointer:1502993771317694655> Thread Link: ${threadLink}`
        ];

        const embed = new EmbedBuilder()
          .setTitle('Resolved')
          .setColor(LOG_COLORS.RESOLVED)
          .setDescription(lines.join('\n'));

        const updatedMessage = await webhook.editMessage(ticket.log_message_id, {
          embeds: [embed],
          allowedMentions: { parse: [] }
        });

        // Update ticket record with resolved log message ID
        await ticketService.updateLogMessageIds(thread.id, ticket.log_message_id, updatedMessage.id);
        return;
      }
    } catch (error) {
      console.error('Failed to edit existing log message:', error);
    }
  }

  // Fallback: create new resolved log
  const lines = [
    `<:Pointer:1502993771317694655> Created By: <@${ticket.creator_id}>`,
    `<:Pointer:1502993771317694655> Created At: <t:${now}:F>`,
    `<:Pointer:1502993771317694655> Resolved At: <t:${now}:F>`,
    `<:Pointer:1502993771317694655> Resolved By: <@${resolverId}>`,
    `<:Pointer:1502993771317694655> Ticket Tag: ${ticket.tag_label}`,
    `<:Pointer:1502993771317694655> Thread Link: ${threadLink}`
  ];

  const embed = new EmbedBuilder()
    .setTitle('Resolved')
    .setColor(LOG_COLORS.RESOLVED)
    .setDescription(lines.join('\n'));

  try {
    const resolvedMessage = await webhook.send({
      embeds: [embed],
      allowedMentions: { parse: [] }
    });

    // Update ticket record
    await ticketService.updateLogMessageIds(thread.id, ticket.log_message_id, resolvedMessage.id);
  } catch (error) {
    console.error('Failed to create resolved log:', error);
  }
}

/**
 * Reset log message to "Created" state
 */
async function resetLogToCreated(thread, ticket) {
  const logChannel = await thread.guild.channels.fetch(TICKET_LOG_CHANNEL_ID).catch(() => null);
  
  if (!logChannel?.isTextBased?.()) return;

  const webhook = await webhookService.getOrCreateLogWebhook(logChannel);
  if (!webhook) return;

  const { EmbedBuilder } = await import('discord.js');
  const threadLink = buildThreadLink(thread.guildId, thread.id);
  const now = Math.floor(Date.now() / 1000);

  if (ticket.log_message_id) {
    try {
      const existingMessage = await webhook.fetchMessage(ticket.log_message_id);
      if (existingMessage) {
        const existingDescription = existingMessage.embeds?.[0]?.description ?? '';
        const createdBy = parseLogDescriptionField(existingDescription, 'Created By') ?? `<@${ticket.creator_id}>`;
        const createdAt = parseLogDescriptionField(existingDescription, 'Created At') ?? `<t:${now}:F>`;
        const storedTag = parseLogDescriptionField(existingDescription, 'Ticket Tag') ?? ticket.tag_label;

        const lines = [
          `<:Pointer:1502993771317694655> Created By: ${createdBy}`,
          `<:Pointer:1502993771317694655> Created At: ${createdAt}`,
          `<:Pointer:1502993771317694655> Resolved At: -`,
          `<:Pointer:1502993771317694655> Resolved By: -`,
          `<:Pointer:1502993771317694655> Ticket Tag: ${storedTag}`,
          `<:Pointer:1502993771317694655> Thread Link: ${threadLink}`
        ];

        const embed = new EmbedBuilder()
          .setTitle('Created')
          .setColor(LOG_COLORS.CREATED)
          .setDescription(lines.join('\n'));

        await webhook.editMessage(ticket.log_message_id, {
          embeds: [embed],
          allowedMentions: { parse: [] }
        });
      }
    } catch (error) {
      console.error('Failed to reset log message:', error);
    }
  }
}

/**
 * Parse field from log description
 */
function parseLogDescriptionField(description, label) {
  const match = description.match(new RegExp(`${label}:\\s*(.+)`));
  return match?.[1]?.trim() ?? null;
}
