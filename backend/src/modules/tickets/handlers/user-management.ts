import type { InteractionResult } from '../../../types/index.js';
import logger from '../services/logging-service.js';
import { buildAddUserModalWithSelect, buildRemoveUserModalWithSelect } from '../components/modals.js';
import { isTicketStaffFromInteraction } from '../utils/permissions.js';
import { validateUserIdFromModal, isValidDiscordId } from '../utils/validators.js';
import { isTicketStaffLike } from '../utils/permissions.js';
import { CUSTOM_IDS, ERROR_MESSAGES } from '../utils/constants.js';
import type TicketRepository from '../repositories/ticket-repository.js';
import type DiscordRestService from '../services/discord-rest-service.js';

export class UserManagementHandler {
  private ticketRepo: TicketRepository;
  private discordRest: DiscordRestService;

  constructor(ticketRepository: TicketRepository, discordRestService: DiscordRestService) {
    this.ticketRepo = ticketRepository;
    this.discordRest = discordRestService;
  }

  async handleAddUserButton(interaction: any, threadId: string): Promise<InteractionResult> {
    const { channel, user } = interaction;

    logger.debug('Add user button pressed', { threadId, userId: user.id });

    if (!interaction.inGuild() || !channel?.isThread?.()) {
      return { type: 'REPLY', message: '❌ ' + ERROR_MESSAGES.NOT_IN_THREAD, ephemeral: true };
    }

    if (!isTicketStaffFromInteraction(interaction)) {
      return { type: 'REPLY', message: '❌ ' + ERROR_MESSAGES.NOT_STAFF, ephemeral: true };
    }

    if (interaction.channelId !== threadId) {
      return { type: 'REPLY', message: '❌ ' + ERROR_MESSAGES.INVALID_THREAD, ephemeral: true };
    }

    try {
      const modal = buildAddUserModalWithSelect(threadId);
      return { type: 'MODAL', modal } as any;
    } catch (error) {
      logger.error('Failed to show add user modal', { error: (error as Error).message });
      return { type: 'REPLY', message: '❌ Failed to open add-user modal.', ephemeral: true };
    }
  }

  async handleRemoveUserButton(interaction: any, threadId: string): Promise<InteractionResult> {
    const { channel, user } = interaction;

    logger.debug('Remove user button pressed', { threadId, userId: user.id });

    if (!interaction.inGuild() || !channel?.isThread?.()) {
      return { type: 'REPLY', message: '❌ ' + ERROR_MESSAGES.NOT_IN_THREAD, ephemeral: true };
    }

    if (!isTicketStaffFromInteraction(interaction)) {
      return { type: 'REPLY', message: '❌ ' + ERROR_MESSAGES.NOT_STAFF, ephemeral: true };
    }

    if (interaction.channelId !== threadId) {
      return { type: 'REPLY', message: '❌ ' + ERROR_MESSAGES.INVALID_THREAD, ephemeral: true };
    }

    try {
      const modal = buildRemoveUserModalWithSelect(threadId);
      return { type: 'MODAL', modal } as any;
    } catch (error) {
      logger.error('Failed to show remove user modal', { error: (error as Error).message });
      return { type: 'REPLY', message: '❌ Failed to open remove-user modal.', ephemeral: true };
    }
  }

  async handleAddUserModalSubmit(interaction: any, threadId: string): Promise<InteractionResult> {
    return {
      type: 'ASYNC_RESULT',
      execute: async () => {
        const { channel, user, guild } = interaction;

        logger.debug('Add user modal submitted', { threadId, staffId: user.id });

        try {
          if (!interaction.inGuild() || !channel?.isThread?.()) {
            return { type: 'EDIT_REPLY', content: '❌ ' + ERROR_MESSAGES.NOT_IN_THREAD };
          }

          if (interaction.channelId !== threadId) {
            return { type: 'EDIT_REPLY', content: '❌ ' + ERROR_MESSAGES.INVALID_STATE };
          }

          if (!isTicketStaffFromInteraction(interaction)) {
            return { type: 'EDIT_REPLY', content: '❌ ' + ERROR_MESSAGES.NOT_STAFF };
          }

          const addUserId = validateUserIdFromModal(interaction, CUSTOM_IDS.addUserSelect);
          if (!addUserId || !isValidDiscordId(addUserId)) {
            return { type: 'EDIT_REPLY', content: '❌ ' + ERROR_MESSAGES.NO_USER_SELECTED };
          }

          const member = await guild.members.fetch(addUserId).catch(() => null);
          if (!member) {
            return { type: 'EDIT_REPLY', content: '❌ ' + ERROR_MESSAGES.NOT_FOUND };
          }

          await channel.members.add(addUserId).catch(() => null);

          try {
            await this.ticketRepo.recordUserAction({
              threadId: channel.id,
              actionType: 'user_added',
              targetUserId: addUserId,
              performedBy: user.id
            });
          } catch (error) {
            logger.warn('Failed to record user action', { error: (error as Error).message });
          }

          logger.info('User added to ticket', { threadId, addedUserId: addUserId, staffId: user.id });
          return { type: 'EDIT_REPLY', content: '✅ Added <@' + addUserId + '>' };
        } catch (error) {
          logger.error('Add user modal submission failed', { error: (error as Error).message });
          return { type: 'EDIT_REPLY', content: '❌ An error occurred while adding the user.' };
        }
      }
    };
  }

  async handleRemoveUserModalSubmit(interaction: any, threadId: string): Promise<InteractionResult> {
    return {
      type: 'ASYNC_RESULT',
      execute: async () => {
        const { channel, user, guild } = interaction;

        logger.debug('Remove user modal submitted', { threadId, staffId: user.id });

        try {
          if (!interaction.inGuild() || !channel?.isThread?.()) {
            return { type: 'EDIT_REPLY', content: '❌ ' + ERROR_MESSAGES.NOT_IN_THREAD };
          }

          if (interaction.channelId !== threadId) {
            return { type: 'EDIT_REPLY', content: '❌ ' + ERROR_MESSAGES.INVALID_STATE };
          }

          if (!isTicketStaffFromInteraction(interaction)) {
            return { type: 'EDIT_REPLY', content: '❌ ' + ERROR_MESSAGES.NOT_STAFF };
          }

          const removeUserId = validateUserIdFromModal(interaction, CUSTOM_IDS.removeUserSelect);
          if (!removeUserId || !isValidDiscordId(removeUserId)) {
            return { type: 'EDIT_REPLY', content: '❌ ' + ERROR_MESSAGES.NO_USER_SELECTED };
          }

          const member = await guild.members.fetch(removeUserId).catch(() => null);
          if (member && isTicketStaffLike(member, guild, removeUserId)) {
            return { type: 'EDIT_REPLY', content: '❌ ' + ERROR_MESSAGES.CANNOT_REMOVE_STAFF(removeUserId) };
          }

          await channel.members.remove(removeUserId).catch(() => null);

          try {
            await this.ticketRepo.recordUserAction({
              threadId: channel.id,
              actionType: 'user_removed',
              targetUserId: removeUserId,
              performedBy: user.id
            });
          } catch (error) {
            logger.warn('Failed to record user action', { error: (error as Error).message });
          }

          logger.info('User removed from ticket', { threadId, removedUserId: removeUserId, staffId: user.id });
          return { type: 'EDIT_REPLY', content: '✅ Removed <@' + removeUserId + '>' };
        } catch (error) {
          logger.error('Remove user modal submission failed', { error: (error as Error).message });
          return { type: 'EDIT_REPLY', content: '❌ An error occurred while removing the user.' };
        }
      }
    };
  }
}

export default UserManagementHandler;
