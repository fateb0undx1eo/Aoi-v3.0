/**
 * Metrics service - tracks performance and usage statistics
 */

import logger from './logging-service.js';
import { REDIS_KEYS } from '../utils/redis-keys.js';

export class MetricsService {
  constructor(redis) {
    this.redis = redis;
    this.localMetrics = {
      ticketsCreated: 0,
      ticketsResolved: 0,
      errorsOccurred: 0,
      averageCreationTime: 0
    };
  }

  /**
   * Records a ticket creation event
   */
  async recordTicketCreation(metadata = {}) {
    try {
      this.localMetrics.ticketsCreated++;

      // Increment Redis counter
      const key = REDIS_KEYS.metrics('tickets_created', 'daily');
      await this.redis.incr(key).catch(() => null);

      logger.debug('Ticket creation recorded', metadata);
    } catch (error) {
      logger.error('Failed to record ticket creation', { error: error.message });
    }
  }

  /**
   * Records a ticket resolution event
   */
  async recordTicketResolution(metadata = {}) {
    try {
      this.localMetrics.ticketsResolved++;

      const key = REDIS_KEYS.metrics('tickets_resolved', 'daily');
      await this.redis.incr(key).catch(() => null);

      logger.debug('Ticket resolution recorded', metadata);
    } catch (error) {
      logger.error('Failed to record ticket resolution', { error: error.message });
    }
  }

  /**
   * Records an error event
   */
  async recordError(errorType = 'general', metadata = {}) {
    try {
      this.localMetrics.errorsOccurred++;

      const key = REDIS_KEYS.metrics(`errors_${errorType}`, 'daily');
      await this.redis.incr(key).catch(() => null);

      logger.warn('Error recorded', { errorType, ...metadata });
    } catch (error) {
      logger.error('Failed to record error', { error: error.message });
    }
  }

  /**
   * Records operation timing
   */
  async recordOperationTime(operation, durationMs) {
    try {
      const key = REDIS_KEYS.metrics(`operation_${operation}`, 'daily');
      
      // Store as a space-separated list of durations (for average calculation)
      await this.redis.append(key, `${durationMs} `).catch(() => null);

      logger.debug('Operation time recorded', { operation, durationMs });
    } catch (error) {
      logger.error('Failed to record operation time', { error: error.message });
    }
  }

  /**
   * Gets current metrics snapshot
   */
  async getMetricsSnapshot() {
    try {
      const today = new Date().toISOString().split('T')[0];

      const created = await this.redis.get(REDIS_KEYS.metrics('tickets_created', 'daily')).catch(() => '0');
      const resolved = await this.redis.get(REDIS_KEYS.metrics('tickets_resolved', 'daily')).catch(() => '0');
      const errors = await this.redis.get(REDIS_KEYS.metrics('errors_general', 'daily')).catch(() => '0');

      return {
        date: today,
        ticketsCreated: parseInt(created, 10) || 0,
        ticketsResolved: parseInt(resolved, 10) || 0,
        errorsRecorded: parseInt(errors, 10) || 0,
        localMetrics: this.localMetrics
      };
    } catch (error) {
      logger.error('Failed to get metrics snapshot', { error: error.message });
      return null;
    }
  }

  /**
   * Resets local metrics
   */
  resetLocalMetrics() {
    this.localMetrics = {
      ticketsCreated: 0,
      ticketsResolved: 0,
      errorsOccurred: 0,
      averageCreationTime: 0
    };
  }
}

export default MetricsService;
