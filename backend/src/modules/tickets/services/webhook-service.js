/**
 * Webhook service - manages Discord webhooks for ticket logging
 */

import logger from './logging-service.js';
import { WebhookClient } from 'discord.js';
import { REDIS_KEYS, KEY_TTLS } from '../utils/redis-keys.js';
import { TICKET_LOG_CHANNEL_ID } from '../utils/constants.js';
import { DatabaseError } from '../utils/error-handler.js';

export class WebhookService {
  constructor(redis) {
    this.redis = redis;
  }

  /**
   * Gets or creates a webhook for the log channel
   */
  async getOrCreateLogWebhook(logChannel) {
    try {
      // Check Redis cache first
      const cachedKey = REDIS_KEYS.webhookCache();
      const cached = await this.redis.get(cachedKey).catch(() => null);

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.id && parsed.token) {
            logger.debug('Using cached webhook');
            return new WebhookClient({ id: parsed.id, token: parsed.token });
          }
        } catch {}
      }

      // Fetch existing webhooks
      const hooks = await logChannel.fetchWebhooks().catch(() => null);
      let webhook = hooks?.find(
        (hook) =>
          hook.owner?.id === logChannel.client.user.id &&
          hook.name === 'Ticket Logs'
      );

      // Create webhook if doesn't exist
      if (!webhook) {
        webhook = await logChannel.createWebhook({ name: 'Ticket Logs' }).catch(() => null);
      }

      if (!webhook) {
        throw new Error('Could not create or fetch webhook');
      }

      // Cache the webhook
      const webhookData = { id: webhook.id, token: webhook.token };
      await this.redis.setex(
        cachedKey,
        KEY_TTLS.WEBHOOK_CACHE,
        JSON.stringify(webhookData)
      ).catch(() => null);

      logger.info('Webhook created/cached', { webhookId: webhook.id });
      return webhook;
    } catch (error) {
      logger.error('Failed to get or create webhook', { error: error.message });
      throw new DatabaseError('Failed to get or create webhook');
    }
  }

  async sendWithRetry(webhook, payload, maxAttempts = 3) {
    let attempt = 0;
    let delayMs = 300;
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        return await webhook.send(payload);
      } catch (error) {
        if (attempt >= maxAttempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
      }
    }
    return null;
  }

  /**
   * Clears the cached webhook
   */
  async clearWebhookCache() {
    try {
      const cachedKey = REDIS_KEYS.webhookCache();
      await this.redis.del(cachedKey);
      logger.debug('Webhook cache cleared');
    } catch (error) {
      logger.error('Failed to clear webhook cache', { error: error.message });
    }
  }
}

export default WebhookService;
