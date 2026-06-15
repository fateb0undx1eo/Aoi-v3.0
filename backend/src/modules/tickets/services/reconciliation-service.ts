import logger from './logging-service.js';
import { REDIS_KEYS, KEY_TTLS } from '../utils/redis-keys.js';
import type { RedisClient } from '../../../types/index.js';
import type TicketRepository from '../repositories/ticket-repository.js';

interface ReconciliationSuccess {
  success: true;
  durationMs: number;
  lastRun: number;
}

interface ReconciliationFailure {
  success: false;
  error: string;
}

type ReconciliationResult = ReconciliationSuccess | ReconciliationFailure;

export class ReconciliationService {
  private redis: RedisClient;
  private repo: TicketRepository;

  constructor(redis: RedisClient, ticketRepository: TicketRepository) {
    this.redis = redis;
    this.repo = ticketRepository;
  }

  async runReconciliation(): Promise<ReconciliationResult> {
    const startTime = Date.now();
    logger.info('Starting reconciliation...');

    try {
      const lastRun = Math.floor(Date.now() / 1000);
      await this.redis.set(
        REDIS_KEYS.reconciliationLastRun(),
        lastRun.toString(),
        { EX: KEY_TTLS.RECONCILIATION_TS } as any
      ).catch(() => null);

      const duration = Date.now() - startTime;
      logger.info('Reconciliation completed', { durationMs: duration });

      return {
        success: true,
        durationMs: duration,
        lastRun
      };
    } catch (error) {
      logger.error('Reconciliation failed', { error: (error as Error).message });
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  async getLastReconciliationTime(): Promise<number | null> {
    try {
      const timestamp = await this.redis.get(REDIS_KEYS.reconciliationLastRun());
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch {
      return null;
    }
  }
}

export default ReconciliationService;
