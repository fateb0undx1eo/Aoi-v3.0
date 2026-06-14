import pRetry from 'p-retry';
import logger from './logging-service.js';
import { WebhookClient } from 'discord.js';
import { REDIS_KEYS, KEY_TTLS } from '../utils/redis-keys.js';
import { DatabaseError } from '../utils/error-handler.js';
import type { RedisClient } from '../../../types/index.js';

export class WebhookService {
  private redis: RedisClient;

  constructor(redis: RedisClient) {
    this.redis = redis;
  }

  async getOrCreateLogWebhook(logChannel: any): Promise<any> {
    try {
      const cachedKey = REDIS_KEYS.webhookCache();
      const cached = await this.redis.get(cachedKey).catch(() => null);

      if (cached) {
        try {
          const parsed = JSON.parse(cached as string);
          if (parsed.id && parsed.token) {
            logger.debug('Using cached webhook');
            return new WebhookClient({ id: parsed.id, token: parsed.token });
          }
        } catch {}
      }

      const hooks = await logChannel.fetchWebhooks().catch(() => null);
      let webhook = hooks?.find(
        (hook: any) =>
          hook.owner?.id === logChannel.client.user.id &&
          hook.name === 'Ticket Logs'
      );

      if (!webhook) {
        webhook = await logChannel.createWebhook({ name: 'Ticket Logs' }).catch(() => null);
      }

      if (!webhook) {
        throw new Error('Could not create or fetch webhook');
      }

      const webhookData = { id: webhook.id, token: webhook.token };
      await this.redis.setex(
        cachedKey,
        KEY_TTLS.WEBHOOK_CACHE,
        JSON.stringify(webhookData)
      ).catch(() => null);

      logger.info('Webhook created/cached', { webhookId: webhook.id });
      return webhook;
    } catch (error) {
      logger.error('Failed to get or create webhook', { error: (error as Error).message });
      throw new DatabaseError('Failed to get or create webhook');
    }
  }

  async sendWithRetry(webhook: any, payload: any, maxAttempts: number = 3): Promise<any> {
    try {
      return await pRetry(() => webhook.send(payload), {
        retries: maxAttempts - 1,
        minTimeout: 300,
        maxTimeout: 300 * Math.pow(2, maxAttempts - 1),
        onFailedAttempt: (error: any) => {
          logger.debug(`Webhook send retry (attempt ${error.attemptNumber}/${maxAttempts})`, { error: error.message });
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async clearWebhookCache(): Promise<void> {
    try {
      const cachedKey = REDIS_KEYS.webhookCache();
      await this.redis.del(cachedKey);
      logger.debug('Webhook cache cleared');
    } catch (error) {
      logger.error('Failed to clear webhook cache', { error: (error as Error).message });
    }
  }
}

export default WebhookService;
