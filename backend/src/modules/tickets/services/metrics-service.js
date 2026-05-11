import redisClient from '../../../core/redis.js';
import { logger, createTimer } from '../utils/logger.js';

/**
 * Operational metrics service for ticket system
 * Tracks performance, health, and operational metrics
 */
export class MetricsService {
  constructor() {
    this.metricsKey = 'ticket:metrics:operational';
    this.retentionPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  /**
   * Record ticket creation metric
   */
  async recordTicketCreation(duration, success, metadata = {}) {
    const metric = {
      type: 'ticket_creation',
      timestamp: new Date().toISOString(),
      duration,
      success,
      guildId: metadata.guildId,
      userId: metadata.userId,
      tag: metadata.tag,
      error: metadata.error
    };

    await this.addMetric(metric);
    logger.logTicketOperation('creation', metadata.threadId, { duration, success });
  }

  /**
   * Record ticket resolution metric
   */
  async recordTicketResolution(duration, success, metadata = {}) {
    const metric = {
      type: 'ticket_resolution',
      timestamp: new Date().toISOString(),
      duration,
      success,
      guildId: metadata.guildId,
      threadId: metadata.threadId,
      resolverId: metadata.resolverId,
      error: metadata.error
    };

    await this.addMetric(metric);
    logger.logTicketOperation('resolution', metadata.threadId, { duration, success });
  }

  /**
   * Record Discord API operation metric
   */
  async recordDiscordOperation(operation, duration, success, metadata = {}) {
    const metric = {
      type: 'discord_api',
      timestamp: new Date().toISOString(),
      operation,
      duration,
      success,
      httpStatus: metadata.httpStatus,
      error: metadata.error
    };

    await this.addMetric(metric);
    logger.logDiscordOperation(operation, { duration, success });
  }

  /**
   * Record database operation metric
   */
  async recordDatabaseOperation(operation, duration, success, metadata = {}) {
    const metric = {
      type: 'database',
      timestamp: new Date().toISOString(),
      operation,
      duration,
      success,
      query: metadata.query,
      error: metadata.error
    };

    await this.addMetric(metric);
    logger.logDatabaseOperation(operation, { duration, success });
  }

  /**
   * Record Redis operation metric
   */
  async recordRedisOperation(operation, duration, success, metadata = {}) {
    const metric = {
      type: 'redis',
      timestamp: new Date().toISOString(),
      operation,
      duration,
      success,
      key: metadata.key,
      error: metadata.error
    };

    await this.addMetric(metric);
    logger.logRedisOperation(operation, { duration, success });
  }

  /**
   * Record lock operation metric
   */
  async recordLockOperation(operation, duration, success, metadata = {}) {
    const metric = {
      type: 'lock',
      timestamp: new Date().toISOString(),
      operation,
      duration,
      success,
      lockType: metadata.lockType,
      lockKey: metadata.lockKey,
      error: metadata.error
    };

    await this.addMetric(metric);
  }

  /**
   * Record webhook operation metric
   */
  async recordWebhookOperation(operation, duration, success, metadata = {}) {
    const metric = {
      type: 'webhook',
      timestamp: new Date().toISOString(),
      operation,
      duration,
      success,
      channelId: metadata.channelId,
      error: metadata.error
    };

    await this.addMetric(metric);
  }

  /**
   * Add metric to storage
   */
  async addMetric(metric) {
    try {
      const existing = await this.getMetrics();
      existing.push(metric);
      
      // Keep only recent metrics (last 1000)
      if (existing.length > 1000) {
        existing.splice(0, existing.length - 1000);
      }
      
      await redisClient.setWithTTL(this.metricsKey, JSON.stringify(existing), this.retentionPeriod);
    } catch (error) {
      logger.warn('Failed to store metric', { error: error.message });
    }
  }

  /**
   * Get all metrics
   */
  async getMetrics() {
    try {
      const metrics = await redisClient.get(this.metricsKey);
      return metrics ? JSON.parse(metrics) : [];
    } catch (error) {
      logger.error('Failed to get metrics', { error: error.message });
      return [];
    }
  }

  /**
   * Get metrics by type
   */
  async getMetricsByType(type, timeRange = 3600000) { // 1 hour default
    const allMetrics = await this.getMetrics();
    const cutoff = new Date(Date.now() - timeRange);
    
    return allMetrics.filter(metric => 
      metric.type === type && 
      new Date(metric.timestamp) > cutoff
    );
  }

  /**
   * Get performance statistics
   */
  async getPerformanceStats() {
    const metrics = await this.getMetrics();
    const cutoff = new Date(Date.now() - 3600000); // Last hour
    
    const recentMetrics = metrics.filter(m => new Date(m.timestamp) > cutoff);
    
    const stats = {
      ticketCreation: this.calculateStats(recentMetrics.filter(m => m.type === 'ticket_creation')),
      ticketResolution: this.calculateStats(recentMetrics.filter(m => m.type === 'ticket_resolution')),
      discordApi: this.calculateStats(recentMetrics.filter(m => m.type === 'discord_api')),
      database: this.calculateStats(recentMetrics.filter(m => m.type === 'database')),
      redis: this.calculateStats(recentMetrics.filter(m => m.type === 'redis')),
      locks: this.calculateStats(recentMetrics.filter(m => m.type === 'lock')),
      webhooks: this.calculateStats(recentMetrics.filter(m => m.type === 'webhook'))
    };

    return stats;
  }

  /**
   * Calculate statistics for metrics
   */
  calculateStats(metrics) {
    if (metrics.length === 0) {
      return {
        count: 0,
        successRate: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        errorRate: 0
      };
    }

    const successful = metrics.filter(m => m.success);
    const durations = metrics.map(m => m.duration).filter(d => d != null);
    
    return {
      count: metrics.length,
      successRate: (successful.length / metrics.length) * 100,
      avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      errorRate: ((metrics.length - successful.length) / metrics.length) * 100
    };
  }

  /**
   * Get health summary
   */
  async getHealthSummary() {
    const stats = await this.getPerformanceStats();
    const issues = [];

    // Check for performance issues
    if (stats.ticketCreation.avgDuration > 5000) {
      issues.push('Ticket creation slow (>5s avg)');
    }

    if (stats.ticketResolution.avgDuration > 3000) {
      issues.push('Ticket resolution slow (>3s avg)');
    }

    if (stats.discordApi.successRate < 95) {
      issues.push('Discord API success rate low (<95%)');
    }

    if (stats.database.successRate < 98) {
      issues.push('Database success rate low (<98%)');
    }

    if (stats.redis.successRate < 98) {
      issues.push('Redis success rate low (<98%)');
    }

    return {
      status: issues.length === 0 ? 'healthy' : 'degraded',
      issues,
      stats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get active ticket count
   */
  async getActiveTicketCount() {
    try {
      const count = await redisClient.get('ticket:metrics:active_count');
      return count ? parseInt(count) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Update active ticket count
   */
  async updateActiveTicketCount(delta) {
    try {
      const current = await this.getActiveTicketCount();
      const newCount = Math.max(0, current + delta);
      await redisClient.setWithTTL('ticket:metrics:active_count', newCount.toString(), 24 * 60 * 60 * 1000);
      return newCount;
    } catch (error) {
      logger.warn('Failed to update active ticket count', { error: error.message });
      return 0;
    }
  }

  /**
   * Record cleanup job execution
   */
  async recordCleanupJob(jobName, duration, success, result) {
    const metric = {
      type: 'cleanup_job',
      timestamp: new Date().toISOString(),
      jobName,
      duration,
      success,
      result
    };

    await this.addMetric(metric);
    logger.info(`Cleanup job completed: ${jobName}`, { duration, success });
  }

  /**
   * Get cleanup job statistics
   */
  async getCleanupJobStats() {
    const metrics = await this.getMetricsByType('cleanup_job', 24 * 60 * 60 * 1000); // Last 24 hours
    
    const stats = {};
    for (const metric of metrics) {
      if (!stats[metric.jobName]) {
        stats[metric.jobName] = {
          executions: 0,
          successes: 0,
          failures: 0,
          avgDuration: 0,
          durations: []
        };
      }
      
      stats[metric.jobName].executions++;
      if (metric.success) {
        stats[metric.jobName].successes++;
      } else {
        stats[metric.jobName].failures++;
      }
      
      if (metric.duration) {
        stats[metric.jobName].durations.push(metric.duration);
      }
    }

    // Calculate averages
    for (const [jobName, stat] of Object.entries(stats)) {
      if (stat.durations.length > 0) {
        stat.avgDuration = stat.durations.reduce((a, b) => a + b, 0) / stat.durations.length;
      }
      stat.successRate = (stat.successes / stat.executions) * 100;
      delete stat.durations; // Remove raw durations array
    }

    return stats;
  }

  /**
   * Create performance monitor for operations
   */
  createPerformanceMonitor(operation, metadata = {}) {
    const startTime = Date.now();
    
    return {
      end: async (success = true, error = null) => {
        const duration = Date.now() - startTime;
        
        // Record based on operation type
        if (operation.startsWith('ticket:')) {
          const opType = operation.split(':')[1];
          if (opType === 'creation') {
            await this.recordTicketCreation(duration, success, { ...metadata, error });
          } else if (opType === 'resolution') {
            await this.recordTicketResolution(duration, success, { ...metadata, error });
          }
        } else if (operation.startsWith('discord:')) {
          await this.recordDiscordOperation(operation, duration, success, { ...metadata, error });
        } else if (operation.startsWith('database:')) {
          await this.recordDatabaseOperation(operation, duration, success, { ...metadata, error });
        } else if (operation.startsWith('redis:')) {
          await this.recordRedisOperation(operation, duration, success, { ...metadata, error });
        }
        
        return duration;
      }
    };
  }

  /**
   * Export metrics for external monitoring
   */
  async exportMetrics(format = 'json') {
    const stats = await this.getPerformanceStats();
    const health = await this.getHealthSummary();
    const activeCount = await this.getActiveTicketCount();
    
    const exportData = {
      timestamp: new Date().toISOString(),
      activeTickets: activeCount,
      health,
      performance: stats
    };

    if (format === 'prometheus') {
      return this.convertToPrometheusFormat(exportData);
    }

    return exportData;
  }

  /**
   * Convert metrics to Prometheus format
   */
  convertToPrometheusFormat(data) {
    const lines = [];
    
    // Active tickets
    lines.push(`ticket_system_active_tickets ${data.activeTickets}`);
    
    // Performance metrics
    for (const [type, stats] of Object.entries(data.performance)) {
      lines.push(`ticket_system_${type}_operations_total ${stats.count}`);
      lines.push(`ticket_system_${type}_success_rate ${stats.successRate}`);
      lines.push(`ticket_system_${type}_duration_ms ${stats.avgDuration}`);
      lines.push(`ticket_system_${type}_error_rate ${stats.errorRate}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Cleanup old metrics
   */
  async cleanup() {
    try {
      const metrics = await this.getMetrics();
      const cutoff = new Date(Date.now() - this.retentionPeriod);
      
      const filtered = metrics.filter(m => new Date(m.timestamp) > cutoff);
      await redisClient.setWithTTL(this.metricsKey, JSON.stringify(filtered), this.retentionPeriod);
      
      logger.info('Cleaned up old metrics', { removed: metrics.length - filtered.length });
    } catch (error) {
      logger.error('Failed to cleanup metrics', { error: error.message });
    }
  }
}

export const metricsService = new MetricsService();
