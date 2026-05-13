/**
 * Interaction router - routes all Discord interactions to appropriate handlers
 */

import logger from '../services/logging-service.js';
import {
  parseResolvedCreatorId,
  parseResolveConfirmCreatorId,
  parseResolveCancelCreatorId,
  parseAddUsersThreadId,
  parseRemoveUsersThreadId,
  parseAddUsersModalThreadId,
  parseRemoveUsersModalThreadId
} from '../utils/custom-id-utils.js';
import { CUSTOM_IDS, ERROR_MESSAGES } from '../utils/constants.js';
import { getTicketTagByValue } from '../utils/validators.js';
import { handleError, CooldownError } from '../utils/error-handler.js';

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

  /**
   * Routes all interactions
   */
  async routeInteraction(interaction) {
    try {
      console.log('=== INTERACTION ROUTER DEBUG ===');
      console.log('Interaction type:', interaction.type);
      console.log('Custom ID:', interaction.customId);
      console.log('Is StringSelect:', interaction.isStringSelectMenu());
      console.log('Expected Custom ID:', CUSTOM_IDS.ticketTagSelect);
      
      // String select (ticket tag selection)
      if (
        interaction.isStringSelectMenu() &&
        interaction.customId === CUSTOM_IDS.ticketTagSelect
      ) {
        console.log('Routing to handleTicketTagSelect');
        return await this.handleTicketTagSelect(interaction);
      }

      // Buttons
      if (interaction.isButton()) {
        return await this.handleButton(interaction);
      }

      // Modals
      if (interaction.isModalSubmit()) {
        return await this.handleModal(interaction);
      }

      logger.warn('Unknown interaction type', { customId: interaction.customId });
    } catch (error) {
      await handleError(error, interaction, { routerError: true });
    }
  }

  /**
   * Handles ticket tag selection
   */
  async handleTicketTagSelect(interaction) {
    logger.debug('Ticket tag selected', { userId: interaction.user.id, value: interaction.values[0] });

    // Defer immediately to prevent 3-second timeout
    await interaction.deferReply({ ephemeral: true });

    // Check for creation lock
    const hasLock = await this.lockService.hasCreationLock(interaction.user.id);
    if (hasLock) {
      await interaction.editReply({
        content: ERROR_MESSAGES.LOCKED_IN_CREATION
      });
      return;
    }

    // Acquire lock
    await this.lockService.acquireCreationLock(interaction.user.id);

    try {
      const [selectedValue] = interaction.values;
      const tag = getTicketTagByValue(selectedValue);

      if (!tag) {
        await interaction.editReply({ content: 'Unknown ticket category selected.' });
        return;
      }

      // Delegate to creation handler
      await this.ticketCreationHandler.handleTicketCreation(interaction, tag);
    } catch (error) {
      logger.error('Ticket tag selection failed', { error: error.message });
      if (error instanceof CooldownError) {
        await interaction.editReply({ content: error.message });
      } else {
        await interaction.editReply({
          content: 'An error occurred while creating your ticket.'
        });
      }
    } finally {
      // Release lock
      await this.lockService.releaseCreationLock(interaction.user.id);
    }
  }

  /**
   * Routes button interactions
   */
  async handleButton(interaction) {
    const { customId } = interaction;

    logger.debug('Button pressed', { buttonId: customId, userId: interaction.user.id });

    // Resolved button
    const resolvedCreatorId = parseResolvedCreatorId(customId);
    if (resolvedCreatorId) {
      return await this.ticketResolutionHandler.handleResolvedButtonPress(
        interaction,
        resolvedCreatorId
      );
    }

    // Resolve confirm button
    const confirmCreatorId = parseResolveConfirmCreatorId(customId);
    if (confirmCreatorId) {
      return await this.ticketResolutionHandler.handleResolveConfirm(interaction, confirmCreatorId);
    }

    // Resolve cancel button
    const cancelCreatorId = parseResolveCancelCreatorId(customId);
    if (cancelCreatorId) {
      return await this.ticketResolutionHandler.handleResolveCancel(interaction);
    }

    // Add users button
    const addThreadId = parseAddUsersThreadId(customId);
    if (addThreadId) {
      return await this.userManagementHandler.handleAddUserButton(interaction, addThreadId);
    }

    // Remove users button
    const removeThreadId = parseRemoveUsersThreadId(customId);
    if (removeThreadId) {
      return await this.userManagementHandler.handleRemoveUserButton(interaction, removeThreadId);
    }

    logger.warn('Unknown button interaction', { buttonId: customId });
  }

  /**
   * Routes modal interactions
   */
  async handleModal(interaction) {
    const { customId } = interaction;

    logger.debug('Modal submitted', { modalId: customId, userId: interaction.user.id });

    // Add users modal
    const addThreadId = parseAddUsersModalThreadId(customId);
    if (addThreadId) {
      return await this.userManagementHandler.handleAddUserModalSubmit(interaction, addThreadId);
    }

    // Remove users modal
    const removeThreadId = parseRemoveUsersModalThreadId(customId);
    if (removeThreadId) {
      return await this.userManagementHandler.handleRemoveUserModalSubmit(interaction, removeThreadId);
    }

    logger.warn('Unknown modal interaction', { modalId: customId });
  }
}

export default InteractionRouter;
