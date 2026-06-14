import pRetry from 'p-retry';
import logger from './logging-service.js';
import { DatabaseError } from '../utils/error-handler.js';

export class DiscordRestService {
  private client: any;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(discordClient: any, maxRetries: number = 3, retryDelayMs: number = 1000) {
    this.client = discordClient;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
  }

  private retryOptions(label: string, meta: Record<string, any>): any {
    return {
      retries: this.maxRetries - 1,
      minTimeout: this.retryDelayMs,
      maxTimeout: this.retryDelayMs * this.maxRetries,
      onFailedAttempt: (error: any) => {
        logger.warn(`Retrying ${label} (attempt ${error.attemptNumber}/${this.maxRetries})`, meta);
      }
    };
  }

  async fetchChannelWithRetry(channelId: string): Promise<any> {
    try {
      return await pRetry(() => this.client.channels.fetch(channelId), {
        ...this.retryOptions('channel fetch', { channelId }),
        onFailedAttempt: (error: any) => {
          logger.warn(`Retrying channel fetch (attempt ${error.attemptNumber}/${this.maxRetries})`, { channelId });
        }
      });
    } catch (error) {
      logger.error('Failed to fetch channel after retries', { channelId, error: (error as Error).message });
      throw new DatabaseError('Failed to fetch channel', { channelId });
    }
  }

  async fetchGuildWithRetry(guildId: string): Promise<any> {
    try {
      return await pRetry(() => this.client.guilds.fetch(guildId), {
        ...this.retryOptions('guild fetch', { guildId }),
        onFailedAttempt: (error: any) => {
          logger.warn(`Retrying guild fetch (attempt ${error.attemptNumber}/${this.maxRetries})`, { guildId });
        }
      });
    } catch (error) {
      logger.error('Failed to fetch guild after retries', { guildId, error: (error as Error).message });
      throw new DatabaseError('Failed to fetch guild', { guildId });
    }
  }

  async fetchMemberWithRetry(guild: any, userId: string): Promise<any> {
    try {
      return await pRetry(() => guild.members.fetch(userId), {
        ...this.retryOptions('member fetch', { userId }),
        onFailedAttempt: (error: any) => {
          logger.debug(`Retrying member fetch (attempt ${error.attemptNumber}/${this.maxRetries})`, { userId });
        }
      });
    } catch (error) {
      logger.error('Failed to fetch member after retries', { guildId: guild.id, userId, error: (error as Error).message });
      return null;
    }
  }

  async sendMessageWithRetry(channel: any, payload: any): Promise<any> {
    try {
      return await pRetry(() => channel.send(payload), {
        ...this.retryOptions('message send', { channelId: channel.id }),
        onFailedAttempt: (error: any) => {
          logger.warn(`Retrying message send (attempt ${error.attemptNumber}/${this.maxRetries})`, { channelId: channel.id });
        }
      });
    } catch (error) {
      logger.error('Failed to send message after retries', { channelId: channel.id, error: (error as Error).message });
      throw new DatabaseError('Failed to send message', { channelId: channel.id });
    }
  }

  async editMessageWithRetry(message: any, payload: any): Promise<any> {
    try {
      return await pRetry(() => message.edit(payload), {
        ...this.retryOptions('message edit', { messageId: message.id }),
        onFailedAttempt: (error: any) => {
          logger.debug(`Retrying message edit (attempt ${error.attemptNumber}/${this.maxRetries})`, { messageId: message.id });
        }
      });
    } catch (error) {
      logger.error('Failed to edit message after retries', { messageId: message.id, error: (error as Error).message });
      throw new DatabaseError('Failed to edit message', { messageId: message.id });
    }
  }

  async addUserToThreadWithRetry(thread: any, userId: string): Promise<boolean> {
    try {
      await pRetry(() => thread.members.add(userId), {
        ...this.retryOptions('add user to thread', { threadId: thread.id, userId }),
        onFailedAttempt: (error: any) => {
          logger.debug(`Retrying add user to thread (attempt ${error.attemptNumber}/${this.maxRetries})`, { threadId: thread.id, userId });
        }
      });
      return true;
    } catch (error) {
      logger.error('Failed to add user to thread after retries', { threadId: thread.id, userId, error: (error as Error).message });
      return false;
    }
  }

  async removeUserFromThreadWithRetry(thread: any, userId: string): Promise<boolean> {
    try {
      await pRetry(() => thread.members.remove(userId), {
        ...this.retryOptions('remove user from thread', { threadId: thread.id, userId }),
        onFailedAttempt: (error: any) => {
          logger.debug(`Retrying remove user from thread (attempt ${error.attemptNumber}/${this.maxRetries})`, { threadId: thread.id, userId });
        }
      });
      return true;
    } catch (error) {
      logger.error('Failed to remove user from thread after retries', { threadId: thread.id, userId, error: (error as Error).message });
      return false;
    }
  }
}

export default DiscordRestService;
