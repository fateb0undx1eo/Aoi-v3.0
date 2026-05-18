/**
 * User management handler
 * Handles adding and removing users from tickets
 */

import logger from '../services/logging-service.js';
import { buildAddUserModalWithSelect, buildRemoveUserModalWithSelect } from '../components/modals.js';
import { buildErrorPayload, buildSuccessPayload } from '../components/payloads.js';
import { isTicketStaffFromInteraction } from '../utils/permissions.js';
import { validateUserIdFromFields, isValidDiscordId } from '../utils/validators.js';
import { buildThreadLink } from '../utils/custom-id-utils.js';
import { isTicketStaffLike } from '../utils/permissions.js';
import { CUSTOM_IDS, ERROR_MESSAGES } from '../utils/constants.js';

export class UserManagementHandler {
  constructor(ticketRepository, discordRestService) {
    this.ticketRepo = ticketRepository;
    this.discordRest = discordRestService;
  }

  /**
   * Handles the add user button
   */
  async handleAddUserButton(interaction, threadId) {
    const { channel, user } = interaction;

    logger.debug('Add user button pressed', { threadId, userId: user.id });

    // Validation
    if (!interaction.inGuild() || !channel?.isThread?.()) {
      await this.replyError(interaction, ERROR_MESSAGES.NOT_IN_THREAD, true);
      return;
    }

    if (!isTicketStaffFromInteraction(interaction)) {
      await this.replyError(interaction, ERROR_MESSAGES.NOT_STAFF, true);
      return;
    }

    if (interaction.channelId !== threadId) {
      await this.replyError(interaction, ERROR_MESSAGES.INVALID_THREAD, true);
      return;
    }

    // Show modal
    try {
      const modal = buildAddUserModalWithSelect(threadId);
      await interaction.showModal(modal);
    } catch (error) {
      logger.error('Failed to show add user modal', { error: error.message });
      await this.replyError(interaction, 'Failed to open add-user modal.', true);
    }
  }

  /**
   * Handles the remove user button
   */
  async handleRemoveUserButton(interaction, threadId) {
    const { channel, user } = interaction;

    logger.debug('Remove user button pressed', { threadId, userId: user.id });

    // Validation
    if (!interaction.inGuild() || !channel?.isThread?.()) {
      await this.replyError(interaction, ERROR_MESSAGES.NOT_IN_THREAD, true);
      return;
    }

    if (!isTicketStaffFromInteraction(interaction)) {
      await this.replyError(interaction, ERROR_MESSAGES.NOT_STAFF, true);
      return;
    }

    if (interaction.channelId !== threadId) {
      await this.replyError(interaction, ERROR_MESSAGES.INVALID_THREAD, true);
      return;
    }

    // Show modal
    try {
      const modal = buildRemoveUserModalWithSelect(threadId);
      await interaction.showModal(modal);
    } catch (error) {
      logger.error('Failed to show remove user modal', { error: error.message });
      await this.replyError(interaction, 'Failed to open remove-user modal.', true);
    }
  }

  /**
   * Handles the add user modal submission
   */
  async handleAddUserModalSubmit(interaction, threadId) {
    const { channel, user, guild } = interaction;

    logger.debug('Add user modal submitted', { threadId, staffId: user.id });

    // Defer reply
    await interaction.deferReply({ ephemeral: true }).catch(() => null);

    try {
      // Validation
      if (!interaction.inGuild() || !channel?.isThread?.()) {
        await this.editReplyError(interaction, ERROR_MESSAGES.NOT_IN_THREAD);
        return;
      }

      if (interaction.channelId !== threadId) {
        await this.editReplyError(interaction, ERROR_MESSAGES.INVALID_STATE);
        return;
      }

      if (!isTicketStaffFromInteraction(interaction)) {
        await this.editReplyError(interaction, ERROR_MESSAGES.NOT_STAFF);
        return;
      }

      // Get selected user
      const addUserId = validateUserIdFromFields(interaction.fields, CUSTOM_IDS.addUserSelect);
      if (!addUserId) {
        await this.editReplyError(interaction, ERROR_MESSAGES.NO_USER_SELECTED);
        return;
      }

      if (!isValidDiscordId(addUserId)) {
        await this.editReplyError(interaction, ERROR_MESSAGES.NO_USER_SELECTED);
        return;
      }

      // Fetch member
      const member = await guild.members.fetch(addUserId).catch(() => null);
      if (!member) {
        await this.editReplyError(interaction, ERROR_MESSAGES.NOT_FOUND);
        return;
      }

      // Add to thread
      await channel.members.add(addUserId).catch(() => null);

      // Record action
      try {
        await this.ticketRepo.recordUserAction({
          threadId: channel.id,
          actionType: 'user_added',
          targetUserId: addUserId,
          performedBy: user.id
        });
      } catch (error) {
        logger.warn('Failed to record user action', { error: error.message });
      }

      await this.editReplySuccess(interaction, `Added <@${addUserId}>`);

      logger.info('User added to ticket', { threadId, addedUserId: addUserId, staffId: user.id });
    } catch (error) {
      logger.error('Add user modal submission failed', { error: error.message });
      await this.editReplyError(interaction, 'An error occurred while adding the user.');
    }
  }

  /**
   * Handles the remove user modal submission
   */
  async handleRemoveUserModalSubmit(interaction, threadId) {
    const { channel, user, guild } = interaction;

    logger.debug('Remove user modal submitted', { threadId, staffId: user.id });

    // Defer reply
    await interaction.deferReply({ ephemeral: true }).catch(() => null);

    try {
      // Validation
      if (!interaction.inGuild() || !channel?.isThread?.()) {
        await this.editReplyError(interaction, ERROR_MESSAGES.NOT_IN_THREAD);
        return;
      }

      if (interaction.channelId !== threadId) {
        await this.editReplyError(interaction, ERROR_MESSAGES.INVALID_STATE);
        return;
      }

      if (!isTicketStaffFromInteraction(interaction)) {
        await this.editReplyError(interaction, ERROR_MESSAGES.NOT_STAFF);
        return;
      }

      // Get selected user
      const removeUserId = validateUserIdFromFields(interaction.fields, CUSTOM_IDS.removeUserSelect);
      if (!removeUserId) {
        await this.editReplyError(interaction, ERROR_MESSAGES.NO_USER_SELECTED);
        return;
      }

      if (!isValidDiscordId(removeUserId)) {
        await this.editReplyError(interaction, ERROR_MESSAGES.NO_USER_SELECTED);
        return;
      }

      // Check if user is staff
      const member = await guild.members.fetch(removeUserId).catch(() => null);
      if (member && isTicketStaffLike(member, guild, removeUserId)) {
        await this.editReplyError(
          interaction,
          ERROR_MESSAGES.CANNOT_REMOVE_STAFF(removeUserId)
        );
        return;
      }

      // Remove from thread
      await channel.members.remove(removeUserId).catch(() => null);

      // Record action
      try {
        await this.ticketRepo.recordUserAction({
          threadId: channel.id,
          actionType: 'user_removed',
          targetUserId: removeUserId,
          performedBy: user.id
        });
      } catch (error) {
        logger.warn('Failed to record user action', { error: error.message });
      }

      await this.editReplySuccess(interaction, `Removed <@${removeUserId}>`);

      logger.info('User removed from ticket', { threadId, removedUserId: removeUserId, staffId: user.id });
    } catch (error) {
      logger.error('Remove user modal submission failed', { error: error.message });
      await this.editReplyError(interaction, 'An error occurred while removing the user.');
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
   * Helper: Edit reply with error
   */
  async editReplyError(interaction, message) {
    await interaction.editReply(buildErrorPayload(message)).catch(() => null);
  }

  /**
   * Helper: Edit reply with success
   */
  async editReplySuccess(interaction, message) {
    const payload = { content: `✅ ${message}`, ephemeral: true };
    await interaction.editReply(payload).catch(() => null);
  }
}

export default UserManagementHandler;
