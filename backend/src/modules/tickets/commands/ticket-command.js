import { ticketRepository } from '../repositories/ticket-repository.js';
import { loggingService } from '../services/logging-service.js';
import { metricsService } from '../services/metrics-service.js';
import { errorHandler } from '../utils/error-handler.js';
import { 
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  COMPONENT_TYPES
} from '../utils/constants.js';
import { isTicketStaffFromInteraction, isAdminOrOwnerFromInteraction } from '../utils/permissions.js';
import { buildTicketPanelPayload } from '../components/payloads.js';
import { buildUserManagementPayload } from '../components/payloads.js';
import { validateInteraction, validateThreadState } from '../utils/validators.js';

/**
 * Enterprise-grade ticket command execution
 * Uses repository pattern and structured logging
 */

/**
 * Execute ticket panel command
 */
export async function executeTicketPanelCommand(interaction) {
  const context = await loggingService.logInteractionStart(interaction, 'ticket_panel_command');
  const timer = metricsService.createTimer();

  try {
    // Validate inputs
    const validation = validateInteraction(interaction);
    if (!validation.isValid) {
      throw new Error(`Invalid interaction: ${validation.errors.join(', ')}`);
    }

    if (!(await isTicketStaffFromInteraction(interaction))) {
      return;
    }

    let group = null;
    let subcommand = null;
    try { 
      group = interaction.options.getSubcommandGroup(false); 
    } catch {}
    try { 
      subcommand = interaction.options.getSubcommand(false); 
    } catch {}

    if (subcommand === 'panel') {
      if (!isAdminOrOwnerFromInteraction(interaction)) {
        await interaction.editReply(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
        return;
      }
      
      await interaction.channel.send(buildTicketPanelPayload());
      await interaction.editReply(SUCCESS_MESSAGES.PANEL_SENT);
      
      // Record success metric
      const duration = timer.stop();
      await metricsService.recordCommandExecution('ticket_panel', duration, true, {
        guildId: interaction.guildId,
        userId: interaction.user.id
      });

      await loggingService.logInteractionComplete(context, 'ticket_panel_command', { 
        success: true, 
        duration 
      });
      return;
    }

    if (group === 'user' && subcommand === 'manage') {
      const threadValidation = validateThreadState(interaction.channel);
      if (!threadValidation.isValid) {
        await interaction.editReply(ERROR_MESSAGES.NOT_TICKET_THREAD);
        return;
      }

      // Verify it's actually a ticket thread
      const ticket = await ticketRepository.findByThreadId(interaction.channelId);
      if (!ticket) {
        await interaction.editReply(ERROR_MESSAGES.INVALID_TICKET_STATE);
        return;
      }

      const threadId = interaction.channelId;
      await interaction.editReply({
        content: 'Ticket user controls:',
        components: [buildUserManagementPayload(threadId)]
      });

      // Record success metric
      const duration = timer.stop();
      await metricsService.recordCommandExecution('ticket_user_manage', duration, true, {
        guildId: interaction.guildId,
        threadId: threadId,
        userId: interaction.user.id
      });

      await loggingService.logInteractionComplete(context, 'ticket_user_manage_command', { 
        success: true, 
        duration,
        threadId 
      });
      return;
    }

    await interaction.editReply(ERROR_MESSAGES.UNKNOWN_SUBCOMMAND);

  } catch (error) {
    const duration = timer.stop();
    await metricsService.recordCommandExecution('ticket_command', duration, false, {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      error: error.message
    });

    await errorHandler.handleInteractionError(context, error, 'ticket_command');
  }
}

/**
 * Build ticket command definition
 */
export function buildTicketCommand(name, description, execute, options = []) {
  return {
    name,
    description,
    ephemeral: true,
    options,
    async execute(interaction) {
      await execute(interaction);
    }
  };
}

/**
 * Export ticket command configuration
 */
export const ticketCommand = buildTicketCommand(
  'ticket',
  'Manage the ticket system',
  executeTicketPanelCommand,
  [
    {
      name: 'panel',
      type: 1,
      description: 'Send the ticket creation panel'
    },
    {
      name: 'user',
      type: 2,
      description: 'Ticket user controls',
      options: [
        {
          name: 'manage',
          type: 1,
          description: 'Open add/remove controls for this thread'
        }
      ]
    }
  ]
);
