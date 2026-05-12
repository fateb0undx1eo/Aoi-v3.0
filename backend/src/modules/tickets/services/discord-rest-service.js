/**
 * Discord REST service - handles Discord API calls with retry logic
 */

import logger from './logging-service.js';
import { DatabaseError } from '../utils/error-handler.js';

export class DiscordRestService {
  constructor(discordClient, maxRetries = 3, retryDelayMs = 1000) {
    this.client = discordClient;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
  }

  /**
   * Fetches a channel with retry logic
   */
  async fetchChannelWithRetry(channelId) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const channel = await this.client.channels.fetch(channelId);
        return channel;
      } catch (error) {
        if (attempt === this.maxRetries) {
          logger.error('Failed to fetch channel after retries', { channelId, error: error.message });
          throw new DatabaseError('Failed to fetch channel', { channelId });
        }

        logger.warn(`Retrying channel fetch (attempt ${attempt}/${this.maxRetries})`, { channelId });
        await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * attempt));
      }
    }
  }

  /**
   * Fetches a guild with retry logic
   */
  async fetchGuildWithRetry(guildId) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const guild = await this.client.guilds.fetch(guildId);
        return guild;
      } catch (error) {
        if (attempt === this.maxRetries) {
          logger.error('Failed to fetch guild after retries', { guildId, error: error.message });
          throw new DatabaseError('Failed to fetch guild', { guildId });
        }

        logger.warn(`Retrying guild fetch (attempt ${attempt}/${this.maxRetries})`, { guildId });
        await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * attempt));
      }
    }
  }

  /**
   * Fetches a member with retry logic
   */
  async fetchMemberWithRetry(guild, userId) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const member = await guild.members.fetch(userId);
        return member;
      } catch (error) {
        if (attempt === this.maxRetries) {
          logger.error('Failed to fetch member after retries', { guildId: guild.id, userId, error: error.message });
          return null;
        }

        logger.debug(`Retrying member fetch (attempt ${attempt}/${this.maxRetries})`, { userId });
        await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * attempt));
      }
    }
  }

  /**
   * Sends a message with retry logic
   */
  async sendMessageWithRetry(channel, payload) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const message = await channel.send(payload);
        return message;
      } catch (error) {
        if (attempt === this.maxRetries) {
          logger.error('Failed to send message after retries', { channelId: channel.id, error: error.message });
          throw new DatabaseError('Failed to send message', { channelId: channel.id });
        }

        logger.warn(`Retrying message send (attempt ${attempt}/${this.maxRetries})`, { channelId: channel.id });
        await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * attempt));
      }
    }
  }

  /**
   * Edits a message with retry logic
   */
  async editMessageWithRetry(message, payload) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const edited = await message.edit(payload);
        return edited;
      } catch (error) {
        if (attempt === this.maxRetries) {
          logger.error('Failed to edit message after retries', { messageId: message.id, error: error.message });
          throw new DatabaseError('Failed to edit message', { messageId: message.id });
        }

        logger.debug(`Retrying message edit (attempt ${attempt}/${this.maxRetries})`, { messageId: message.id });
        await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * attempt));
      }
    }
  }

  /**
   * Adds a user to a thread with retry logic
   */
  async addUserToThreadWithRetry(thread, userId) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await thread.members.add(userId);
        return true;
      } catch (error) {
        if (attempt === this.maxRetries) {
          logger.error('Failed to add user to thread after retries', { threadId: thread.id, userId, error: error.message });
          return false;
        }

        logger.debug(`Retrying add user to thread (attempt ${attempt}/${this.maxRetries})`, { threadId: thread.id, userId });
        await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * attempt));
      }
    }
  }

  /**
   * Removes a user from a thread with retry logic
   */
  async removeUserFromThreadWithRetry(thread, userId) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await thread.members.remove(userId);
        return true;
      } catch (error) {
        if (attempt === this.maxRetries) {
          logger.error('Failed to remove user from thread after retries', { threadId: thread.id, userId, error: error.message });
          return false;
        }

        logger.debug(`Retrying remove user from thread (attempt ${attempt}/${this.maxRetries})`, { threadId: thread.id, userId });
        await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * attempt));
      }
    }
  }
}

export default DiscordRestService;
