import logger from '../services/logging-service.js';
import { buildTicketPanelPayload, buildUserManagementPayload, buildBlacklistListPayload } from '../components/payloads.js';
import { isTicketStaffFromInteraction } from '../utils/permissions.js';
import type BlacklistService from '../services/blacklist-service.js';

async function replyOrEdit(interaction: any, content: string, ephemeral = true): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(content);
    return;
  }

  await interaction.reply({ content, ephemeral });
}

export class TicketCommandHandler {
  private blacklistService: BlacklistService;

  constructor(blacklistService: BlacklistService) {
    this.blacklistService = blacklistService;
  }

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

    if (subcommand === 'blacklist') {
      logger.info('BLACKLIST subcommand triggered', { subcommand });
      const action = options.getString('action');
      if (action === 'add') return await this.handleBlacklistAdd(interaction);
      if (action === 'remove') return await this.handleBlacklistRemove(interaction);
      return await this.handleBlacklistList(interaction);
    }

    logger.warn('Unknown subcommand', { group, subcommand });

    await replyOrEdit(interaction, 'Use `/ticket panel`, `/ticket manage users`, or `/ticket blacklist`.');
  }

  async handlePanelCommand(interaction: any): Promise<void> {
    logger.info('Panel command executed', {
      guildId: interaction.guildId,
      userId: interaction.user.id
    });

    try {
      const payload = buildTicketPanelPayload();

      await interaction.channel.send(payload);

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
        await interaction.reply(payload);
      }
    } catch (error) {
      logger.error('Failed to handle manage users command', { error: (error as Error).message });

      await replyOrEdit(interaction, 'An error occurred while processing the command.');
    }
  }

  async handleBlacklistAdd(interaction: any): Promise<void> {
    const target = interaction.options.getUser('user');
    if (!target) {
      await replyOrEdit(interaction, 'Please specify a user to blacklist.');
      return;
    }

    try {
      const isBlacklisted = await this.blacklistService.isBlacklisted(interaction.guildId, target.id);
      if (isBlacklisted) {
        await replyOrEdit(interaction, `❌ <@${target.id}> is already blacklisted.`);
        return;
      }

      await this.blacklistService.addToBlacklist(interaction.guildId, target.id, interaction.user.id);
      await replyOrEdit(interaction, `✅ <@${target.id}> has been blacklisted from creating tickets.`);
    } catch (error) {
      logger.error('Failed to blacklist user', { error: (error as Error).message });
      await replyOrEdit(interaction, '❌ Failed to blacklist user.');
    }
  }

  async handleBlacklistRemove(interaction: any): Promise<void> {
    const target = interaction.options.getUser('user');
    if (!target) {
      await replyOrEdit(interaction, 'Please specify a user to unblacklist.');
      return;
    }

    try {
      const isBlacklisted = await this.blacklistService.isBlacklisted(interaction.guildId, target.id);
      if (!isBlacklisted) {
        await replyOrEdit(interaction, `❌ <@${target.id}> is not blacklisted.`);
        return;
      }

      await this.blacklistService.removeFromBlacklist(interaction.guildId, target.id);
      await replyOrEdit(interaction, `✅ <@${target.id}> has been unblacklisted.`);
    } catch (error) {
      logger.error('Failed to unblacklist user', { error: (error as Error).message });
      await replyOrEdit(interaction, '❌ Failed to unblacklist user.');
    }
  }

  async handleBlacklistList(interaction: any): Promise<void> {
    try {
      const entries = await this.blacklistService.getBlacklist(interaction.guildId);

      if (!entries || entries.length === 0) {
        await replyOrEdit(interaction, 'No users are currently blacklisted.');
        return;
      }

      const payload = buildBlacklistListPayload(entries, interaction.guild?.name || 'Unknown Server');

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (error) {
      logger.error('Failed to list blacklist', { error: (error as Error).message });
      await replyOrEdit(interaction, '❌ Failed to fetch blacklist.');
    }
  }
}

export default TicketCommandHandler;