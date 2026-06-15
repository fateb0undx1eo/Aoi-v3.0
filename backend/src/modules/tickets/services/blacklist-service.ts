import logger from './logging-service.js';
import { REDIS_KEYS, KEY_TTLS } from '../utils/redis-keys.js';
import { isValidDiscordId } from '../utils/validators.js';
import { DatabaseError, ValidationError } from '../utils/error-handler.js';
import type { RedisClient } from '../../../types/index.js';
import type TicketRepository from '../repositories/ticket-repository.js';

export class BlacklistService {
  private redis: RedisClient;
  private repo: TicketRepository;

  constructor(redis: RedisClient, ticketRepository: TicketRepository) {
    this.redis = redis;
    this.repo = ticketRepository;
  }

  async isBlacklisted(guildId: string, userId: string): Promise<boolean> {
    if (!isValidDiscordId(guildId) || !isValidDiscordId(userId)) return false;

    try {
      const key = REDIS_KEYS.blacklist(guildId, userId);
      const exists = await this.redis.get(key).catch(() => null);
      if (exists) return true;

      const dbCheck = await this.repo.isBlacklisted(guildId, userId);
      if (dbCheck) {
        await this.redis.setex(key, KEY_TTLS.BLACKLIST, '1').catch(() => null);
      }
      return dbCheck;
    } catch {
      return false;
    }
  }

  async addToBlacklist(guildId: string, userId: string, addedBy: string): Promise<void> {
    if (!isValidDiscordId(guildId)) throw new ValidationError('Invalid guild ID');
    if (!isValidDiscordId(userId)) throw new ValidationError('Invalid user ID');

    try {
      const key = REDIS_KEYS.blacklist(guildId, userId);
      await this.redis.setex(key, KEY_TTLS.BLACKLIST, '1');
      await this.repo.addToBlacklist(guildId, userId, addedBy);
      logger.info('User added to ticket blacklist', { guildId, userId, addedBy });
    } catch (error) {
      logger.error('Failed to add user to blacklist', { guildId, userId, error: (error as Error).message });
      throw new DatabaseError('Failed to add user to blacklist');
    }
  }

  async removeFromBlacklist(guildId: string, userId: string): Promise<void> {
    if (!isValidDiscordId(guildId)) throw new ValidationError('Invalid guild ID');
    if (!isValidDiscordId(userId)) throw new ValidationError('Invalid user ID');

    try {
      const key = REDIS_KEYS.blacklist(guildId, userId);
      await this.redis.del(key);
      await this.repo.removeFromBlacklist(guildId, userId);
      logger.info('User removed from ticket blacklist', { guildId, userId });
    } catch (error) {
      logger.error('Failed to remove user from blacklist', { guildId, userId, error: (error as Error).message });
      throw new DatabaseError('Failed to remove user from blacklist');
    }
  }

  async getBlacklist(guildId: string): Promise<{ user_id: string; added_by: string; created_at: string }[]> {
    if (!isValidDiscordId(guildId)) throw new ValidationError('Invalid guild ID');

    try {
      return await this.repo.getBlacklist(guildId);
    } catch (error) {
      logger.error('Failed to get blacklist', { guildId, error: (error as Error).message });
      throw new DatabaseError('Failed to get blacklist');
    }
  }
}

export default BlacklistService;
