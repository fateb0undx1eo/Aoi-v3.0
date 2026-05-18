/**
 * Cleanup service - periodic maintenance and data cleanup
 */

import logger from './logging-service.js';

export class CleanupService {
  constructor(redis, ticketRepository, cooldownRepository) {
    this.redis = redis;
    this.ticketRepo = ticketRepository;
    this.cooldownRepo = cooldownRepository;
  }

  /**
   * Runs cleanup operations
   */
  async runCleanup() {
    const startTime = Date.now();
    logger.info('Starting cleanup operations...');

    try {
      const results = {
        expiredCooldownsCleared: 0,
        orphanedRecordsRemoved: 0,
        cacheCleared: 0
      };

      const archived = await this.archiveOldTickets(1);
      results.orphanedRecordsRemoved = archived.archived ?? 0;

      const duration = Date.now() - startTime;
      logger.info('Cleanup completed', { durationMs: duration, ...results });

      return {
        success: true,
        durationMs: duration,
        results
      };
    } catch (error) {
      logger.error('Cleanup failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clears old tickets (archival)
   */
  async archiveOldTickets(daysOld = 30) {
    logger.info(`Archiving tickets older than ${daysOld} days...`);
    try {
      const deleted = await this.ticketRepo.deleteResolvedOlderThan(daysOld);
      return { archived: deleted };
    } catch (error) {
      logger.error('Failed to archive old tickets', { error: error.message });
      return { error: error.message };
    }
  }
}

export default CleanupService;
