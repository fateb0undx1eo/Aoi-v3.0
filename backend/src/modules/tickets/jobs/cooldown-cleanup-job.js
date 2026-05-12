/**
 * Cooldown cleanup job
 * Periodically cleans up expired cooldowns from Redis
 * This runs automatically and doesn't need explicit cleanup since Redis TTLs handle expiration
 */

import logger from '../services/logging-service.js';

export class CooldownCleanupJob {
  constructor(cooldownRepository, intervalMs = 60 * 60 * 1000) {
    this.repo = cooldownRepository;
    this.intervalMs = intervalMs; // Default: 1 hour
    this.intervalId = null;
  }

  /**
   * Starts the cleanup job
   */
  async start() {
    logger.info('Starting cooldown cleanup job', { intervalMs: this.intervalMs });

    this.intervalId = setInterval(async () => {
      try {
        await this.run();
      } catch (error) {
        logger.error('Cooldown cleanup job failed', { error: error.message });
      }
    }, this.intervalMs);
  }

  /**
   * Stops the cleanup job
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Cooldown cleanup job stopped');
    }
  }

  /**
   * Runs the cleanup
   */
  async run() {
    const startTime = Date.now();
    logger.debug('Running cooldown cleanup...');

    try {
      const allCooldowns = await this.repo.getAllActiveCooldowns();

      if (allCooldowns.length === 0) {
        logger.debug('No active cooldowns to clean');
        return;
      }

      // Note: Individual cooldowns expire automatically in Redis via TTL
      // This job mainly serves as a monitoring point
      const duration = Date.now() - startTime;
      logger.info('Cooldown cleanup completed', {
        activeCooldowns: allCooldowns.length,
        durationMs: duration
      });
    } catch (error) {
      logger.error('Cooldown cleanup failed', { error: error.message });
    }
  }
}

export default CooldownCleanupJob;
