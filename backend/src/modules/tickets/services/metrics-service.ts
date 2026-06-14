import logger from './logging-service.js';
import { REDIS_KEYS } from '../utils/redis-keys.js';
import type { RedisClient } from '../../../types/index.js';

interface LocalMetrics {
  ticketsCreated: number;
  ticketsResolved: number;
  errorsOccurred: number;
  averageCreationTime: number;
}

export class MetricsService {
  private redis: RedisClient;
  private localMetrics: LocalMetrics;

  constructor(redis: RedisClient) {
    this.redis = redis;
    this.localMetrics = {
      ticketsCreated: 0,
      ticketsResolved: 0,
      errorsOccurred: 0,
      averageCreationTime: 0
    };
  }

  async recordTicketCreation(metadata: Record<string, unknown> = {}): Promise<void> {
    try {
      this.localMetrics.ticketsCreated++;

      const key = REDIS_KEYS.metrics('tickets_created', 'daily');
      await this.redis.incr(key).catch(() => null);

      logger.debug('Ticket creation recorded', metadata);
    } catch (error) {
      logger.error('Failed to record ticket creation', { error: (error as Error).message });
    }
  }

  async recordTicketResolution(metadata: Record<string, unknown> = {}): Promise<void> {
    try {
      this.localMetrics.ticketsResolved++;

      const key = REDIS_KEYS.metrics('tickets_resolved', 'daily');
      await this.redis.incr(key).catch(() => null);

      logger.debug('Ticket resolution recorded', metadata);
    } catch (error) {
      logger.error('Failed to record ticket resolution', { error: (error as Error).message });
    }
  }

  async recordError(errorType: string = 'general', metadata: Record<string, unknown> = {}): Promise<void> {
    try {
      this.localMetrics.errorsOccurred++;

      const key = REDIS_KEYS.metrics(`errors_${errorType}`, 'daily');
      await this.redis.incr(key).catch(() => null);

      logger.warn('Error recorded', { errorType, ...metadata });
    } catch (error) {
      logger.error('Failed to record error', { error: (error as Error).message });
    }
  }

  async recordOperationTime(operation: string, durationMs: number): Promise<void> {
    try {
      const key = REDIS_KEYS.metrics(`operation_${operation}`, 'daily');

      await this.redis.append(key, `${durationMs} `).catch(() => null);

      logger.debug('Operation time recorded', { operation, durationMs });
    } catch (error) {
      logger.error('Failed to record operation time', { error: (error as Error).message });
    }
  }

  async getMetricsSnapshot(): Promise<{
    date: string;
    ticketsCreated: number;
    ticketsResolved: number;
    errorsRecorded: number;
    localMetrics: LocalMetrics;
  } | null> {
    try {
      const today = new Date().toISOString().split('T')[0]!;

      const created = await this.redis.get(REDIS_KEYS.metrics('tickets_created', 'daily')).catch(() => '0');
      const resolved = await this.redis.get(REDIS_KEYS.metrics('tickets_resolved', 'daily')).catch(() => '0');
      const errors = await this.redis.get(REDIS_KEYS.metrics('errors_general', 'daily')).catch(() => '0');

      return {
        date: today,
        ticketsCreated: parseInt(created as string, 10) || 0,
        ticketsResolved: parseInt(resolved as string, 10) || 0,
        errorsRecorded: parseInt(errors as string, 10) || 0,
        localMetrics: this.localMetrics
      };
    } catch (error) {
      logger.error('Failed to get metrics snapshot', { error: (error as Error).message });
      return null;
    }
  }

  resetLocalMetrics(): void {
    this.localMetrics = {
      ticketsCreated: 0,
      ticketsResolved: 0,
      errorsOccurred: 0,
      averageCreationTime: 0
    };
  }
}

export default MetricsService;
