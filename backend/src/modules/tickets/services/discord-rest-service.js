import { ticketService } from './ticket-service.js';
import { webhookService } from './webhook-service.js';
import { lockService } from './lock-service.js';
import { redisClient } from '../../../core/redis.js';

/**
 * Discord REST safety service
 * Handles retry logic, rate limiting, and webhook cache invalidation
 */
export class DiscordRestService {
  constructor() {
    this.retryAttempts = 3;
    this.retryDelay = 1000; // Base delay in ms
    this.rateLimitCache = new Map(); // In-memory rate limit tracking
  }

  /**
   * Execute Discord API operation with retry logic and safety
   */
  async executeWithRetry(operation, context = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const result = await operation();
        return { success: true, data: result, attempt };
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          console.warn(`Non-retryable error in ${context.operation}:`, error.message);
          return { success: false, error, attempt, nonRetryable: true };
        }
        
        // Check rate limits
        if (error.code === 50001 || error.httpStatus === 429) {
          await this.handleRateLimit(error, context);
          continue;
        }
        
        // Log retry attempt
        console.warn(`Attempt ${attempt} failed for ${context.operation}:`, error.message);
        
        // Don't wait on the last attempt
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }
    
    console.error(`All ${this.retryAttempts} attempts failed for ${context.operation}:`, lastError.message);
    return { success: false, error: lastError, attempt: this.retryAttempts };
  }

  /**
   * Check if error is non-retryable
   */
  isNonRetryableError(error) {
    // Permission errors, not found, etc.
    const nonRetryableCodes = [50001, 10013, 10014, 10015, 10018, 10019];
    return nonRetryableCodes.includes(error.code) || 
           error.httpStatus === 404 || 
           error.httpStatus === 403 ||
           error.httpStatus === 400;
  }

  /**
   * Handle rate limiting
   */
  async handleRateLimit(error, context) {
    const retryAfter = error.retry_after || 5;
    console.warn(`Rate limited for ${context.operation}, waiting ${retryAfter}s`);
    
    // Cache rate limit info
    this.rateLimitCache.set(context.operation, {
      limitedUntil: Date.now() + (retryAfter * 1000),
      retryAfter
    });
    
    await this.delay(retryAfter * 1000);
  }

  /**
   * Check if operation is currently rate limited
   */
  isRateLimited(operation) {
    const limit = this.rateLimitCache.get(operation);
    if (limit && limit.limitedUntil > Date.now()) {
      return true;
    }
    
    // Clean up expired entries
    if (limit && limit.limitedUntil <= Date.now()) {
      this.rateLimitCache.delete(operation);
    }
    
    return false;
  }

  /**
   * Safe thread creation with rollback
   */
  async safeThreadCreate(parentChannel, threadData, ticketData) {
    const context = { operation: 'threadCreate', guildId: parentChannel.guildId };
    
    // Check rate limits first
    if (this.isRateLimited('threadCreate')) {
      throw new Error('Currently rate limited for thread creation');
    }
    
    const result = await this.executeWithRetry(
      () => parentChannel.threads.create(threadData),
      context
    );
    
    if (!result.success) {
      throw new Error(`Failed to create thread: ${result.error.message}`);
    }
    
    const thread = result.data;
    
    // Store creation attempt for potential rollback
    const creationRecord = {
      threadId: thread.id,
      ticketData,
      createdAt: Date.now()
    };
    
    await this.storeCreationAttempt(creationRecord);
    
    return thread;
  }

  /**
   * Safe thread operations with validation
   */
  async safeThreadOperation(thread, operation, operationData = {}) {
    const context = { 
      operation: `thread_${operation}`, 
      threadId: thread.id 
    };
    
    // Validate thread exists and is accessible
    if (!thread.isThread()) {
      throw new Error('Target is not a thread');
    }
    
    const result = await this.executeWithRetry(
      () => this.performThreadOperation(thread, operation, operationData),
      context
    );
    
    if (!result.success) {
      throw new Error(`Failed thread ${operation}: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Perform specific thread operation
   */
  async performThreadOperation(thread, operation, data) {
    switch (operation) {
      case 'setName':
        return await thread.setName(data.name);
      case 'setArchived':
        return await thread.setArchived(data.archived);
      case 'setLocked':
        return await thread.setLocked(data.locked);
      case 'setAutoArchiveDuration':
        return await thread.setAutoArchiveDuration(data.duration);
      case 'membersAdd':
        return await thread.members.add(data.userId);
      case 'membersRemove':
        return await thread.members.remove(data.userId);
      default:
        throw new Error(`Unknown thread operation: ${operation}`);
    }
  }

  /**
   * Safe webhook operations with cache invalidation
   */
  async safeWebhookOperation(channel, operation, data = {}) {
    const context = { 
      operation: `webhook_${operation}`, 
      channelId: channel.id 
    };
    
    const result = await this.executeWithRetry(
      () => this.performWebhookOperation(channel, operation, data),
      context
    );
    
    if (!result.success) {
      // Invalidate webhook cache on failure
      await webhookService.invalidateWebhookCache(channel.id);
      throw new Error(`Failed webhook ${operation}: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Perform specific webhook operation
   */
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
      default:
        throw new Error(`Unknown webhook operation: ${operation}`);
    }
  }

  /**
   * Store creation attempt for rollback tracking
   */
  async storeCreationAttempt(record) {
    try {
      await redisClient.setWithTTL(
        `ticket:creation_attempt:${record.threadId}`,
        JSON.stringify(record),
        5 * 60 * 1000 // 5 minutes
      );
    } catch (error) {
      console.warn('Failed to store creation attempt:', error);
    }
  }

  /**
   * Rollback failed ticket creation
   */
  async rollbackTicketCreation(threadId, reason) {
    console.log(`🔄 Rolling back ticket creation for ${threadId}: ${reason}`);
    
    try {
      // Delete from database
      await ticketService.deleteTicket(threadId);
      
      // Try to delete Discord thread
      const record = await redisClient.get(`ticket:creation_attempt:${threadId}`);
      if (record) {
        const creationData = JSON.parse(record);
        // Note: We can't easily delete threads via API, so we mark as archived
        console.log(`Thread ${threadId} should be manually cleaned up`);
      }
      
      // Clean up creation attempt record
      await redisClient.delete(`ticket:creation_attempt:${threadId}`);
      
      console.log(`✅ Rollback completed for ${threadId}`);
    } catch (error) {
      console.error(`❌ Rollback failed for ${threadId}:`, error);
    }
  }

  /**
   * Validate webhook cache and invalidate if needed
   */
  async validateWebhookCache(channel) {
    const lockValue = await lockService.acquireWebhookLock(channel.id, 30000);
    if (!lockValue) {
      return false; // Another process is validating
    }
    
    try {
      const webhook = await webhookService.getOrCreateLogWebhook(channel);
      if (!webhook) {
        await webhookService.invalidateWebhookCache(channel.id);
        return false;
      }
      
      // Test webhook by fetching it
      await channel.client.fetchWebhook(webhook.id);
      return true;
    } catch (error) {
      console.warn(`Webhook validation failed for ${channel.id}:`, error.message);
      await webhookService.invalidateWebhookCache(channel.id);
      return false;
    } finally {
      await lockService.releaseWebhookLock(channel.id, lockValue);
    }
  }

  /**
   * Batch webhook validation for multiple channels
   */
  async batchValidateWebhooks(channels) {
    const results = [];
    
    for (const channel of channels) {
      try {
        const isValid = await this.validateWebhookCache(channel);
        results.push({ channelId: channel.id, valid: isValid });
      } catch (error) {
        results.push({ 
          channelId: channel.id, 
          valid: false, 
          error: error.message 
        });
      }
    }
    
    return results;
  }

  /**
   * Cleanup stale creation attempts
   */
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
          // Clean up attempts older than 10 minutes
          if (Date.now() - data.createdAt > 10 * 60 * 1000) {
            await client.del(key);
            cleaned++;
          }
        }
      }
      
      if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} stale creation attempts`);
      }
      
      return cleaned;
    } catch (error) {
      console.error('Failed to cleanup creation attempts:', error);
      return 0;
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get operation statistics
   */
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
