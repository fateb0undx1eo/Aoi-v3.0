import { ButtonStyle } from 'discord.js';
import { ticketRepository } from '../repositories/ticket-repository.js';
import { cooldownService } from '../services/cooldown-service.js';
import { loggingService } from '../services/logging-service.js';
import { metricsService } from '../services/metrics-service.js';
import { webhookService } from '../services/webhook-service.js';
import { errorHandler } from '../utils/error-handler.js';
import { 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  DEFAULT_ARCHIVE_DURATION,
  LOG_COLORS,
  TICKET_LOG_CHANNEL_ID,
  CUSTOM_IDS,
  REDIS_TTL
} from '../utils/constants.js';
import { 
  markThreadNameClosed, 
  isThreadNameClosed,
  buildThreadLink
} from '../utils/thread-utils.js';
import { isTicketStaffFromInteraction } from '../utils/permissions.js';
import { 
  validateInteraction,
  validateThreadState
} from '../utils/validators.js';
import { 
  generateRedisKey,
  LOCK_KEYS 
} from '../utils/redis-keys.js';
import { redisClient } from '../../../core/redis.js';

/**
 * Enterprise-grade ticket resolution handler
 * Uses distributed locking, structured logging, and repository pattern
 */

/**
 * Handle resolved button click - show confirmation dialog
 */
export async function handleResolvedButton(interaction, creatorId) {
  const context = await loggingService.logInteractionStart(interaction, 'resolve_button');
  const timer = metricsService.createTimer();

  try {
    // Validate inputs
    const validation = validateInteraction(interaction);
    if (!validation.isValid) {
      throw new Error(`Invalid interaction: ${validation.errors.join(', ')}`);
    }

    const threadValidation = validateThreadState(interaction.channel);
    if (!threadValidation.isValid) {
      await interaction.reply({
        content: ERROR_MESSAGES.NOT_TICKET_THREAD,
        ephemeral: true
      });
      return;
    }

    if (!isTicketStaffFromInteraction(interaction)) {
      await interaction.reply({
        content: ERROR_MESSAGES.NOT_TICKET_STAFF,
        ephemeral: true
      });
      return;
    }

    const thread = interaction.channel;
    
    // Check if ticket is already closed
    if (isThreadNameClosed(thread.name)) {
      await interaction.reply({
        content: 'This ticket is already resolved and cannot be resolved again.',
        ephemeral: true
      });
      return;
    }

    // Find ticket record
    const ticket = await ticketRepository.findByThreadId(thread.id);
    if (!ticket || ticket.status !== 'open') {
      await interaction.reply({
        content: ERROR_MESSAGES.INVALID_TICKET_STATE,
        ephemeral: true
      });
      return;
    }

    // Show confirmation modal
    const { Modal, TextInput, ActionRow } = await import('discord.js');
    
    const modal = new Modal()
      .setCustomId(`${CUSTOM_IDS.resolvedConfirm}:${thread.id}`)
      .setTitle('Resolve Ticket')
      .addComponents(
        new ActionRow().addComponents(
          new TextInput()
            .setCustomId('reason')
            .setLabel('Resolution reason (optional)')
            .setStyle('Paragraph')
            .setPlaceholder('Enter the reason for resolving this ticket...')
            .setRequired(false)
            .setMaxLength(1000)
        )
      );

    await interaction.showModal(modal);

    // Record success metric
    const duration = timer.stop();
    await metricsService.recordTicketResolution(duration, true, {
      guildId: interaction.guildId,
      threadId: thread.id,
      userId: interaction.user.id
    });

    await loggingService.logInteractionComplete(context, 'resolve_button', { 
      success: true, 
      duration 
    });

  } catch (error) {
    const duration = timer.stop();
    await metricsService.recordTicketResolution(duration, false, {
      guildId: interaction.guildId,
      threadId: interaction.channel?.id,
      userId: interaction.user.id,
      error: error.message
    });

    await errorHandler.handleInteractionError(context, error, 'resolve_button');
  }
}

/**
 * Handle confirmation YES - actually resolve the ticket
 */
export async function handleResolvedConfirmYes(interaction, creatorId) {
  const context = await loggingService.logInteractionStart(interaction, 'resolve_confirm_yes');
  const timer = metricsService.createTimer();

  try {
    // Validate inputs
    const validation = validateInteraction(interaction);
    if (!validation.isValid) {
      throw new Error(`Invalid interaction: ${validation.errors.join(', ')}`);
    }

    const threadValidation = validateThreadState(interaction.channel);
    if (!threadValidation.isValid) {
      await interaction.reply({
        content: ERROR_MESSAGES.NOT_TICKET_THREAD,
        ephemeral: true
      });
      return;
    }

    if (!isTicketStaffFromInteraction(interaction)) {
      await interaction.reply({
        content: ERROR_MESSAGES.NOT_TICKET_STAFF,
        ephemeral: true
      });
      return;
    }

    const thread = interaction.channel;
    
    // Check if ticket is already closed
    if (isThreadNameClosed(thread.name)) {
      await interaction.reply({
        content: 'This ticket is already resolved.',
        ephemeral: true
      });
      return;
    }

    // Acquire distributed lock to prevent concurrent operations
    const lockKey = generateRedisKey('lock', 'resolve', thread.id);
    const lockValue = await redisClient.acquireLock(lockKey, REDIS_TTL.RESOLVE_MUTEX);
    
    if (!lockValue) {
      await interaction.reply({
        content: 'Another staff member is currently resolving this ticket. Please wait a moment and try again.',
        ephemeral: true
      });
      return;
    }

    try {
      // Find ticket record
      const ticket = await ticketRepository.findByThreadId(thread.id);
      if (!ticket || ticket.status !== 'open') {
        await interaction.reply({
          content: 'Ticket not found or not in valid state.',
          ephemeral: true
        });
        return;
      }

      // Update thread name to mark as closed
      const closedName = markThreadNameClosed(thread.name);
      await thread.setName(closedName);

      // Remove creator from thread
      await thread.members.remove(creatorId).catch(() => null);

      // Lock and archive the thread
      await thread.setLocked(true).catch(() => null);
      await thread.setArchived(true).catch(() => null);
      await thread.setAutoArchiveDuration(DEFAULT_ARCHIVE_DURATION).catch(() => null);

      // Update ticket status in database
      await ticketRepository.updateStatus(thread.id, 'resolved', {
        resolved_by: interaction.user.id,
        resolved_at: new Date().toISOString()
      });

      // Set cooldown for creator
      await cooldownService.setCooldown(interaction.guildId, creatorId, 10 * 60 * 1000);

      // Send resolved log
      await sendResolvedLog(thread, {
        creatorId,
        resolverId: interaction.user.id,
        tagLabel: ticket.tag_label || 'Unknown'
      });

      // Update welcome message to disable resolved button
      await disableResolvedButtonInWelcome(thread, creatorId);

      await interaction.reply({
        content: SUCCESS_MESSAGES.TICKET_RESOLVED,
        ephemeral: true
      });

      // Record success metric
      const duration = timer.stop();
      await metricsService.recordTicketResolution(duration, true, {
        guildId: interaction.guildId,
        threadId: thread.id,
        userId: interaction.user.id
      });

      await loggingService.logInteractionComplete(context, 'resolve_confirm_yes', { 
        success: true, 
        duration 
      });

    } finally {
      // Release lock
      await redisClient.releaseLock(lockKey, lockValue);
    }

  } catch (error) {
    const duration = timer.stop();
    await metricsService.recordTicketResolution(duration, false, {
      guildId: interaction.guildId,
      threadId: interaction.channel?.id,
      userId: interaction.user.id,
      error: error.message
    });

    await errorHandler.handleInteractionError(context, error, 'resolve_confirm_yes');
  }
}

/**
 * Handle confirmation NO - cancel resolution
 */
export async function handleResolvedConfirmNo(interaction, creatorId) {
  const context = await loggingService.logInteractionStart(interaction, 'resolve_confirm_no');
  
  try {
    await interaction.update({
      content: 'Ticket resolution cancelled.',
      components: [],
      ephemeral: true
    }).catch(() => null);

    await loggingService.logInteractionComplete(context, 'resolve_confirm_no', { 
      success: true 
    });

  } catch (error) {
    await errorHandler.handleInteractionError(context, error, 'resolve_confirm_no');
  }
}

/**
 * Handle modal submit for ticket resolution
 */
export async function handleResolvedModalSubmit(interaction, threadId) {
  const context = await loggingService.logInteractionStart(interaction, 'resolve_modal');
  const timer = metricsService.createTimer();

  try {
    // Validate inputs
    const validation = validateInteraction(interaction);
    if (!validation.isValid) {
      throw new Error(`Invalid interaction: ${validation.errors.join(', ')}`);
    }

    if (!isTicketStaffFromInteraction(interaction)) {
      await interaction.reply({
        content: ERROR_MESSAGES.NOT_TICKET_STAFF,
        ephemeral: true
      });
      return;
    }

    // Get the resolution reason from modal
    const reason = interaction.fields.getTextInputValue('reason') || 'No reason provided';

    // Find ticket record
    const ticket = await ticketRepository.findByThreadId(threadId);
    if (!ticket || ticket.status !== 'open') {
      await interaction.reply({
        content: 'Ticket not found or not in valid state.',
        ephemeral: true
      });
      return;
    }

    // Acquire distributed lock
    const lockKey = generateRedisKey('lock', 'resolve', threadId);
    const lockValue = await redisClient.acquireLock(lockKey, REDIS_TTL.RESOLVE_MUTEX);
    
    if (!lockValue) {
      await interaction.reply({
        content: 'Another staff member is currently resolving this ticket.',
        ephemeral: true
      });
      return;
    }

    try {
      const thread = await interaction.channel?.guild?.channels?.fetch(threadId);
      if (!thread?.isThread?.()) {
        throw new Error('Invalid thread');
      }

      // Update thread name to mark as closed
      const closedName = markThreadNameClosed(thread.name);
      await thread.setName(closedName);

      // Remove creator from thread
      await thread.members.remove(ticket.creator_id).catch(() => null);

      // Lock and archive the thread
      await thread.setLocked(true).catch(() => null);
      await thread.setArchived(true).catch(() => null);
      await thread.setAutoArchiveDuration(DEFAULT_ARCHIVE_DURATION).catch(() => null);

      // Update ticket status in database
      await ticketRepository.updateStatus(threadId, 'resolved', {
        resolved_by: interaction.user.id,
        resolved_at: new Date().toISOString(),
        resolution_reason: reason
      });

      // Set cooldown for creator
      await cooldownService.setCooldown(interaction.guildId, ticket.creator_id, 10 * 60 * 1000);

      // Send resolved log
      await sendResolvedLog(thread, {
        creatorId: ticket.creator_id,
        resolverId: interaction.user.id,
        tagLabel: ticket.tag_label || 'Unknown',
        reason
      });

      await interaction.reply({
        content: SUCCESS_MESSAGES.TICKET_RESOLVED,
        ephemeral: true
      });

      // Record success metric
      const duration = timer.stop();
      await metricsService.recordTicketResolution(duration, true, {
        guildId: interaction.guildId,
        threadId: threadId,
        userId: interaction.user.id
      });

      await loggingService.logInteractionComplete(context, 'resolve_modal', { 
        success: true, 
        duration 
      });

    } finally {
      // Release lock
      await redisClient.releaseLock(lockKey, lockValue);
    }

  } catch (error) {
    const duration = timer.stop();
    await metricsService.recordTicketResolution(duration, false, {
      guildId: interaction.guildId,
      threadId: threadId,
      userId: interaction.user.id,
      error: error.message
    });

    await errorHandler.handleInteractionError(context, error, 'resolve_modal');
  }
}

/**
 * Disable the resolved button in the welcome message
 */
async function disableResolvedButtonInWelcome(thread, creatorId) {
  try {
    // Fetch messages to find the welcome message
    const messages = await thread.messages.fetch({ limit: 10 });
    
    // Look for the welcome message
    const welcomeMessage = messages.find(msg => 
      msg.components && 
      msg.components.length > 0 &&
      msg.components[0].components.some(comp => 
        comp.custom_id === `${CUSTOM_IDS.resolvedPrefix}:${creatorId}`
      )
    );

    if (welcomeMessage) {
      // Update the welcome message to disable the resolved button
      const updatedComponents = welcomeMessage.components.map(row => ({
        type: row.type,
        components: row.components.map(comp => {
          if (comp.custom_id === `${CUSTOM_IDS.resolvedPrefix}:${creatorId}`) {
            return {
              ...comp,
              disabled: true,
              label: 'RESOLVED (Already Resolved)',
              style: ButtonStyle.Secondary
            };
          }
          return comp;
        })
      }));

      await welcomeMessage.edit({
        components: updatedComponents
      });
    }
  } catch (error) {
    await loggingService.warn({
      operation: 'disable_resolved_button',
      guildId: thread.guildId,
      threadId: thread.id,
      message: 'Failed to disable resolved button',
      metadata: { error: error.message }
    });
  }
}

/**
 * Send resolved log message
 */
async function sendResolvedLog(thread, { creatorId, resolverId, tagLabel, reason = null }) {
  try {
    const { webhook } = await webhookService.getOrCreateLogWebhook(
      thread.guild,
      TICKET_LOG_CHANNEL_ID
    );

    if (!webhook) return;

    const threadLink = buildThreadLink(thread.guildId, thread.id);
    const now = Math.floor(Date.now() / 1000);

    const embed = {
      title: 'Resolved',
      color: LOG_COLORS.RESOLVED,
      description: [
        `**Resolved By:** <@${resolverId}>`,
        `**Resolved At:** <t:${now}:F>`,
        `**Created By:** <@${creatorId}>`,
        `**Ticket Tag:** ${tagLabel}`,
        `**Thread Link:** ${threadLink}`,
        reason ? `**Reason:** ${reason}` : ''
      ].filter(Boolean).join('\n')
    };

    await webhook.send({
      embeds: [embed],
      allowedMentions: { parse: [] }
    });
  } catch (error) {
    await loggingService.warn({
      operation: 'send_resolved_log',
      guildId: thread.guildId,
      threadId: thread.id,
      message: 'Failed to send resolved log',
      metadata: { error: error.message }
    });
  }
}
