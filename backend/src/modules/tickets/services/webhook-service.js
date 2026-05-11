import redisClient from '../../../core/redis.js';

export class WebhookService {
  constructor() {
    this.cacheKey = 'ticket:webhooks';
    this.defaultTtl = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Get or create webhook for log channel
   */
  async getOrCreateLogWebhook(logChannel) {
    const cacheKey = `${this.cacheKey}:${logChannel.id}`;
    
    // Try to get from Redis cache first
    const cached = await redisClient.hGetAll(cacheKey);
    if (cached && cached.webhookId && cached.webhookToken) {
      try {
        // Validate cached webhook
        const webhook = await logChannel.client.fetchWebhook(cached.webhookId);
        if (webhook && webhook.token === cached.webhookToken) {
          return webhook;
        }
      } catch {
        // Webhook is invalid, clear cache
        await redisClient.delete(cacheKey);
      }
    }

    // Acquire lock to prevent race conditions
    const lockKey = `webhook:create:${logChannel.id}`;
    const lockValue = await redisClient.acquireLock(lockKey, 10000);
    
    if (!lockValue) {
      // Another process is creating webhook, wait and retry
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.getOrCreateLogWebhook(logChannel);
    }

    try {
      // Fetch existing webhooks
      const hooks = await logChannel.fetchWebhooks().catch(() => null);
      
      const existing = hooks?.find(
        (hook) =>
          hook.owner?.id === logChannel.client.user.id &&
          hook.name === 'Ticket Logs'
      );

      const webhook = existing ?? await logChannel.createWebhook({
        name: 'Ticket Logs'
      }).catch(() => null);

      if (webhook) {
        // Cache webhook details
        await redisClient.hSet(cacheKey, {
          webhookId: webhook.id,
          webhookToken: webhook.token,
          channelId: logChannel.id,
          guildId: logChannel.guildId
        });
        
        // Set expiration
        const client = redisClient.getClient();
        if (client) {
          await client.expire(cacheKey, Math.ceil(this.defaultTtl / 1000));
        }
      }

      await redisClient.releaseLock(lockKey, lockValue);
      return webhook;
    } catch (error) {
      await redisClient.releaseLock(lockKey, lockValue);
      throw error;
    }
  }

  /**
   * Invalidate webhook cache for channel
   */
  async invalidateWebhookCache(channelId) {
    const cacheKey = `${this.cacheKey}:${channelId}`;
    await redisClient.delete(cacheKey);
  }

  /**
   * Clear all webhook cache (useful for webhook rotation)
   */
  async clearAllWebhookCache() {
    const client = redisClient.getClient();
    if (client) {
      const keys = await client.keys(`${this.cacheKey}:*`);
      if (keys.length > 0) {
        await client.del(keys);
      }
    }
  }

  /**
   * Validate webhook is still functional
   */
  async validateWebhook(webhook) {
    try {
      // Try to fetch webhook by ID to validate
      const client = webhook.client;
      await client.fetchWebhook(webhook.id);
      return true;
    } catch {
      return false;
    }
  }
}

export const webhookService = new WebhookService();
