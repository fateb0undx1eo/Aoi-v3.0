import logger from '../services/logging-service.js';
import type ReconciliationService from '../services/reconciliation-service.js';

export class ReconciliationJob {
  private reconciliationService: ReconciliationService;
  private intervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(reconciliationService: ReconciliationService, intervalMs: number = 60 * 60 * 1000) {
    this.reconciliationService = reconciliationService;
    this.intervalMs = intervalMs;
  }

  async start(): Promise<void> {
    logger.info('Starting reconciliation job', { intervalMs: this.intervalMs });

    try {
      await this.run();
    } catch (error) {
      logger.error('Initial reconciliation failed', { error: (error as Error).message });
    }

    this.intervalId = setInterval(async () => {
      try {
        await this.run();
      } catch (error) {
        logger.error('Reconciliation job failed', { error: (error as Error).message });
      }
    }, this.intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Reconciliation job stopped');
    }
  }

  async run(): Promise<void> {
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
      logger.error('Reconciliation job failed', { error: (error as Error).message });
    } finally {
      this.isRunning = false;
    }
  }
}

export default ReconciliationJob;
