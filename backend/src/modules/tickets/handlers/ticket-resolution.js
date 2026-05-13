/**
 * Ticket resolution handler
 * Handles the ticket closure workflow
 */

import logger from '../services/logging-service.js';
import { buildResolveConfirmationPayload, buildErrorPayload, buildInfoPayload } from '../components/payloads.js';
import {
  markThreadNameClosed,
  isThreadNameClosed,
  findWelcomeMessageInThread,
  extractTagLabelFromMessage
} from '../utils/thread-utils.js';
import { buildTicketWelcomePayload } from '../components/payloads.js';
import { isTicketStaffFromInteraction } from '../utils/permissions.js';
import { ERROR_MESSAGES } from '../utils/constants.js';

export class TicketResolutionHandler {
  constructor(ticketService) {
    this.ticketService = ticketService;
  }

  /**
   * Handles the resolved button press (Step 1 - show confirmation)
   */
  async handleResolvedButtonPress(interaction, creatorId) {
    const { channel, user } = interaction;

    logger.info('Resolved button pressed', { threadId: channel.id, userId: user.id });

    // Validate context
    if (!interaction.inGuild() || !channel?.isThread?.()) {
      await this.replyError(interaction, ERROR_MESSAGES.NOT_IN_THREAD, true);
      return;
    }

    // Check permissions
    if (!isTicketStaffFromInteraction(interaction)) {
      await this.replyError(interaction, ERROR_MESSAGES.NOT_STAFF, true);
      return;
    }

    // Check if already closed
    if (isThreadNameClosed(channel.name)) {
      await this.replyError(interaction, ERROR_MESSAGES.ALREADY_CLOSED, true);
      return;
    }

    // Show confirmation prompt
    try {
      const payload = buildResolveConfirmationPayload(creatorId);
      await interaction.reply(payload).catch(() => null);
    } catch (error) {
      logger.error('Failed to show confirmation prompt', { threadId: channel.id, error: error.message });
    }
  }

  /**
   * Handles the resolve confirm button (Step 2a - actually close)
   */
  async handleResolveConfirm(interaction, creatorId) {
    const { channel, user } = interaction;

    logger.info('Resolve confirmed', { threadId: channel.id, staffId: user.id });

    // Defer update
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => null);
    }

    try {
      // Validate context
      if (!interaction.inGuild() || !channel?.isThread?.()) {
        await this.followUpError(interaction, ERROR_MESSAGES.NOT_IN_THREAD);
        return;
      }

      // Check permissions
      if (!isTicketStaffFromInteraction(interaction)) {
        await this.followUpError(interaction, ERROR_MESSAGES.NOT_STAFF);
        return;
      }

      // Check if already closed
      if (isThreadNameClosed(channel.name)) {
        await this.followUpError(interaction, ERROR_MESSAGES.ALREADY_CLOSED);
        return;
      }

      // Disable the resolved button
      await this.disableResolvedButton(channel, creatorId);

      // Execute close sequence
      await Promise.allSettled([
        channel.setName(markThreadNameClosed(channel.name)),
        channel.members.remove(creatorId)
      ]);

      // Lock and archive
      await channel.setLocked(true).catch(() => null);
      await channel.setArchived(true).catch(() => null);

      // Apply cooldown
      await this.ticketService.cooldownService.applyCooldown(creatorId);

      // Update database
      try {
        await this.ticketService.resolveTicket(channel.id, user.id, creatorId);
      } catch (error) {
        logger.error('Failed to update database', { threadId: channel.id, error: error.message });
      }

      // Delete the confirmation message
      await this.deleteConfirmationMessage(interaction);

      await this.followUpSuccess(interaction, 'Ticket has been closed successfully.');
    } catch (error) {
      logger.error('Ticket resolution failed', {
        threadId: channel.id,
        error: error.message
      });
      await this.followUpError(interaction, 'An error occurred while closing the ticket.');
    }
  }

  /**
   * Handles the resolve cancel button (Step 2b - cancel closure)
   */
  async handleResolveCancel(interaction) {
    logger.debug('Resolve cancelled', { threadId: interaction.channel?.id });

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => null);
    }

    // Delete the confirmation message
    await this.deleteConfirmationMessage(interaction);

    // Re-enable resolved button since ticket wasn't closed
    await this.enableResolvedButton(interaction.channel, interaction.user.id);

    await this.followUpInfo(interaction, 'Action cancelled — ticket remains open.');
  }

  /**
   * Re-enables resolved button on welcome message
   */
  async enableResolvedButton(thread, creatorId) {
    try {
      const message = await findWelcomeMessageInThread(thread);
      if (!message) return;

      const tagLabel = extractTagLabelFromMessage(message) || 'Support Ticket';
      const tag = { label: tagLabel, intro: '' };

      await message.edit(buildTicketWelcomePayload(tag, creatorId, { resolvedDisabled: false })).catch(() => null);
    } catch (error) {
      logger.warn('Failed to re-enable resolved button', { error: error.message });
    }
  }

  /**
   * Disables the resolved button on the welcome message
   */
  async disableResolvedButton(thread, creatorId) {
    try {
      const message = await findWelcomeMessageInThread(thread);
      if (!message) return;

      const tagLabel = extractTagLabelFromMessage(message) || 'Support Ticket';
      const tag = { label: tagLabel, intro: '' };

      await message.edit(buildTicketWelcomePayload(tag, creatorId, { resolvedDisabled: true })).catch(() => null);
    } catch (error) {
      logger.warn('Failed to disable resolved button', { error: error.message });
    }
  }

  /**
   * Helper: Reply with error
   */
  async replyError(interaction, message, ephemeral = false) {
    const payload = buildErrorPayload(message);
    payload.ephemeral = ephemeral;
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
  }

  /**
   * Helper: Follow-up with error
   */
  async followUpError(interaction, message) {
    await interaction.followUp(buildErrorPayload(message)).catch(() => null);
  }

  /**
   * Deletes the confirmation message
   */
  async deleteConfirmationMessage(interaction) {
    try {
      await interaction.deleteReply().catch(() => null);
    } catch (error) {
      logger.warn('Failed to delete confirmation message', { error: error.message });
    }
  }

  /**
   * Helper: Follow-up with success
   */
  async followUpSuccess(interaction, message) {
    const payload = { content: `✅ ${message}`, ephemeral: true };
    await interaction.followUp(payload).catch(() => null);
  }

  /**
   * Helper: Follow-up with info
   */
  async followUpInfo(interaction, message) {
    const payload = buildInfoPayload(message);
    await interaction.followUp(payload).catch(() => null);
  }
}

export default TicketResolutionHandler;
