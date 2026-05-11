import { ButtonStyle } from 'discord.js';
import { ticketService } from '../services/ticket-service.js';
import { 
  TICKET_COMMAND_NAMES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  COMPONENT_TYPES
} from '../utils/constants.js';
import { isTicketStaffFromInteraction, isAdminOrOwnerFromInteraction } from '../utils/permissions.js';
import { buildTicketPanelPayload } from '../components/payloads.js';
import { buildUserManagementPayload } from '../components/payloads.js';

/**
 * Execute ticket panel command
 */
export async function executeTicketPanelCommand(interaction) {
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
      await interaction.editReply('Only server owner or admins can use `/ticket panel`.');
      return;
    }
    await interaction.channel.send(buildTicketPanelPayload());
    await interaction.editReply(SUCCESS_MESSAGES.PANEL_SENT);
    return;
  }

  if (group === 'user' && subcommand === 'manage') {
    if (!interaction.channel?.isThread?.()) {
      await interaction.editReply('Run this inside a ticket thread.');
      return;
    }

    const threadId = interaction.channelId;
    await interaction.editReply({
      content: 'Ticket user controls:',
      components: [buildUserManagementPayload(threadId)]
    });
    return;
  }

  await interaction.editReply('Use `/ticket panel` or `/ticket user manage`.');
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
  'Send the ticket creation panel',
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
