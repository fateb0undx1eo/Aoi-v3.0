/**
 * Interaction router - routes all Discord interactions to appropriate handlers
 */

import { MessageFlags } from 'discord.js';
import logger from '../services/logging-service.js';
import {
  parseResolvedCreatorId,
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
      // String select (ticket tag selection)
      if (
        interaction.isStringSelectMenu() &&
        interaction.customId === CUSTOM_IDS.ticketTagSelect
      ) {
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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Check for creation lock
    const hasLock = await this.lockService.hasCreationLock(interaction.user.id);
    if (hasLock) {
      await interaction.editReply({
        content: ERROR_MESSAGES.LOCKED_IN_CREATION
      });
      return;
    }

    // Acquire lock
    const acquired = await this.lockService.acquireCreationLock(interaction.user.id);
    if (!acquired) {
      await interaction.editReply({
        content: ERROR_MESSAGES.LOCKED_IN_CREATION
      });
      return;
    }

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
