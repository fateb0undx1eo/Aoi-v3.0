/**
 * Ticket creation handler
 * Handles the ticket creation workflow from tag selection to thread setup
 */

import { ChannelType } from 'discord.js';
import logger from '../services/logging-service.js';
import { buildTicketWelcomePayload, buildSuccessPayload, buildErrorPayload } from '../components/payloads.js';
import {
  generateThreadName,
  addStaffMembersToThread,
  buildTicketMentions,
  hasOpenTicketInChannel,
  getCreatorIdFromThread,
  findWelcomeMessageInThread
} from '../utils/thread-utils.js';
import { CooldownError, PermissionError, ValidationError } from '../utils/error-handler.js';
import { ERROR_MESSAGES, AUTO_ARCHIVE_24H } from '../utils/constants.js';

export class TicketCreationHandler {
  constructor(ticketService, lockService, discordRestService) {
    this.ticketService = ticketService;
    this.lockService = lockService;
    this.discordRest = discordRestService;
  }

  /**
   * Handles ticket creation from tag selection
   */
  async handleTicketCreation(interaction, tag) {
    const startTime = Date.now();
    const { user, channel, client } = interaction;

    logger.info('Ticket creation initiated', { userId: user.id, tag: tag.value });

    try {
      // Validate channel
      if (!channel?.threads?.create) {
        await this.replyError(interaction, ERROR_MESSAGES.NO_PANEL_CHANNEL);
        return;
      }

      // Check cooldown
      try {
        await this.ticketService.cooldownService.checkCooldown(user.id);
      } catch (error) {
        if (error instanceof CooldownError) {
          await this.replyError(interaction, error.message);
          return;
        }
        throw error;
      }

      // Check for existing open ticket
      const hasOpen = await hasOpenTicketInChannel(channel, user.id, client.user.id);
      if (hasOpen) {
        await this.replyError(interaction, ERROR_MESSAGES.ALREADY_OPEN);
        return;
      }

      // Generate thread name
      const threadName = generateThreadName(tag.namePrefix);

      // Create the thread
      let thread;
      try {
        thread = await channel.threads.create({
          name: threadName,
          type: ChannelType.PrivateThread,
          invitable: false,
          autoArchiveDuration: AUTO_ARCHIVE_24H,
          reason: `Ticket created by ${user.id} (${tag.value})`
        });
      } catch (error) {
        logger.error('Failed to create thread', { error: error.message });
        await this.replyError(interaction, ERROR_MESSAGES.THREAD_CREATE_FAILED);
        return;
      }

      // Add creator to thread
      try {
        await thread.members.add(user.id);
      } catch (error) {
        logger.error('Failed to add user to thread', { threadId: thread.id, userId: user.id, error: error.message });
        await this.replyError(interaction, ERROR_MESSAGES.ADD_USER_FAILED);
        return;
      }

      // Reply to interaction
      await this.replySuccess(interaction, `Ticket created: <#${thread.id}>`);

      // Setup thread in background
      this.setupThreadAsync(thread, user.id, tag);

      logger.info('Ticket created successfully', {
        threadId: thread.id,
        userId: user.id,
        durationMs: Date.now() - startTime
      });
    } catch (error) {
      logger.error('Ticket creation failed', {
        userId: user.id,
        error: error.message,
        stack: error.stack
      });
      await this.replyError(interaction, 'An error occurred while creating your ticket.');
    }
  }

  /**
   * Sets up the thread asynchronously
   */
  async setupThreadAsync(thread, creatorId, tag) {
    try {
      const setupTasks = [];

      // Add staff members
      setupTasks.push(
        addStaffMembersToThread(thread).catch(error => {
          logger.error('Failed to add staff to thread', { threadId: thread.id, error: error.message });
        })
      );

      // Send messages
      const messageSetup = (async () => {
        try {
          // Send mention message
          await thread.send({
            content: buildTicketMentions(creatorId),
            allowedMentions: {
              users: [creatorId],
              roles: []
            }
          }).catch(() => null);

          // Send welcome message
          await thread.send(buildTicketWelcomePayload(tag, creatorId)).catch(() => null);
        } catch (error) {
          logger.error('Failed to send thread messages', { threadId: thread.id, error: error.message });
        }
      })();

      setupTasks.push(messageSetup);

      // Create database record
      const dbSetup = (async () => {
        try {
          await this.ticketService.createTicket({
            guildId: thread.guildId,
            threadId: thread.id,
            creatorId,
            tagValue: tag.value,
            createdAt: new Date()
          });
        } catch (error) {
          logger.error('Failed to create ticket record', { threadId: thread.id, error: error.message });
        }
      })();

      setupTasks.push(dbSetup);

      // Send logging
      // (ticket logging would happen here)

      await Promise.allSettled(setupTasks);
    } catch (error) {
      logger.error('Thread setup failed', { error: error.message });
    }
  }

  /**
   * Helper: Reply with error
   */
  async replyError(interaction, message) {
    const payload = buildErrorPayload(message);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => null);
    } else {
      await interaction.reply({ ...payload, ephemeral: true }).catch(() => null);
    }
  }

  /**
   * Helper: Reply with success
   */
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
