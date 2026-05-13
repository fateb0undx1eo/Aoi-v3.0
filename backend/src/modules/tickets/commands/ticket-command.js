/**
 * Ticket slash commands (/ticket panel, /ticket manage users)
 */

import logger from '../services/logging-service.js';
import { buildTicketPanelPayload, buildUserManagementPayload } from '../components/payloads.js';
import { isAdminOrOwnerFromInteraction, requireAdminOrOwner, isTicketStaffFromInteraction } from '../utils/permissions.js';

async function replyOrEdit(interaction, content, ephemeral = true) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(content);
    return;
  }

  await interaction.reply({ content, ephemeral });
}

export class TicketCommandHandler {
  constructor() {}

  /**
   * Handles the main /ticket command
   */
  async handleTicketCommand(interaction) {
    const { options, channel } = interaction;

    logger.info('=== TICKET COMMAND STARTED ===', {
      userId: interaction.user.id,
      guildId: interaction.guildId
    });

    // Check if user is ticket staff
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

      await replyOrEdit(
        interaction,
        'You are not allowed to use ticket commands.'
      );

      return;
    }

    // Get subcommand
    let group = null;
    let subcommand = null;

    try {
      group = options.getSubcommandGroup(false);
      subcommand = options.getSubcommand(false);

      logger.debug('Subcommand parsed', {
        group,
        subcommand
      });
    } catch (e) {
      logger.debug('Failed to parse subcommand', {
        error: e.message
      });
    }

    // /ticket panel
    if (subcommand === 'panel') {
      logger.info('PANEL subcommand triggered');

      return await this.handlePanelCommand(interaction);
    }

    // /ticket manage users
    if (group === 'manage' && subcommand === 'users') {
      logger.info('MANAGE USERS subcommand triggered');

      return await this.handleManageUsersCommand(interaction);
    }

    // Unknown subcommand
    logger.warn('Unknown subcommand', {
      group,
      subcommand
    });

    await replyOrEdit(
      interaction,
      'Use `/ticket panel` or `/ticket manage users`.'
    );
  }

  /**
   * Handles the /ticket panel command
   */
  async handlePanelCommand(interaction) {
    logger.info('Panel command executed', {
      guildId: interaction.guildId,
      userId: interaction.user.id
    });

    // Check for admin/owner only
    if (!(await requireAdminOrOwner(interaction))) {
      return;
    }

    try {
      // Send the ticket panel
      const payload = buildTicketPanelPayload();

      await interaction.channel.send(payload).catch(() => null);

      await replyOrEdit(
        interaction,
        'Ticket panel sent in this channel.'
      );
    } catch (error) {
      logger.error('Failed to send ticket panel', {
        error: error.message
      });

      await replyOrEdit(
        interaction,
        'Failed to send ticket panel.'
      );
    }
  }

  /**
   * Handles the /ticket manage users command
   */
  async handleManageUsersCommand(interaction) {
    logger.info('Manage users command executed', {
      threadId: interaction.channelId,
      userId: interaction.user.id
    });

    try {
      // Check if in thread
      if (!interaction.channel?.isThread?.()) {
        await replyOrEdit(
          interaction,
          'Run this command inside a ticket thread.'
        );

        return;
      }

      const threadId = interaction.channelId;
      const payload = buildUserManagementPayload(threadId);

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
      } else {
        await interaction.reply({
          ...payload,
          ephemeral: true
        });
      }
    } catch (error) {
      logger.error('Failed to handle manage users command', {
        error: error.message
      });

      await replyOrEdit(
        interaction,
        'An error occurred while processing the command.'
      );
    }
  }
}

export default TicketCommandHandler;