import { fetchOne, upsertRows, deleteWhere } from '../../../database/repository.js';
import redisClient from '../../../core/redis.js';

export class CooldownService {
  async setCooldown(guildId, userId, durationMs) {
    const cooldownUntil = new Date(Date.now() + durationMs).toISOString();
    
    // Set in Redis for distributed access
    const redisKey = `ticket:cooldown:${guildId}:${userId}`;
    await redisClient.setWithTTL(redisKey, '1', durationMs);
    
    // Also persist in database for restart safety
    await upsertRows('ticket_cooldowns', {
      guild_id: guildId,
      user_id: userId,
      cooldown_until: cooldownUntil
    }, ['guild_id', 'user_id']);
  }

  async getRemainingCooldown(guildId, userId) {
    // Check Redis first (faster)
    const redisKey = `ticket:cooldown:${guildId}:${userId}`;
    const exists = await redisClient.exists(redisKey);
    
    if (exists) {
      // Get TTL from Redis
      const client = redisClient.getClient();
      if (client) {
        const ttl = await client.ttl(redisKey);
        return ttl > 0 ? ttl * 1000 : 0; // Convert seconds to ms
      }
    }
    
    // Fallback to database
    try {
      const cooldown = await fetchOne('ticket_cooldowns', (query) =>
        query.eq('guild_id', guildId).eq('user_id', userId)
      );
      
      if (!cooldown) return 0;
      
      const remaining = new Date(cooldown.cooldown_until) - new Date();
      if (remaining <= 0) {
        // Clean up expired cooldown
        await this.clearCooldown(guildId, userId);
        return 0;
      }
      
      // Update Redis cache
      await redisClient.setWithTTL(redisKey, '1', remaining);
      return remaining;
    } catch {
      return 0;
    }
  }

  async clearCooldown(guildId, userId) {
    const redisKey = `ticket:cooldown:${guildId}:${userId}`;
    await redisClient.delete(redisKey);
    
    await deleteWhere('ticket_cooldowns', (query) =>
      query.eq('guild_id', guildId).eq('user_id', userId)
    );
  }
}

export const cooldownService = new CooldownService();
