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
import { buildTicketPanelPayload, buildUserManagementPayload } from '../components/payloads.js';
import { validateInteraction, validateThreadState } from '../utils/validators.js';

export async function executeTicketPanelCommand(interaction) {
  const context = await loggingService.logInteractionStart(interaction, 'ticket_panel_command');
  const timer = metricsService.createTimer();

  try {
    const validation = validateInteraction(interaction);
    if (!validation.isValid) throw new Error(`Invalid interaction: ${validation.errors.join(', ')}`);

    if (!(await isTicketStaffFromInteraction(interaction))) {
      await interaction.reply({ content: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    let group = null;
    let subcommand = null;
    try { group = interaction.options.getSubcommandGroup(false); } catch {}
    try { subcommand = interaction.options.getSubcommand(false); } catch {}

    if (subcommand === 'panel') {
      if (!isAdminOrOwnerFromInteraction(interaction)) {
        await interaction.editReply({ content: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS });
        return;
      }
      
      await interaction.channel.send(buildTicketPanelPayload());
      await interaction.editReply({ content: SUCCESS_MESSAGES.PANEL_SENT });
      
      const duration = timer.stop();
      await metricsService.recordCommandExecution('ticket_panel', duration, true, { guildId: interaction.guildId, userId: interaction.user.id });
      await loggingService.logInteractionComplete(context, 'ticket_panel_command', { success: true, duration });
      return;
    }

    if (group === 'user' && subcommand === 'manage') {
      const threadValidation = validateThreadState(interaction.channel);
      if (!threadValidation.isValid) {
        await interaction.editReply({ content: ERROR_MESSAGES.NOT_TICKET_THREAD });
        return;
      }

      const ticket = await ticketRepository.findByThreadId(interaction.channelId);
      if (!ticket) {
        await interaction.editReply({ content: ERROR_MESSAGES.INVALID_TICKET_STATE });
        return;
      }

      const threadId = interaction.channelId;
      
      // FIXED: Properly unpack the components so Discord.js doesn't crash on nested arrays
      const payload = buildUserManagementPayload(threadId);
      await interaction.editReply({
        content: 'Ticket user controls:',
        components: payload.components
      });

      const duration = timer.stop();
      await metricsService.recordCommandExecution('ticket_user_manage', duration, true, { guildId: interaction.guildId, threadId, userId: interaction.user.id });
      await loggingService.logInteractionComplete(context, 'ticket_user_manage_command', { success: true, duration, threadId });
      return;
    }

    await interaction.editReply({ content: ERROR_MESSAGES.UNKNOWN_SUBCOMMAND });

  } catch (error) {
    const duration = timer.stop();
    await metricsService.recordCommandExecution('ticket_command', duration, false, { guildId: interaction.guildId, userId: interaction.user.id, error: error.message });
    await errorHandler.handleInteractionError(context, error, 'ticket_command');
  }
}

export function buildTicketCommand(name, description, execute, options =[]) {
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

export const ticketCommand = buildTicketCommand(
  'ticket',
  'Manage the ticket system',
  executeTicketPanelCommand,[
    {
      name: 'panel',
      type: 1,
      description: 'Send the ticket creation panel'
    },
    {
      name: 'user',
      type: 2,
      description: 'Ticket user controls',
      options:[
        {
          name: 'manage',
          type: 1,
          description: 'Open add/remove controls for this thread'
        }
      ]
    }
  ]
);