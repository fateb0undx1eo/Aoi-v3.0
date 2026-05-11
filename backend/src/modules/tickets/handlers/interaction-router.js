import { 
  handleAddUsersButton, 
  handleRemoveUsersButton,
  handleAddUsersModalSubmit,
  handleRemoveUsersModalSubmit 
} from './user-management.js';
import { 
  handleResolvedButton, 
  handleResolvedConfirmYes, 
  handleResolvedConfirmNo,
  handleResolvedModalSubmit 
} from './ticket-resolution.js';
import { createTicketFromTag } from './ticket-creation.js';
import { 
  parseAddUsersModalThreadId,
  parseRemoveUsersModalThreadId,
  parseTicketTagFromCustomId,
  parseResolvedConfirmThreadId
} from '../utils/custom-id-utils.js';
import { loggingService } from '../services/logging-service.js';
import { errorHandler } from '../utils/error-handler.js';
import { validateInteraction } from '../utils/validators.js';

/**
 * Enterprise-grade interaction router for ticket system
 * Routes all Discord interactions to appropriate handlers
 */

/**
 * Handle command interactions
 * @param {Object} interaction - Discord command interaction
 */
export async function handleCommand(interaction) {
  const context = await loggingService.logInteractionStart(interaction, 'command');
  
  try {
    // Validate interaction
    const validation = validateInteraction(interaction);
    if (!validation.isValid) {
      throw new Error(`Invalid interaction: ${validation.errors.join(', ')}`);
    }

    const { commandName } = interaction;

    switch (commandName) {
      default:
        await interaction.reply({
          content: 'Unknown command.',
          ephemeral: true
        });
        break;
    }

    await loggingService.logInteractionComplete(context, 'command', { 
      success: true,
      commandName 
    });

  } catch (error) {
    await errorHandler.handleInteractionError(context, error, 'command');
  }
}

/**
 * Handle button interactions
 * @param {Object} interaction - Discord button interaction
 */
export async function handleButton(interaction) {
  const context = await loggingService.logInteractionStart(interaction, 'button');
  
  try {
    // Validate interaction
    const validation = validateInteraction(interaction);
    if (!validation.isValid) {
      throw new Error(`Invalid interaction: ${validation.errors.join(', ')}`);
    }

    const { customId } = interaction;

    // Route button interactions based on custom ID pattern
    if (customId.startsWith('add_users:')) {
      const threadId = customId.split(':')[1];
      await handleAddUsersButton(interaction, threadId);
    } else if (customId.startsWith('remove_users:')) {
      const threadId = customId.split(':')[1];
      await handleRemoveUsersButton(interaction, threadId);
    } else if (customId.startsWith('resolved:')) {
      const creatorId = customId.split(':')[1];
      await handleResolvedButton(interaction, creatorId);
    } else if (customId.startsWith('resolved_confirm_yes:')) {
      const creatorId = customId.split(':')[1];
      await handleResolvedConfirmYes(interaction, creatorId);
    } else if (customId.startsWith('resolved_confirm_no:')) {
      const creatorId = customId.split(':')[1];
      await handleResolvedConfirmNo(interaction, creatorId);
    } else if (customId.startsWith('ticket_tag:')) {
      const tag = parseTicketTagFromCustomId(customId);
      await createTicketFromTag(interaction, tag);
    } else {
      await interaction.reply({
        content: 'Unknown button interaction.',
        ephemeral: true
      });
    }

    await loggingService.logInteractionComplete(context, 'button', { 
      success: true,
      customId 
    });

  } catch (error) {
    await errorHandler.handleInteractionError(context, error, 'button');
  }
}

/**
 * Handle select menu interactions
 * @param {Object} interaction - Discord select menu interaction
 */
export async function handleSelectMenu(interaction) {
  const context = await loggingService.logInteractionStart(interaction, 'select_menu');
  
  try {
    // Validate interaction
    const validation = validateInteraction(interaction);
    if (!validation.isValid) {
      throw new Error(`Invalid interaction: ${validation.errors.join(', ')}`);
    }

    const { customId } = interaction;

    // Route select menu interactions
    switch (customId) {
      default:
        await interaction.reply({
          content: 'Unknown select menu interaction.',
          ephemeral: true
        });
        break;
    }

    await loggingService.logInteractionComplete(context, 'select_menu', { 
      success: true,
      customId 
    });

  } catch (error) {
    await errorHandler.handleInteractionError(context, error, 'select_menu');
  }
}

/**
 * Handle modal submit interactions
 * @param {Object} interaction - Discord modal submit interaction
 */
export async function handleModalSubmit(interaction) {
  const context = await loggingService.logInteractionStart(interaction, 'modal_submit');
  
  try {
    // Validate interaction
    const validation = validateInteraction(interaction);
    if (!validation.isValid) {
      throw new Error(`Invalid interaction: ${validation.errors.join(', ')}`);
    }

    const { customId } = interaction;

    // Route modal submit interactions based on custom ID pattern
    if (customId.startsWith('add_users_modal:')) {
      const threadId = parseAddUsersModalThreadId(customId);
      await handleAddUsersModalSubmit(interaction, threadId);
    } else if (customId.startsWith('remove_users_modal:')) {
      const threadId = parseRemoveUsersModalThreadId(customId);
      await handleRemoveUsersModalSubmit(interaction, threadId);
    } else if (customId.startsWith('resolved_confirm:')) {
      const threadId = parseResolvedConfirmThreadId(customId);
      await handleResolvedModalSubmit(interaction, threadId);
    } else {
      await interaction.reply({
        content: 'Unknown modal interaction.',
        ephemeral: true
      });
    }

    await loggingService.logInteractionComplete(context, 'modal_submit', { 
      success: true,
      customId 
    });

  } catch (error) {
    await errorHandler.handleInteractionError(context, error, 'modal_submit');
  }
}

/**
 * Handle autocomplete interactions
 * @param {Object} interaction - Discord autocomplete interaction
 */
export async function handleAutocomplete(interaction) {
  const context = await loggingService.logInteractionStart(interaction, 'autocomplete');
  
  try {
    // Validate interaction
    const validation = validateInteraction(interaction);
    if (!validation.isValid) {
      throw new Error(`Invalid interaction: ${validation.errors.join(', ')}`);
    }

    const { commandName } = interaction;

    // Route autocomplete interactions
    switch (commandName) {
      default:
        await interaction.respond([]);
        break;
    }

    await loggingService.logInteractionComplete(context, 'autocomplete', { 
      success: true,
      commandName 
    });

  } catch (error) {
    await errorHandler.handleInteractionError(context, error, 'autocomplete');
  }
}

/**
 * Main interaction router - routes any interaction to appropriate handler
 * @param {Object} interaction - Discord interaction
 */
export async function routeInteraction(interaction) {
  const context = await loggingService.logInteractionStart(interaction, 'route_interaction');
  
  try {
    // Route based on interaction type
    switch (interaction.type) {
      case 1: // ApplicationCommand
        await handleCommand(interaction);
        break;
      case 2: // MessageComponent
        if (interaction.isButton()) {
          await handleButton(interaction);
        } else if (interaction.isStringSelectMenu()) {
          await handleSelectMenu(interaction);
        }
        break;
      case 5: // ModalSubmit
        await handleModalSubmit(interaction);
        break;
      case 4: // ApplicationCommandAutocomplete
        await handleAutocomplete(interaction);
        break;
      default:
        await loggingService.warn({
          operation: 'route_interaction',
          ...context,
          message: 'Unknown interaction type',
          metadata: { interactionType: interaction.type }
        });
        break;
    }

    await loggingService.logInteractionComplete(context, 'route_interaction', { 
      success: true,
      interactionType: interaction.type 
    });

  } catch (error) {
    await errorHandler.handleInteractionError(context, error, 'route_interaction');
  }
}

/**
 * Handle thread updates (for ticket state changes)
 * @param {Object} oldThread - Previous thread state
 * @param {Object} newThread - New thread state
 */
export async function handleThreadUpdate(oldThread, newThread) {
  const context = {
    guildId: newThread.guildId,
    threadId: newThread.id,
    operation: 'thread_update'
  };

  try {
    // Check if thread name changed (could indicate ticket resolution)
    if (oldThread.name !== newThread.name) {
      await loggingService.info({
        operation: 'thread_name_update',
        ...context,
        message: 'Thread name changed',
        metadata: {
          oldName: oldThread.name,
          newName: newThread.name
        }
      });
    }

    // Check if thread was archived
    if (!oldThread.archived && newThread.archived) {
      await loggingService.info({
        operation: 'thread_archived',
        ...context,
        message: 'Thread was archived',
        metadata: {
          archivedBy: newThread.ownerId
        }
      });
    }

    // Check if thread was locked
    if (!oldThread.locked && newThread.locked) {
      await loggingService.info({
        operation: 'thread_locked',
        ...context,
        message: 'Thread was locked',
        metadata: {
          lockedBy: newThread.ownerId
        }
      });
    }

  } catch (error) {
    await errorHandler.handleServiceError(error, 'thread_update', 'interaction_router', context);
  }
}

/**
 * Handle thread member updates (for user management tracking)
 * @param {Object} thread - Thread object
 * @param {Object} member - Member object
 * @param {string} action - Action type ('add' or 'remove')
 */
export async function handleThreadMemberUpdate(thread, member, action) {
  const context = {
    guildId: thread.guildId,
    threadId: thread.id,
    userId: member.id,
    operation: 'thread_member_update'
  };

  try {
    await loggingService.info({
      operation: 'thread_member_update',
      ...context,
      message: `Member ${action}ed from thread`,
      metadata: {
        action,
        memberId: member.id,
        memberTag: member.user?.tag
      }
    });

  } catch (error) {
    await errorHandler.handleServiceError(error, 'thread_member_update', 'interaction_router', context);
  }
}
