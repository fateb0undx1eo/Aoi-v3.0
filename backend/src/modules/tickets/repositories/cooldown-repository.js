/**
 * Cooldown repository - manages cooldown data in Redis
 * Tracks when users closed tickets to enforce cooldown periods
 */

import logger from '../services/logging-service.js';
import { REDIS_KEYS, KEY_TTLS } from '../utils/redis-keys.js';
import { TICKET_COOLDOWN_MS } from '../utils/constants.js';
import { isValidDiscordId } from '../utils/validators.js';
import { DatabaseError, ValidationError } from '../utils/error-handler.js';

export class CooldownRepository {
  constructor(redis) {
    this.redis = redis;
  }

  /**
   * Sets a cooldown for a user (marks when they closed a ticket)
   */
  async setCooldown(userId) {
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
      logger.error('Failed to set cooldown', { userId, error: error.message });
      throw new DatabaseError('Failed to set cooldown', { userId });
    }
  }

  /**
   * Gets the remaining cooldown time for a user in milliseconds
   * Returns 0 if no cooldown or if expired
   */
  async getRemainingCooldown(userId) {
    if (!isValidDiscordId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    try {
      const key = REDIS_KEYS.cooldown(userId);
      const closedAt = await this.redis.get(key);

      if (!closedAt) {
        return 0;
      }

      const elapsed = Date.now() - parseInt(closedAt, 10);
      if (elapsed >= TICKET_COOLDOWN_MS) {
        await this.redis.del(key);
        return 0;
      }

      return TICKET_COOLDOWN_MS - elapsed;
    } catch (error) {
      logger.error('Failed to get remaining cooldown', { userId, error: error.message });
      throw new DatabaseError('Failed to get remaining cooldown', { userId });
    }
  }

  /**
   * Checks if a user is on cooldown
   */
  async isOnCooldown(userId) {
    const remaining = await this.getRemainingCooldown(userId);
    return remaining > 0;
  }

  /**
   * Gets the timestamp when a user will be off cooldown
   * Returns null if not on cooldown
   */
  async getCooldownExpiration(userId) {
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
      logger.error('Failed to get cooldown expiration', { userId, error: error.message });
      throw new DatabaseError('Failed to get cooldown expiration', { userId });
    }
  }

  /**
   * Removes a cooldown for a user
   */
  async clearCooldown(userId) {
    if (!isValidDiscordId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    try {
      const key = REDIS_KEYS.cooldown(userId);
      await this.redis.del(key);
      logger.debug('Cooldown cleared', { userId });
    } catch (error) {
      logger.error('Failed to clear cooldown', { userId, error: error.message });
      throw new DatabaseError('Failed to clear cooldown', { userId });
    }
  }

  /**
   * Gets all active cooldowns (development/debugging)
   */
  async getAllActiveCooldowns() {
    try {
      const pattern = REDIS_KEYS.cooldown('*');
      const keys = await this.redis.keys(pattern);
      
      if (keys.length === 0) {
        return [];
      }

      const values = await this.redis.mget(...keys);
      
      return keys.map((key, index) => {
        const userId = key.split(':').pop();
        return {
          userId,
          closedAt: parseInt(values[index], 10)
        };
      });
    } catch (error) {
      logger.error('Failed to fetch all active cooldowns', { error: error.message });
      throw new DatabaseError('Failed to fetch all active cooldowns');
    }
  }

  /**
   * Clears all cooldowns (use with caution)
   */
  async clearAllCooldowns() {
    try {
      const pattern = REDIS_KEYS.cooldown('*');
      const keys = await this.redis.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      return this.redis.del(...keys);
    } catch (error) {
      logger.error('Failed to clear all cooldowns', { error: error.message });
      throw new DatabaseError('Failed to clear all cooldowns');
    }
  }
}

export default CooldownRepository;
