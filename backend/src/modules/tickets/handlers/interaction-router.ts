import type { InteractionResult } from '../../../types/index.js';
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
import type LockService from '../services/lock-service.js';
import type TicketCreationHandler from './ticket-creation.js';
import type TicketResolutionHandler from './ticket-resolution.js';
import type UserManagementHandler from './user-management.js';

export class InteractionRouter {
  private lockService: LockService;
  private ticketCreationHandler: TicketCreationHandler;
  private ticketResolutionHandler: TicketResolutionHandler;
  private userManagementHandler: UserManagementHandler;

  constructor(
    lockService: LockService,
    ticketCreationHandler: TicketCreationHandler,
    ticketResolutionHandler: TicketResolutionHandler,
    userManagementHandler: UserManagementHandler
  ) {
    this.lockService = lockService;
    this.ticketCreationHandler = ticketCreationHandler;
    this.ticketResolutionHandler = ticketResolutionHandler;
    this.userManagementHandler = userManagementHandler;
  }

  async routeInteraction(interaction: any): Promise<InteractionResult | undefined> {
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
      logger.error('Interaction router error:', { error: (error as Error).message, stack: (error as Error).stack });
      return { type: 'EDIT_REPLY', content: 'An unexpected error occurred.' };
    }
  }

  async handleTicketTagSelect(interaction: any): Promise<InteractionResult> {
    logger.debug('Ticket tag selected', { userId: interaction.user.id, values: interaction.values?.[0] });

    const acquired = await this.lockService.acquireCreationLock(interaction.user.id);
    if (!acquired) {
      return { type: 'ASYNC_RESULT', execute: async () => ({ type: 'EDIT_REPLY', content: 'A ticket is already being created. Please wait.' }) };
    }

    return {
      type: 'ASYNC_RESULT',
      execute: async () => {
        try {
          const selectedValue = (interaction.values as string[])[0]!;
          const tag = getTicketTagByValue(selectedValue);

          if (!tag) {
            return { type: 'EDIT_REPLY', content: 'Unknown ticket category selected.' };
          }

          return await this.ticketCreationHandler.handleTicketCreation(interaction, tag);
        } catch (error) {
          logger.error('Ticket tag selection failed', { error: (error as Error).message });
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

  async handleButton(interaction: any): Promise<InteractionResult> {
    const { customId } = interaction;

    logger.debug('Button pressed', { buttonId: customId, userId: interaction.user.id });

    const resolvedCreatorId = parseResolvedCreatorId(customId);
    if (resolvedCreatorId) {
      return await this.ticketResolutionHandler.handleResolvedButtonPress(interaction, resolvedCreatorId);
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

  async handleModal(interaction: any): Promise<InteractionResult> {
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
