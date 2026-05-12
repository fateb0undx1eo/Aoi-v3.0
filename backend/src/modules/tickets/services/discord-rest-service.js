import { ticketRepository } from '../repositories/ticket-repository.js';
import { webhookService } from './webhook-service.js';
import { lockService } from './lock-service.js';
import { redisClient } from '../../../core/redis.js';

export class DiscordRestService {
  constructor() {
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.rateLimitCache = new Map();
  }

  async executeWithRetry(operation, context = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const result = await operation();
        return { success: true, data: result, attempt };
      } catch (error) {
        lastError = error;
        
        if (this.isNonRetryableError(error)) {
          return { success: false, error, attempt, nonRetryable: true };
        }
        
        if (error.code === 50001 || error.httpStatus === 429) {
          await this.handleRateLimit(error, context);
          continue;
        }
        
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }
    return { success: false, error: lastError, attempt: this.retryAttempts };
  }

  isNonRetryableError(error) {
    const nonRetryableCodes =[50001, 10013, 10014, 10015, 10018, 10019];
    return nonRetryableCodes.includes(error.code) || 
           error.httpStatus === 404 || 
           error.httpStatus === 403 ||
           error.httpStatus === 400;
  }

  async handleRateLimit(error, context) {
    const retryAfter = error.retry_after || 5;
    this.rateLimitCache.set(context.operation, {
      limitedUntil: Date.now() + (retryAfter * 1000),
      retryAfter
    });
    await this.delay(retryAfter * 1000);
  }

  isRateLimited(operation) {
    const limit = this.rateLimitCache.get(operation);
    if (limit && limit.limitedUntil > Date.now()) return true;
    if (limit && limit.limitedUntil <= Date.now()) this.rateLimitCache.delete(operation);
    return false;
  }

  async safeThreadCreate(parentChannel, threadData, ticketData) {
    const context = { operation: 'threadCreate', guildId: parentChannel.guildId };
    
    if (this.isRateLimited('threadCreate')) throw new Error('Currently rate limited for thread creation');
    
    const result = await this.executeWithRetry(() => parentChannel.threads.create(threadData), context);
    if (!result.success) throw new Error(`Failed to create thread: ${result.error.message}`);
    
    const thread = result.data;
    
    await this.storeCreationAttempt({
      threadId: thread.id,
      ticketData,
      createdAt: Date.now()
    });
    
    return thread;
  }

  async safeThreadOperation(thread, operation, operationData = {}) {
    const context = { operation: `thread_${operation}`, threadId: thread.id };
    
    if (!thread.isThread()) throw new Error('Target is not a thread');
    
    const result = await this.executeWithRetry(() => this.performThreadOperation(thread, operation, operationData), context);
    if (!result.success) throw new Error(`Failed thread ${operation}: ${result.error.message}`);
    
    return result.data;
  }

  async performThreadOperation(thread, operation, data) {
    switch (operation) {
      case 'setName': return await thread.setName(data.name);
      case 'setArchived': return await thread.setArchived(data.archived);
      case 'setLocked': return await thread.setLocked(data.locked);
      case 'setAutoArchiveDuration': return await thread.setAutoArchiveDuration(data.duration);
      case 'membersAdd': return await thread.members.add(data.userId);
      case 'membersRemove': return await thread.members.remove(data.userId);
      default: throw new Error(`Unknown thread operation: ${operation}`);
    }
  }

  async safeWebhookOperation(channel, operation, data = {}) {
    const context = { operation: `webhook_${operation}`, channelId: channel.id };
    
    const result = await this.executeWithRetry(() => this.performWebhookOperation(channel, operation, data), context);
    
    if (!result.success) {
      await webhookService.invalidateWebhookCache(channel.id);
      throw new Error(`Failed webhook ${operation}: ${result.error.message}`);
    }
    
    return result.data;
  }

  async performWebhookOperation(channel, operation, data) {
    switch (operation) {
      case 'send':
        const webhook = await webhookService.getOrCreateLogWebhook(channel);
        return await webhook.send(data.payload);
      case 'editMessage':
        const webhook2 = await webhookService.getOrCreateLogWebhook(channel);
        return await webhook2.editMessage(data.messageId, data.payload);
      case 'fetchMessage':
        const webhook3 = await webhookService.getOrCreateLogWebhook(channel);
        return await webhook3.fetchMessage(data.messageId);
      default: throw new Error(`Unknown webhook operation: ${operation}`);
    }
  }

  async storeCreationAttempt(record) {
    try {
      await redisClient.setWithTTL(`ticket:creation_attempt:${record.threadId}`, JSON.stringify(record), 5 * 60 * 1000);
    } catch (error) {
      console.warn('Failed to store creation attempt:', error);
    }
  }

  async rollbackTicketCreation(threadId, reason) {
    try {
      await ticketRepository.delete(threadId); // Fixed call here
      
      const record = await redisClient.get(`ticket:creation_attempt:${threadId}`);
      if (record) {
        // Record exists, manual cleanup might be needed if thread is orphaned
      }
      
      await redisClient.delete(`ticket:creation_attempt:${threadId}`);
    } catch (error) {
      console.error(`❌ Rollback failed for ${threadId}:`, error);
    }
  }

  async validateWebhookCache(channel) {
    const lockValue = await lockService.acquireWebhookLock(channel.id, 30000);
    if (!lockValue) return false;
    
    try {
      const webhook = await webhookService.getOrCreateLogWebhook(channel);
      if (!webhook) {
        await webhookService.invalidateWebhookCache(channel.id);
        return false;
      }
      
      await channel.client.fetchWebhook(webhook.id);
      return true;
    } catch (error) {
      await webhookService.invalidateWebhookCache(channel.id);
      return false;
    } finally {
      await lockService.releaseWebhookLock(channel.id, lockValue);
    }
  }

  async batchValidateWebhooks(channels) {
    const results =[];
    for (const channel of channels) {
      try {
        const isValid = await this.validateWebhookCache(channel);
        results.push({ channelId: channel.id, valid: isValid });
      } catch (error) {
        results.push({ channelId: channel.id, valid: false, error: error.message });
      }
    }
    return results;
  }

  async cleanupStaleCreationAttempts() {
    try {
      const client = redisClient.getClient();
      if (!client) return 0;
      
      const pattern = 'ticket:creation_attempt:*';
      const keys = await client.keys(pattern);
      let cleaned = 0;
      
      for (const key of keys) {
        const record = await client.get(key);
        if (record) {
          const data = JSON.parse(record);
          if (Date.now() - data.createdAt > 10 * 60 * 1000) {
            await client.del(key);
            cleaned++;
          }
        }
      }
      return cleaned;
    } catch (error) {
      return 0;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getOperationStats() {
    return {
      rateLimitedOps: Array.from(this.rateLimitCache.entries()).map(([op, data]) => ({
        operation: op,
        limitedUntil: new Date(data.limitedUntil),
        retryAfter: data.retryAfter
      })),
      cacheSize: this.rateLimitCache.size
    };
  }
}

export const discordRestService = new DiscordRestService();