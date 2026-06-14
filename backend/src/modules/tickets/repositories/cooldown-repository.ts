import logger from '../services/logging-service.js';
import { REDIS_KEYS, KEY_TTLS } from '../utils/redis-keys.js';
import { TICKET_COOLDOWN_MS } from '../utils/constants.js';
import { isValidDiscordId } from '../utils/validators.js';
import { DatabaseError, ValidationError } from '../utils/error-handler.js';
import type { RedisClient } from '../../../types/index.js';

export class CooldownRepository {
  private redis: RedisClient;

  constructor(redis: RedisClient) {
    this.redis = redis;
  }

  async setCooldown(userId: string): Promise<number> {
    if (!isValidDiscordId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    try {
      const key = REDIS_KEYS.cooldown(userId);
      const timestamp = Date.now();

      await this.redis.setex(
        key,
        KEY_TTLS.COOLDOWN,
        timestamp.toString()
      );

      logger.debug('Cooldown set', { userId });
      return timestamp;
    } catch (error) {
      logger.error('Failed to set cooldown', { userId, error: (error as Error).message });
      throw new DatabaseError('Failed to set cooldown', { userId });
    }
  }

  async getRemainingCooldown(userId: string): Promise<number> {
    if (!isValidDiscordId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    try {
      const key = REDIS_KEYS.cooldown(userId);
      const closedAt = await this.redis.get(key);

      if (!closedAt) {
        return 0;
      }

      const elapsed = Date.now() - parseInt(closedAt as string, 10);
      if (elapsed >= TICKET_COOLDOWN_MS) {
        await this.redis.del(key);
        return 0;
      }

      return TICKET_COOLDOWN_MS - elapsed;
    } catch (error) {
      logger.error('Failed to get remaining cooldown', { userId, error: (error as Error).message });
      throw new DatabaseError('Failed to get remaining cooldown', { userId });
    }
  }

  async isOnCooldown(userId: string): Promise<boolean> {
    const remaining = await this.getRemainingCooldown(userId);
    return remaining > 0;
  }

  async getCooldownExpiration(userId: string): Promise<number | null> {
    if (!isValidDiscordId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    try {
      const remaining = await this.getRemainingCooldown(userId);
      if (remaining === 0) {
        return null;
      }

      return Date.now() + remaining;
    } catch (error) {
      logger.error('Failed to get cooldown expiration', { userId, error: (error as Error).message });
      throw new DatabaseError('Failed to get cooldown expiration', { userId });
    }
  }

  async clearCooldown(userId: string): Promise<void> {
    if (!isValidDiscordId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    try {
      const key = REDIS_KEYS.cooldown(userId);
      await this.redis.del(key);
      logger.debug('Cooldown cleared', { userId });
    } catch (error) {
      logger.error('Failed to clear cooldown', { userId, error: (error as Error).message });
      throw new DatabaseError('Failed to clear cooldown', { userId });
    }
  }

  async getAllActiveCooldowns(): Promise<Array<{ userId: string; closedAt: number }>> {
    try {
      const pattern = REDIS_KEYS.cooldown('*');
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        return [];
      }

      const values = await this.redis.mget(...keys);

      return keys.map((key, index) => {
        const userId = key.split(':').pop()!;
        return {
          userId,
          closedAt: parseInt(values[index] as string, 10)
        };
      });
    } catch (error) {
      logger.error('Failed to fetch all active cooldowns', { error: (error as Error).message });
      throw new DatabaseError('Failed to fetch all active cooldowns');
    }
  }

  async clearAllCooldowns(): Promise<number> {
    try {
      const pattern = REDIS_KEYS.cooldown('*');
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      return this.redis.del(...keys);
    } catch (error) {
      logger.error('Failed to clear all cooldowns', { error: (error as Error).message });
      throw new DatabaseError('Failed to clear all cooldowns');
    }
  }
}

export default CooldownRepository;
