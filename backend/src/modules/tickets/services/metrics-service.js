import { redisClient } from '../../../core/redis.js';
import { METRICS_KEYS } from '../utils/redis-keys.js';
import { METRICS } from '../utils/constants.js';
import { loggingService } from './logging-service.js';

/**
 * Enterprise-grade metrics service for ticket system
 * Uses Redis lists for non-overwriting performance tracking
 */
export class MetricsService {
  /**
   * Record ticket creation metric
   * @param {number} duration - Operation duration in milliseconds
   * @param {boolean} success - Whether operation succeeded
   * @param {Object} metadata - Additional metadata
   */
  async recordTicketCreation(duration, success, metadata = {}) {
    const metric = {
      operation: 'ticket_created',
      duration,
      success,
      guildId: metadata.guildId,
      threadId: metadata.threadId,
      userId: metadata.userId,
      tag: metadata.tag,
      error: metadata.error,
      timestamp: new Date().toISOString()
    };

    await this.addMetric('ticket_created', metric);
    
    await loggingService.trackMetric('ticket_created', {
      duration,
      guildId: metadata.guildId,
      threadId: metadata.threadId,
      userId: metadata.userId,
      success,
      error: metadata.error
    });
  }

  /**
   * Record ticket resolution metric
   * @param {number} duration - Operation duration in milliseconds
   * @param {boolean} success - Whether operation succeeded
   * @param {Object} metadata - Additional metadata
   */
  async recordTicketResolution(duration, success, metadata = {}) {
    const metric = {
      operation: 'ticket_resolved',
      duration,
      success,
      guildId: metadata.guildId,
      threadId: metadata.threadId,
      resolverId: metadata.resolverId,
      userId: metadata.userId,
      error: metadata.error,
      timestamp: new Date().toISOString()
    };

    await this.addMetric('ticket_resolved', metric);
    
    await loggingService.trackMetric('ticket_resolved', {
      duration,
      guildId: metadata.guildId,
      threadId: metadata.threadId,
      userId: metadata.resolverId,
      success,
      error: metadata.error
    });
  }

  /**
   * Record Discord API operation metric
   * @param {string} operation - API operation name
   * @param {number} duration - Operation duration in milliseconds
   * @param {boolean} success - Whether operation succeeded
   * @param {Object} metadata - Additional metadata
   */
  async recordDiscordOperation(operation, duration, success, metadata = {}) {
    const metric = {
      operation: 'discord_api',
      apiOperation: operation,
      duration,
      success,
      guildId: metadata.guildId,
      threadId: metadata.threadId,
      userId: metadata.userId,
      error: metadata.error,
      timestamp: new Date().toISOString()
    };

    await this.addMetric('discord_api', metric);
    
    await loggingService.trackMetric('discord_api', {
      duration,
      guildId: metadata.guildId,
      threadId: metadata.threadId,
      userId: metadata.userId,
      success,
      error: metadata.error
    });
  }

  /**
   * Record user management operation metric
   * @param {string} operation - Operation name (add_user, remove_user)
   * @param {number} duration - Operation duration in milliseconds
   * @param {boolean} success - Whether operation succeeded
   * @param {Object} metadata - Additional metadata
   */
  async recordUserManagement(operation, duration, success, metadata = {}) {
    const metric = {
      operation: `user_${operation}`,
      duration,
      success,
      guildId: metadata.guildId,
      threadId: metadata.threadId,
      targetUserId: metadata.targetUserId,
      staffId: metadata.staffId,
      error: metadata.error,
      timestamp: new Date().toISOString()
    };

    await this.addMetric(`user_${operation}`, metric);
    
    await loggingService.trackMetric(`user_${operation}`, {
      duration,
      guildId: metadata.guildId,
      threadId: metadata.threadId,
      userId: metadata.staffId,
      success,
      error: metadata.error
    });
  }

  /**
   * Record cooldown check metric
   * @param {number} duration - Operation duration in milliseconds
   * @param {boolean} success - Whether operation succeeded
   * @param {Object} metadata - Additional metadata
   */
  async recordCooldownCheck(duration, success, metadata = {}) {
    const metric = {
      operation: 'cooldown_check',
      duration,
      success,
      guildId: metadata.guildId,
      userId: metadata.userId,
      onCooldown: metadata.onCooldown,
      error: metadata.error,
      timestamp: new Date().toISOString()
    };

    await this.addMetric('cooldown_check', metric);
    
    await loggingService.trackMetric('cooldown_check', {
      duration,
      guildId: metadata.guildId,
      userId: metadata.userId,
      success,
      error: metadata.error
    });
  }

  /**
   * Record webhook operation metric
   * @param {string} operation - Operation name (fetch, send, create)
   * @param {number} duration - Operation duration in milliseconds
   * @param {boolean} success - Whether operation succeeded
   * @param {Object} metadata - Additional metadata
   */
  async recordWebhookOperation(operation, duration, success, metadata = {}) {
    const metric = {
      operation: 'webhook_fetch',
      webhookOperation: operation,
      duration,
      success,
      guildId: metadata.guildId,
      channelId: metadata.channelId,
      error: metadata.error,
      timestamp: new Date().toISOString()
    };

    await this.addMetric('webhook_fetch', metric);
    
    await loggingService.trackMetric('webhook_fetch', {
      duration,
      guildId: metadata.guildId,
      userId: metadata.userId,
      success,
      error: metadata.error
    });
  }

  /**
   * Add metric to Redis list (non-overwriting)
   * @param {string} operation - Operation name
   * @param {Object} metric - Metric data
   */
  async addMetric(operation, metric) {
    const metricKey = METRICS_KEYS.operation(operation);
    
    // Store in Redis list (non-overwriting)
    await redisClient.lPush(metricKey, JSON.stringify(metric));
    
    // Trim to keep only latest entries
    await redisClient.lTrim(metricKey, 0, METRICS.MAX_ENTRIES - 1);
    
    // Set expiration for metric retention
    await redisClient.expire(metricKey, METRICS.RETENTION_HOURS * 3600);
  }

  /**
   * Get recent metrics for operation
   * @param {string} operation - Operation name
   * @param {number} count - Number of metrics to retrieve
   * @returns {Promise<Array>} Array of metric entries
   */
  async getRecentMetrics(operation, count = 50) {
    const metricKey = METRICS_KEYS.operation(operation);
    const metrics = await redisClient.lRange(metricKey, 0, count - 1);
    
    return metrics.map(metric => {
      try {
        return JSON.parse(metric);
      } catch (error) {
        return { raw: metric, parseError: error.message };
      }
    });
  }

  /**
   * Get performance statistics for operation
   * @param {string} operation - Operation name
   * @returns {Promise<Object>} Performance statistics
   */
  async getPerformanceStats(operation) {
    const metrics = await this.getRecentMetrics(operation, 100);
    
    if (metrics.length === 0) {
      return {
        count: 0,
        successRate: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        errorCount: 0
      };
    }
    
    const successCount = metrics.filter(m => m.success).length;
    const errorCount = metrics.filter(m => !m.success).length;
    const durations = metrics.filter(m => m.duration).map(m => m.duration);
    
    return {
      count: metrics.length,
      successRate: (successCount / metrics.length) * 100,
      averageDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      errorCount,
      p95Duration: this.calculatePercentile(durations, 95),
      p99Duration: this.calculatePercentile(durations, 99)
    };
  }

  /**
   * Get all operations statistics
   * @returns {Promise<Object>} All operations statistics
   */
  async getAllStats() {
    const stats = {};
    
    for (const operation of METRICS.OPERATIONS) {
      stats[operation] = await this.getPerformanceStats(operation);
    }
    
    return stats;
  }

  /**
   * Calculate percentile from array of numbers
   * @param {Array} values - Array of numbers
   * @param {number} percentile - Percentile to calculate (0-100)
   * @returns {number} Percentile value
   */
  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Clear metrics for operation
   * @param {string} operation - Operation name
   */
  async clearMetrics(operation) {
    const metricKey = METRICS_KEYS.operation(operation);
    await redisClient.delete(metricKey);
  }

  /**
   * Clear all metrics
   */
  async clearAllMetrics() {
    for (const operation of METRICS.OPERATIONS) {
      await this.clearMetrics(operation);
    }
  }

  /**
   * Get metrics summary for dashboard
   * @returns {Promise<Object>} Dashboard summary
   */
  async getDashboardSummary() {
    const summary = {
      totalOperations: 0,
      totalErrors: 0,
      averageSuccessRate: 0,
      operations: {}
    };
    
    let totalSuccessRate = 0;
    let operationCount = 0;
    
    for (const operation of METRICS.OPERATIONS) {
      const stats = await this.getPerformanceStats(operation);
      
      summary.operations[operation] = stats;
      summary.totalOperations += stats.count;
      summary.totalErrors += stats.errorCount;
      
      if (stats.count > 0) {
        totalSuccessRate += stats.successRate;
        operationCount++;
      }
    }
    
    summary.averageSuccessRate = operationCount > 0 ? totalSuccessRate / operationCount : 0;
    
    return summary;
  }

  /**
   * Create performance timer
   * @returns {Object} Timer object with stop method
   */
  createTimer() {
    const startTime = Date.now();
    
    return {
      stop: () => Date.now() - startTime,
      
      async record(operation, success, metadata = {}) {
        const duration = this.stop();
        await this.recordMetric(operation, duration, success, metadata);
        return duration;
      }
    };
  }

  /**
   * Record metric with timer
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} success - Whether operation succeeded
   * @param {Object} metadata - Additional metadata
   */
  async recordMetric(operation, duration, success, metadata = {}) {
    const metric = {
      operation,
      duration,
      success,
      guildId: metadata.guildId,
      threadId: metadata.threadId,
      userId: metadata.userId,
      error: metadata.error,
      timestamp: new Date().toISOString()
    };

    await this.addMetric(operation, metric);
  }
}

// Export singleton instance
export const metricsService = new MetricsService();
