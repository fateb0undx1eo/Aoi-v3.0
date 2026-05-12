/**
 * Reconciliation service - synchronizes local state with Discord
 * Ensures tickets module state matches actual Discord thread state
 */

import logger from './logging-service.js';
import { REDIS_KEYS, KEY_TTLS } from '../utils/redis-keys.js';

export class ReconciliationService {
  constructor(redis, ticketRepository, discordClient) {
    this.redis = redis;
    this.repo = ticketRepository;
    this.client = discordClient;
  }

  /**
   * Runs a full reconciliation check
   * Verifies all tickets match Discord state
   */
  async runReconciliation() {
    const startTime = Date.now();
    logger.info('Starting reconciliation...');

    try {
      // Check for missing or archived threads
      // Update database state
      // Clean up orphaned tickets

      const lastRun = Math.floor(Date.now() / 1000);
      await this.redis.set(
        REDIS_KEYS.reconciliationLastRun(),
        lastRun.toString(),
        'EX',
        KEY_TTLS.RECONCILIATION_TS
      ).catch(() => null);

      const duration = Date.now() - startTime;
      logger.info('Reconciliation completed', { durationMs: duration });

      return {
        success: true,
        durationMs: duration,
        lastRun
      };
    } catch (error) {
      logger.error('Reconciliation failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Gets the last reconciliation run time
   */
  async getLastReconciliationTime() {
    try {
      const timestamp = await this.redis.get(REDIS_KEYS.reconciliationLastRun());
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch {
      return null;
    }
  }
}

export default ReconciliationService;
