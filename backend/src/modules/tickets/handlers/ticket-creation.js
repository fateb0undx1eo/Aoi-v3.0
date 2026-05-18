import { ChannelType } from 'discord.js';
import logger from '../services/logging-service.js';
import { buildTicketWelcomePayload, buildSuccessPayload, buildErrorPayload } from '../components/payloads.js';
import { generateThreadName, addStaffMembersToThread, buildTicketMentions, hasOpenTicketInChannel } from '../utils/thread-utils.js';
import { CooldownError } from '../utils/error-handler.js';
import {
  ERROR_MESSAGES,
  AUTO_ARCHIVE_24H,
  TICKET_LOG_CHANNEL_ID,
  TICKET_STAFF_ROLE_IDS,
  ADD_STAFF_MEMBERS_TO_THREAD,
  POINTER
} from '../utils/constants.js';

export class TicketCreationHandler {
  constructor(ticketService, lockService, discordRestService, webhookService, discordClient) {
    this.ticketService = ticketService;
    this.lockService = lockService;
    this.discordRest = discordRestService;
    this.webhookService = webhookService;
    this.discordClient = discordClient;
  }

  async handleTicketCreation(interaction, tag) {
    const { user, channel, client } = interaction;
    try {
      if (!channel?.threads?.create) {
        await this.replyError(interaction, ERROR_MESSAGES.NO_PANEL_CHANNEL);
        return;
      }

      try {
        await this.ticketService.cooldownService.checkCooldown(user.id);
      } catch (error) {
        if (error instanceof CooldownError) {
          await this.replyError(interaction, error.message);
          return;
        }
        throw error;
      }

      const hasOpen = await hasOpenTicketInChannel(channel, user.id, client.user.id);
      if (hasOpen) {
        await this.replyError(interaction, ERROR_MESSAGES.ALREADY_OPEN);
        return;
      }

      const thread = await channel.threads.create({
        name: generateThreadName(tag.namePrefix),
        type: ChannelType.PrivateThread,
        autoArchiveDuration: AUTO_ARCHIVE_24H,
        invitable: false,
        reason: `Ticket created by ${user.id} (${tag.value})`
      }).catch(() => null);

      if (!thread) {
        await this.replyError(interaction, ERROR_MESSAGES.THREAD_CREATE_FAILED);
        return;
      }

      const added = await thread.members.add(user.id).then(() => true).catch(() => false);
      if (!added) {
        await this.replyError(interaction, ERROR_MESSAGES.ADD_USER_FAILED);
        return;
      }

      await this.replySuccess(interaction, `Ticket created: <#${thread.id}>`);
      this.setupThreadAsync(thread, user.id, tag);
    } catch (error) {
      logger.error('Ticket creation failed', { error: error.message, stack: error.stack });
      await this.replyError(interaction, 'An error occurred while creating your ticket.');
    }
  }

  async setupThreadAsync(thread, creatorId, tag) {
    if (ADD_STAFF_MEMBERS_TO_THREAD) {
      await addStaffMembersToThread(thread).catch((error) => {
        logger.warn('Failed adding staff members', { error: error.message, threadId: thread.id });
      });
    }

    await thread.send({
      content: buildTicketMentions(creatorId),
      allowedMentions: { users: [creatorId], roles: TICKET_STAFF_ROLE_IDS }
    }).catch(() => null);

    await thread.send(buildTicketWelcomePayload(tag, creatorId)).catch(() => null);

    await this.ticketService.createTicket({
      guildId: thread.guildId,
      threadId: thread.id,
      creatorId,
      tagValue: tag.value,
      createdAt: new Date()
    }).catch(() => null);

    await this.sendCreatedLog(thread, creatorId, tag.label);
  }

  async sendCreatedLog(thread, creatorId, tagLabel) {
    const logChannel = await this.discordClient.channels.fetch(TICKET_LOG_CHANNEL_ID).catch(() => null);
    if (!logChannel) return;

    const webhook = await this.webhookService.getOrCreateLogWebhook(logChannel).catch(() => null);
    if (!webhook) return;

    const now = Math.floor(Date.now() / 1000);
    const threadLink = `https://discord.com/channels/${thread.guildId}/${thread.id}`;
    const embed = {
      title: 'Created',
      color: 0x8b2b2b,
      description: [
        `${POINTER} Created By: <@${creatorId}>`,
        `${POINTER} Created At: <t:${now}:F>`,
        `${POINTER} Ticket Tag: ${tagLabel}`,
        `${POINTER} Thread Link: ${threadLink}`
      ].join('\n')
    };

    await this.webhookService.sendWithRetry(webhook, {
      embeds: [embed],
      allowedMentions: { parse: [] },
      username: 'Ticket System',
      avatarURL: this.discordClient.user?.displayAvatarURL()
    }).catch(() => null);
  }

  async replyError(interaction, message) {
    const payload = buildErrorPayload(message);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => null);
    } else {
      await interaction.reply({ ...payload, ephemeral: true }).catch(() => null);
    }
  }

  async replySuccess(interaction, message) {
    const payload = buildSuccessPayload(message);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => null);
    } else {
      await interaction.reply({ ...payload, ephemeral: true }).catch(() => null);
    }
  }
}

export default TicketCreationHandler;
