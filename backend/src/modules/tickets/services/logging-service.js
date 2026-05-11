import { redisClient } from '../../../core/redis.js';
import { LOG_KEYS, METRICS_KEYS } from '../utils/redis-keys.js';
import { LOGGING, METRICS } from '../utils/constants.js';

/**
 * Enterprise-grade logging service
 * Uses Redis lists for structured, non-overwriting logs
 */

export class LoggingService {
  /**
   * Log structured event with correlation ID
   * @param {Object} logData - Log data
   */
  async log(logData) {
    const {
      level = 'info',
      operation,
      guildId,
      threadId,
      userId,
      interactionId,
      requestId,
      message,
      metadata = {},
      timestamp = new Date().toISOString()
    } = logData;

    const logEntry = {
      level,
      operation,
      guildId,
      threadId,
      userId,
      interactionId,
      requestId,
      message,
      metadata,
      timestamp
    };

    // Store in Redis list (non-overwriting)
    const logKey = LOG_KEYS.operation(level);
    await redisClient.lPush(logKey, JSON.stringify(logEntry));
    
    // Trim to keep only latest entries
    await redisClient.lTrim(logKey, 0, LOGGING.MAX_ENTRIES - 1);
    
    // Set expiration for log retention
    await redisClient.expire(logKey, LOGGING.RETENTION_HOURS * 3600);

    // Also log to console for development
    this.logToConsole(logEntry);
  }

  /**
   * Log error with structured data
   * @param {Object} errorData - Error data
   */
  async error(errorData) {
    await this.log({
      level: 'error',
      ...errorData
    });

    // Track error metrics
    await this.trackMetric('error', {
      operation: errorData.operation,
      guildId: errorData.guildId,
      error: errorData.error?.message || 'Unknown error'
    });
  }

  /**
   * Log warning
   * @param {Object} warningData - Warning data
   */
  async warn(warningData) {
    await this.log({
      level: 'warn',
      ...warningData
    });
  }

  /**
   * Log info
   * @param {Object} infoData - Info data
   */
  async info(infoData) {
    await this.log({
      level: 'info',
      ...infoData
    });
  }

  /**
   * Log debug
   * @param {Object} debugData - Debug data
   */
  async debug(debugData) {
    await this.log({
      level: 'debug',
      ...debugData
    });
  }

  /**
   * Track operation metrics
   * @param {string} operation - Operation name
   * @param {Object} metricData - Metric data
   */
  async trackMetric(operation, metricData) {
    const {
      duration,
      guildId,
      threadId,
      userId,
      success = true,
      error = null,
      timestamp = new Date().toISOString()
    } = metricData;

    const metricEntry = {
      operation,
      duration,
      guildId,
      threadId,
      userId,
      success,
      error,
      timestamp
    };

    // Store in Redis list
    const metricKey = METRICS_KEYS.operation(operation);
    await redisClient.lPush(metricKey, JSON.stringify(metricEntry));
    
    // Trim to keep only latest entries
    await redisClient.lTrim(metricKey, 0, METRICS.MAX_ENTRIES - 1);
    
    // Set expiration for metric retention
    await redisClient.expire(metricKey, METRICS.RETENTION_HOURS * 3600);
  }

  /**
   * Get recent logs
   * @param {string} level - Log level (optional)
   * @param {number} count - Number of logs to retrieve
   * @returns {Promise<Array>} Array of log entries
   */
  async getRecentLogs(level = 'info', count = 50) {
    const logKey = LOG_KEYS.operation(level);
    const logs = await redisClient.lRange(logKey, 0, count - 1);
    
    return logs.map(log => {
      try {
        return JSON.parse(log);
      } catch (error) {
        return { raw: log, parseError: error.message };
      }
    });
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
   * Get log statistics
   * @param {string} level - Log level (optional)
   * @returns {Promise<Object>} Log statistics
   */
  async getLogStatistics(level = null) {
    const keys = level ? [LOG_KEYS.operation(level)] : Object.values(LOGGING.LEVELS).map(l => LOG_KEYS.operation(l));
    
    const stats = {};
    
    for (const key of keys) {
      const count = await redisClient.lLen(key);
      const keyLevel = key.split(':').pop();
      stats[keyLevel] = count;
    }
    
    return stats;
  }

  /**
   * Get metric statistics for operation
   * @param {string} operation - Operation name
   * @returns {Promise<Object>} Metric statistics
   */
  async getMetricStatistics(operation) {
    const metrics = await this.getRecentMetrics(operation, 100);
    
    if (metrics.length === 0) {
      return {
        count: 0,
        successRate: 0,
        averageDuration: 0,
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
      errorCount,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0
    };
  }

  /**
   * Clear logs for level
   * @param {string} level - Log level
   */
  async clearLogs(level) {
    const logKey = LOG_KEYS.operation(level);
    await redisClient.delete(logKey);
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
   * Archive old logs
   * @param {number} olderThanHours - Archive logs older than this many hours
   */
  async archiveOldLogs(olderThanHours = 24) {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();
    
    for (const level of Object.values(LOGGING.LEVELS)) {
      const logKey = LOG_KEYS.operation(level);
      const logs = await redisClient.lRange(logKey, 0, -1);
      
      const filteredLogs = logs.filter(log => {
        try {
          const parsed = JSON.parse(log);
          return new Date(parsed.timestamp) >= new Date(cutoffTime);
        } catch (error) {
          return false; // Remove invalid logs
        }
      });
      
      // Clear and repopulate with filtered logs
      await redisClient.delete(logKey);
      
      for (const log of filteredLogs.reverse()) { // Reverse to maintain order
        await redisClient.lPush(logKey, log);
      }
      
      // Trim to max entries
      await redisClient.lTrim(logKey, 0, LOGGING.MAX_ENTRIES - 1);
    }
  }

  /**
   * Generate correlation ID for request tracking
   * @returns {string} Correlation ID
   */
  generateCorrelationId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log to console with formatting
   * @param {Object} logEntry - Log entry
   */
  logToConsole(logEntry) {
    const { level, operation, guildId, threadId, userId, message, timestamp } = logEntry;
    
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${operation}]`;
    const context = guildId ? ` G:${guildId}` : '';
    const userContext = userId ? ` U:${userId}` : '';
    const threadContext = threadId ? ` T:${threadId}` : '';
    
    const fullMessage = `${prefix}${context}${userContext}${threadContext} - ${message}`;
    
    switch (level) {
      case 'error':
        console.error(fullMessage, logEntry.metadata);
        break;
      case 'warn':
        console.warn(fullMessage, logEntry.metadata);
        break;
      case 'debug':
        console.debug(fullMessage, logEntry.metadata);
        break;
      default:
        console.log(fullMessage, logEntry.metadata);
    }
  }

  /**
   * Create logging context for interaction
   * @param {Object} interaction - Discord interaction
   * @returns {Object} Logging context
   */
  createInteractionContext(interaction) {
    return {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      interactionId: interaction.id,
      requestId: this.generateCorrelationId()
    };
  }

  /**
   * Log interaction start
   * @param {Object} interaction - Discord interaction
   * @param {string} operation - Operation name
   */
  async logInteractionStart(interaction, operation) {
    const context = this.createInteractionContext(interaction);
    
    await this.info({
      operation,
      ...context,
      message: `Interaction started: ${operation}`,
      metadata: {
        commandName: interaction.commandName,
        customId: interaction.customId
      }
    });
    
    return context;
  }

  /**
   * Log interaction completion
   * @param {Object} context - Interaction context
   * @param {string} operation - Operation name
   * @param {Object} result - Operation result
   */
  async logInteractionComplete(context, operation, result = {}) {
    await this.info({
      operation,
      ...context,
      message: `Interaction completed: ${operation}`,
      metadata: {
        success: result.success ?? true,
        duration: result.duration,
        response: result.response
      }
    });
  }
}

// Export singleton instance
export const loggingService = new LoggingService();
