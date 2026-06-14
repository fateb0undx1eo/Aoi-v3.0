import logger from '../services/logging-service.js';
import { buildTicketPanelPayload, buildUserManagementPayload } from '../components/payloads.js';
import { requireAdminOrOwner, isTicketStaffFromInteraction } from '../utils/permissions.js';

async function replyOrEdit(interaction: any, content: string, ephemeral = true): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(content);
    return;
  }

  await interaction.reply({ content, ephemeral });
}

export class TicketCommandHandler {
  async handleTicketCommand(interaction: any): Promise<void> {
    const { options } = interaction;

    logger.info('=== TICKET COMMAND STARTED ===', {
      userId: interaction.user.id,
      guildId: interaction.guildId
    });

    const isStaff = isTicketStaffFromInteraction(interaction);

    logger.info('Staff permission check', {
      isStaff,
      userId: interaction.user.id,
      inGuild: interaction.inGuild(),
      memberPerms: interaction.member?.permissions?.bitfield
    });

    if (!isStaff) {
      logger.warn('User denied ticket access - not staff', {
        userId: interaction.user.id
      });

      await replyOrEdit(interaction, 'You are not allowed to use ticket commands.');
      return;
    }

    let group: string | null = null;
    let subcommand: string | null = null;

    try {
      group = options.getSubcommandGroup(false);
      subcommand = options.getSubcommand(false);

      logger.debug('Subcommand parsed', { group, subcommand });
    } catch (e) {
      logger.debug('Failed to parse subcommand', { error: (e as Error).message });
    }

    if (subcommand === 'panel') {
      logger.info('PANEL subcommand triggered');
      return await this.handlePanelCommand(interaction);
    }

    if (group === 'manage' && subcommand === 'users') {
      logger.info('MANAGE USERS subcommand triggered');
      return await this.handleManageUsersCommand(interaction);
    }

    logger.warn('Unknown subcommand', { group, subcommand });

    await replyOrEdit(interaction, 'Use `/ticket panel` or `/ticket manage users`.');
  }

  async handlePanelCommand(interaction: any): Promise<void> {
    logger.info('Panel command executed', {
      guildId: interaction.guildId,
      userId: interaction.user.id
    });

    if (!(await requireAdminOrOwner(interaction))) {
      return;
    }

    try {
      const payload = buildTicketPanelPayload();

      await interaction.channel.send(payload).catch(() => null);

      await replyOrEdit(interaction, 'Ticket panel sent in this channel.');
    } catch (error) {
      logger.error('Failed to send ticket panel', { error: (error as Error).message });

      await replyOrEdit(interaction, 'Failed to send ticket panel.');
    }
  }

  async handleManageUsersCommand(interaction: any): Promise<void> {
    logger.info('Manage users command executed', {
      threadId: interaction.channelId,
      userId: interaction.user.id
    });

    try {
      if (!interaction.channel?.isThread?.()) {
        await replyOrEdit(interaction, 'Run this command inside a ticket thread.');
        return;
      }

      const threadId = interaction.channelId;
      const payload = buildUserManagementPayload(threadId);

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
      } else {
        await interaction.reply({ ...payload, ephemeral: true });
      }
    } catch (error) {
      logger.error('Failed to handle manage users command', { error: (error as Error).message });

      await replyOrEdit(interaction, 'An error occurred while processing the command.');
    }
  }
}

export default TicketCommandHandler;
