import logger from '../services/logging-service.js';
import {
  parseResolvedCreatorId,
  parseAddUsersThreadId,
  parseRemoveUsersThreadId,
  parseAddUsersModalThreadId,
  parseRemoveUsersModalThreadId
} from '../utils/custom-id-utils.js';
import { CUSTOM_IDS } from '../utils/constants.js';
import { getTicketTagByValue } from '../utils/validators.js';
import { CooldownError } from '../utils/error-handler.js';

export class InteractionRouter {
  constructor(
    lockService,
    ticketCreationHandler,
    ticketResolutionHandler,
    userManagementHandler
  ) {
    this.lockService = lockService;
    this.ticketCreationHandler = ticketCreationHandler;
    this.ticketResolutionHandler = ticketResolutionHandler;
    this.userManagementHandler = userManagementHandler;
  }

  async routeInteraction(interaction) {
    try {
      if (
        interaction.isStringSelectMenu() &&
        interaction.customId === CUSTOM_IDS.ticketTagSelect
      ) {
        return await this.handleTicketTagSelect(interaction);
      }

      if (interaction.isButton()) {
        return await this.handleButton(interaction);
      }

      if (interaction.isModalSubmit()) {
        return await this.handleModal(interaction);
      }

      logger.warn('Unknown interaction type', { customId: interaction.customId });
    } catch (error) {
      logger.error('Interaction router error:', { error: error.message, stack: error.stack });
      return { type: 'EDIT_REPLY', content: 'An unexpected error occurred.' };
    }
  }

  async handleTicketTagSelect(interaction) {
    logger.debug('Ticket tag selected', { userId: interaction.user.id, value: interaction.values[0] });

    const acquired = await this.lockService.acquireCreationLock(interaction.user.id);
    if (!acquired) {
      return { type: 'ASYNC_RESULT', execute: async () => ({ type: 'EDIT_REPLY', content: 'A ticket is already being created. Please wait.' }) };
    }

    return {
      type: 'ASYNC_RESULT',
      execute: async () => {
        try {
          const [selectedValue] = interaction.values;
          const tag = getTicketTagByValue(selectedValue);

          if (!tag) {
            return { type: 'EDIT_REPLY', content: 'Unknown ticket category selected.' };
          }

          return await this.ticketCreationHandler.handleTicketCreation(interaction, tag);
        } catch (error) {
          logger.error('Ticket tag selection failed', { error: error.message });
          if (error instanceof CooldownError) {
            return { type: 'EDIT_REPLY', content: error.message };
          }
          return { type: 'EDIT_REPLY', content: 'An error occurred while creating your ticket.' };
        } finally {
          await this.lockService.releaseCreationLock(interaction.user.id);
        }
      }
    };
  }

  async handleButton(interaction) {
    const { customId } = interaction;

    logger.debug('Button pressed', { buttonId: customId, userId: interaction.user.id });

    const resolvedCreatorId = parseResolvedCreatorId(customId);
    if (resolvedCreatorId) {
      return await this.ticketResolutionHandler.handleResolvedButtonPress(
        interaction,
        resolvedCreatorId
      );
    }

    const addThreadId = parseAddUsersThreadId(customId);
    if (addThreadId) {
      return await this.userManagementHandler.handleAddUserButton(interaction, addThreadId);
    }

    const removeThreadId = parseRemoveUsersThreadId(customId);
    if (removeThreadId) {
      return await this.userManagementHandler.handleRemoveUserButton(interaction, removeThreadId);
    }

    logger.warn('Unknown button interaction', { buttonId: customId });
    return { type: 'IGNORE' };
  }

  async handleModal(interaction) {
    const { customId } = interaction;

    logger.debug('Modal submitted', { modalId: customId, userId: interaction.user.id });

    const addThreadId = parseAddUsersModalThreadId(customId);
    if (addThreadId) {
      return await this.userManagementHandler.handleAddUserModalSubmit(interaction, addThreadId);
    }

    const removeThreadId = parseRemoveUsersModalThreadId(customId);
    if (removeThreadId) {
      return await this.userManagementHandler.handleRemoveUserModalSubmit(interaction, removeThreadId);
    }

    logger.warn('Unknown modal interaction', { modalId: customId });
    return { type: 'IGNORE' };
  }
}

export default InteractionRouter;
