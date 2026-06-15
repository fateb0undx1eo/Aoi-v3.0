import logger from '../services/logging-service.js';
import type CooldownRepository from '../repositories/cooldown-repository.js';

export class CooldownCleanupJob {
  private repo: CooldownRepository;
  private intervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(cooldownRepository: CooldownRepository, intervalMs: number = 60 * 60 * 1000) {
    this.repo = cooldownRepository;
    this.intervalMs = intervalMs;
  }

  async start(): Promise<void> {
    logger.info('Starting cooldown cleanup job', { intervalMs: this.intervalMs });

    this.intervalId = setInterval(async () => {
      try {
        await this.run();
      } catch (error) {
        logger.error('Cooldown cleanup job failed', { error: (error as Error).message });
      }
    }, this.intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Cooldown cleanup job stopped');
    }
  }

  async run(): Promise<void> {
    const startTime = Date.now();
    logger.debug('Running cooldown cleanup...');

    try {
      const allCooldowns = await this.repo.getAllActiveCooldowns();

      if (allCooldowns.length === 0) {
        logger.debug('No active cooldowns to clean');
        return;
      }

      let cleaned = 0;
      for (const cd of allCooldowns) {
        const elapsed = Date.now() - cd.closedAt;
        const cooldownMs = 10 * 60 * 1000; // matches TICKET_COOLDOWN_MS
        if (elapsed >= cooldownMs) {
          await this.repo.clearCooldown(cd.guildId, cd.userId);
          cleaned++;
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Cooldown cleanup completed', {
        activeCooldowns: allCooldowns.length,
        cleaned,
        durationMs: duration
      });
    } catch (error) {
      logger.error('Cooldown cleanup failed', { error: (error as Error).message });
    }
  }
}

export default CooldownCleanupJob;
