import { cooldownRepository } from '../repositories/cooldown-repository.js';
import { redisClient } from '../../../core/redis.js';
import { REDIS_TTL } from '../utils/constants.js';
import { generateRedisKey } from '../utils/redis-keys.js';

/**
 * Enterprise-grade cooldown service
 * Uses Redis for distributed caching and PostgreSQL for persistence
 */

export class CooldownService {
  /**
   * Set cooldown for user in guild
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @param {number} durationMs - Cooldown duration in milliseconds
   * @param {string} reason - Cooldown reason
   */
  async setCooldown(guildId, userId, durationMs, reason = 'ticket_creation') {
    const expiresAt = new Date(Date.now() + durationMs).toISOString();
    
    // Set in Redis for distributed access (fast cache)
    const redisKey = generateRedisKey('cooldown', guildId, userId, reason);
    await redisClient.setWithTTL(redisKey, JSON.stringify({
      guildId,
      userId,
      expiresAt,
      reason
    }), durationMs);
    
    // Persist in database for restart safety
    await cooldownRepository.upsert({
      guildId,
      userId,
      expiresAt,
      reason
    });
  }

  /**
   * Get remaining cooldown time for user
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @param {string} reason - Cooldown reason
   * @returns {Promise<number>} Remaining time in milliseconds (0 if no cooldown)
   */
  async getRemainingCooldown(guildId, userId, reason = 'ticket_creation') {
    // Check Redis first (fast cache)
    const redisKey = generateRedisKey('cooldown', guildId, userId, reason);
    const cached = await redisClient.get(redisKey);
    
    if (cached) {
      try {
        const data = JSON.parse(cached);
        const remaining = new Date(data.expiresAt) - new Date();
        return Math.max(0, remaining);
      } catch (error) {
        console.warn('Invalid cached cooldown data, falling back to DB');
      }
    }
    
    // Fallback to database
    const cooldown = await cooldownRepository.findActiveCooldown(guildId, userId, reason);
    
    if (!cooldown) {
      return 0;
    }
    
    const remaining = new Date(cooldown.expires_at) - new Date();
    if (remaining <= 0) {
      // Clean up expired cooldown
      await this.clearCooldown(guildId, userId, reason);
      return 0;
    }
    
    // Update Redis cache with fresh data
    await redisClient.setWithTTL(redisKey, JSON.stringify({
      guildId,
      userId,
      expiresAt: cooldown.expires_at,
      reason: cooldown.reason
    }), remaining);
    
    return remaining;
  }

  /**
   * Check if user is on cooldown
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @param {string} reason - Cooldown reason
   * @returns {Promise<boolean>} True if user is on cooldown
   */
  async isOnCooldown(guildId, userId, reason = 'ticket_creation') {
    const remaining = await this.getRemainingCooldown(guildId, userId, reason);
    return remaining > 0;
  }

  /**
   * Clear cooldown for user
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @param {string} reason - Cooldown reason
   */
  async clearCooldown(guildId, userId, reason = 'ticket_creation') {
    const redisKey = generateRedisKey('cooldown', guildId, userId, reason);
    
    // Remove from Redis cache
    await redisClient.delete(redisKey);
    
    // Remove from database
    await cooldownRepository.removeCooldown(guildId, userId, reason);
  }

  /**
   * Clear all cooldowns for a user
   * @param {string} userId - Discord user ID
   */
  async clearAllUserCooldowns(userId) {
    // Get all user cooldowns from database
    const cooldowns = await cooldownRepository.findByUser(userId);
    
    // Clear each from Redis and database
    for (const cooldown of cooldowns) {
      const redisKey = generateRedisKey('cooldown', cooldown.guild_id, userId, cooldown.reason);
      await redisClient.delete(redisKey);
    }
    
    await cooldownRepository.clearUserCooldowns(userId);
  }

  /**
   * Clear all cooldowns for a guild
   * @param {string} guildId - Discord guild ID
   */
  async clearAllGuildCooldowns(guildId) {
    // Get all guild cooldowns from database
    const cooldowns = await cooldownRepository.findByGuild(guildId);
    
    // Clear each from Redis and database
    for (const cooldown of cooldowns) {
      const redisKey = generateRedisKey('cooldown', guildId, cooldown.user_id, cooldown.reason);
      await redisClient.delete(redisKey);
    }
    
    await cooldownRepository.clearGuildCooldowns(guildId);
  }

  /**
   * Get cooldown statistics for a guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} Cooldown statistics
   */
  async getStatistics(guildId) {
    return await cooldownRepository.getStatistics(guildId);
  }

  /**
   * Cleanup expired cooldowns
   * @returns {Promise<number>} Number of expired cooldowns cleaned up
   */
  async cleanupExpired() {
    // Clean up database
    const cleanedCount = await cooldownRepository.cleanupExpired();
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired cooldowns`);
    }
    
    return cleanedCount;
  }

  /**
   * Get cooldowns expiring soon
   * @param {string} guildId - Discord guild ID
   * @param {number} withinMinutes - Minutes threshold
   * @returns {Promise<Array>} Array of cooldowns expiring soon
   */
  async getExpiringSoon(guildId, withinMinutes = 5) {
    return await cooldownRepository.findExpiringSoon(guildId, withinMinutes);
  }

  /**
   * Batch set cooldowns for multiple users
   * @param {Array} cooldowns - Array of { guildId, userId, durationMs, reason }
   */
  async batchSetCooldowns(cooldowns) {
    const operations = [];
    
    for (const cooldown of cooldowns) {
      const { guildId, userId, durationMs, reason = 'ticket_creation' } = cooldown;
      const expiresAt = new Date(Date.now() + durationMs).toISOString();
      
      // Redis operation
      const redisKey = generateRedisKey('cooldown', guildId, userId, reason);
      operations.push({
        type: 'set',
        key: redisKey,
        value: JSON.stringify({ guildId, userId, expiresAt, reason }),
        ttl: durationMs
      });
      
      // Database operation
      operations.push({
        type: 'db',
        operation: 'upsert',
        data: { guildId, userId, expiresAt, reason }
      });
    }
    
    // Execute Redis operations in pipeline
    await redisClient.pipeline((pipeline) => {
      operations.forEach(op => {
        if (op.type === 'set') {
          pipeline.setEx(op.key, Math.ceil(op.ttl / 1000), op.value);
        }
      });
    });
    
    // Execute database operations
    for (const op of operations) {
      if (op.type === 'db') {
        await cooldownRepository.upsert(op.data);
      }
    }
  }
}

// Export singleton instance
export const cooldownService = new CooldownService();
