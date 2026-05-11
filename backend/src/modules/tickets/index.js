import { SlashCommandBuilder } from 'discord.js';
import { loggingService } from './services/logging-service.js';
import { metricsService } from './services/metrics-service.js';
import { errorHandler } from './utils/error-handler.js';
import { routeInteraction, handleThreadUpdate, handleThreadMemberUpdate } from './handlers/interaction-router.js';
import { ticketCommand } from './commands/ticket-command.js';
import { 
  TICKET_COMMAND_NAMES,
  ERROR_MESSAGES
} from './utils/constants.js';
import { validateInteraction } from './utils/validators.js';

/**
 * Enterprise-grade ticket module entry point
 * Only registers commands and events, delegates all logic to interaction router
 */

// Export the main ticket command for registration
export { ticketCommand };

/**
 * Register all ticket-related commands with the Discord client
 * @param {Object} client - Discord client instance
 */
export async function registerCommands(client) {
  const context = {
    operation: 'register_commands',
    startTime: new Date().toISOString()
  };

  try {
    // Register the main ticket command
    await client.application.commands.create(ticketCommand);
    
    await loggingService.info({
      operation: 'register_commands',
      ...context,
      message: 'Successfully registered ticket commands',
      metadata: { commandCount: 1 }
    });

  } catch (error) {
    await errorHandler.handleServiceError(error, 'register_commands', 'ticket_module', context);
    throw error;
  }
}

/**
 * Register all ticket-related event handlers with the Discord client
 * @param {Object} client - Discord client instance
 */
export function registerEvents(client) {
  const context = {
    operation: 'register_events',
    startTime: new Date().toISOString()
  };

  try {
    // Register interaction handler
    client.on('interactionCreate', async (interaction) => {
      const timer = metricsService.createTimer();
      
      try {
        await routeInteraction(interaction);
        
        const duration = timer.stop();
        await metricsService.recordInteraction('interaction_create', duration, true, {
          interactionType: interaction.type,
          guildId: interaction.guildId
        });
        
      } catch (error) {
        const duration = timer.stop();
        await metricsService.recordInteraction('interaction_create', duration, false, {
          interactionType: interaction.type,
          guildId: interaction.guildId,
          error: error.message
        });
        
        await errorHandler.handleInteractionError(context, error, 'interaction_create');
      }
    });

    // Register thread update handler
    client.on('threadUpdate', async (oldThread, newThread) => {
      const timer = metricsService.createTimer();
      
      try {
        await handleThreadUpdate(oldThread, newThread);
        
        const duration = timer.stop();
        await metricsService.recordInteraction('thread_update', duration, true, {
          guildId: newThread.guildId,
          threadId: newThread.id
        });
        
      } catch (error) {
        const duration = timer.stop();
        await metricsService.recordInteraction('thread_update', duration, false, {
          guildId: newThread.guildId,
          threadId: newThread.id,
          error: error.message
        });
        
        await errorHandler.handleServiceError(error, 'thread_update', 'ticket_module', context);
      }
    });

    // Register thread member update handler
    client.on('threadMemberUpdate', async (oldMember, newMember) => {
      const timer = metricsService.createTimer();
      
      try {
        const thread = newMember.thread;
        await handleThreadMemberUpdate(thread, newMember, 'update');
        
        const duration = timer.stop();
        await metricsService.recordInteraction('thread_member_update', duration, true, {
          guildId: thread.guildId,
          threadId: thread.id,
          userId: newMember.id
        });
        
      } catch (error) {
        const duration = timer.stop();
        await metricsService.recordInteraction('thread_member_update', duration, false, {
          error: error.message
        });
        
        await errorHandler.handleServiceError(error, 'thread_member_update', 'ticket_module', context);
      }
    });

    // Register thread member add handler
    client.on('threadMemberAdd', async (threadMember) => {
      const timer = metricsService.createTimer();
      
      try {
        const thread = threadMember.thread;
        await handleThreadMemberUpdate(thread, threadMember, 'add');
        
        const duration = timer.stop();
        await metricsService.recordInteraction('thread_member_add', duration, true, {
          guildId: thread.guildId,
          threadId: thread.id,
          userId: threadMember.id
        });
        
      } catch (error) {
        const duration = timer.stop();
        await metricsService.recordInteraction('thread_member_add', duration, false, {
          error: error.message
        });
        
        await errorHandler.handleServiceError(error, 'thread_member_add', 'ticket_module', context);
      }
    });

    // Register thread member remove handler
    client.on('threadMemberRemove', async (threadMember) => {
      const timer = metricsService.createTimer();
      
      try {
        const thread = threadMember.thread;
        await handleThreadMemberUpdate(thread, threadMember, 'remove');
        
        const duration = timer.stop();
        await metricsService.recordInteraction('thread_member_remove', duration, true, {
          guildId: thread.guildId,
          threadId: thread.id,
          userId: threadMember.id
        });
        
      } catch (error) {
        const duration = timer.stop();
        await metricsService.recordInteraction('thread_member_remove', duration, false, {
          error: error.message
        });
        
        await errorHandler.handleServiceError(error, 'thread_member_remove', 'ticket_module', context);
      }
    });

    await loggingService.info({
      operation: 'register_events',
      ...context,
      message: 'Successfully registered ticket event handlers',
      metadata: { eventCount: 5 }
    });

  } catch (error) {
    await errorHandler.handleServiceError(error, 'register_events', 'ticket_module', context);
    throw error;
  }
}

/**
 * Initialize the ticket module
 * @param {Object} client - Discord client instance
 */
export async function initialize(client) {
  const context = {
    operation: 'initialize_ticket_module',
    startTime: new Date().toISOString()
  };

  try {
    // Register commands and events
    await registerCommands(client);
    registerEvents(client);

    await loggingService.info({
      operation: 'initialize_ticket_module',
      ...context,
      message: 'Ticket module initialized successfully',
      metadata: { 
        commandsRegistered: 1,
        eventsRegistered: 5
      }
    });

  } catch (error) {
    await errorHandler.handleServiceError(error, 'initialize_ticket_module', 'ticket_module', context);
    throw error;
  }
}

/**
 * Cleanup function for graceful shutdown
 * @param {Object} client - Discord client instance
 */
export async function cleanup(client) {
  const context = {
    operation: 'cleanup_ticket_module',
    startTime: new Date().toISOString()
  };

  try {
    // Remove all event listeners
    client.removeAllListeners('interactionCreate');
    client.removeAllListeners('threadUpdate');
    client.removeAllListeners('threadMemberUpdate');
    client.removeAllListeners('threadMemberAdd');
    client.removeAllListeners('threadMemberRemove');

    await loggingService.info({
      operation: 'cleanup_ticket_module',
      ...context,
      message: 'Ticket module cleaned up successfully'
    });

  } catch (error) {
    await errorHandler.handleServiceError(error, 'cleanup_ticket_module', 'ticket_module', context);
  }
}

// Legacy exports for backward compatibility
export {
  isTicketStaffFromInteraction,
  isAdminOrOwnerFromInteraction
} from './utils/permissions.js';

export {
  buildTicketPanelPayload,
  buildUserManagementPayload
} from './components/payloads.js';

export {
  buildThreadLink,
  markThreadNameOpen,
  markThreadNameClosed,
  isThreadNameClosed,
  generateThreadName
} from './utils/thread-utils.js';

// Legacy export for backward compatibility - deprecated in favor of initialize()
export default {
  name: 'tickets',
  initialize,
  registerCommands,
  registerEvents,
  cleanup
};