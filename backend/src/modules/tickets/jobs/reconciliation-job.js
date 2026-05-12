/**
 * Reconciliation job
 * Periodically synchronizes Discord thread state with the database
 * Ensures tickets module data stays consistent with Discord
 */

import logger from '../services/logging-service.js';

export class ReconciliationJob {
  constructor(reconciliationService, intervalMs = 60 * 60 * 1000) {
    this.reconciliationService = reconciliationService;
    this.intervalMs = intervalMs; // Default: 1 hour
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Starts the reconciliation job
   */
  async start() {
    logger.info('Starting reconciliation job', { intervalMs: this.intervalMs });

    // Run immediately on start
    try {
      await this.run();
    } catch (error) {
      logger.error('Initial reconciliation failed', { error: error.message });
    }

    // Then set up recurring schedule
    this.intervalId = setInterval(async () => {
      try {
        await this.run();
      } catch (error) {
        logger.error('Reconciliation job failed', { error: error.message });
      }
    }, this.intervalMs);
  }

  /**
   * Stops the reconciliation job
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Reconciliation job stopped');
    }
  }

  /**
   * Runs the reconciliation
   */
  async run() {
    if (this.isRunning) {
      logger.debug('Reconciliation already in progress, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      logger.debug('Running reconciliation...');
      const result = await this.reconciliationService.runReconciliation();

      if (result.success) {
        logger.info('Reconciliation completed successfully', {
          durationMs: result.durationMs
        });
      } else {
        logger.error('Reconciliation failed', { error: result.error });
      }
    } catch (error) {
      logger.error('Reconciliation job failed', { error: error.message });
    } finally {
      this.isRunning = false;
    }
  }
}

export default ReconciliationJob;
