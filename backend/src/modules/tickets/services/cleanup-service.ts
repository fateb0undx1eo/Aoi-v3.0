import logger from './logging-service.js';
import type TicketRepository from '../repositories/ticket-repository.js';
import type CooldownRepository from '../repositories/cooldown-repository.js';
import type { RedisClient } from '../../../types/index.js';

interface CleanupResults {
  expiredCooldownsCleared: number;
  orphanedRecordsRemoved: number;
  cacheCleared: number;
}

interface CleanupResponse {
  success: boolean;
  durationMs: number;
  results: CleanupResults;
}

interface ErrorResponse {
  success: false;
  error: string;
}

export class CleanupService {
  private redis: RedisClient;
  private ticketRepo: TicketRepository;
  private cooldownRepo: CooldownRepository;

  constructor(redis: RedisClient, ticketRepository: TicketRepository, cooldownRepository: CooldownRepository) {
    this.redis = redis;
    this.ticketRepo = ticketRepository;
    this.cooldownRepo = cooldownRepository;
  }

  async runCleanup(): Promise<CleanupResponse | { success: false; error: string }> {
    const startTime = Date.now();
    logger.info('Starting cleanup operations...');

    try {
      const results: CleanupResults = {
        expiredCooldownsCleared: 0,
        orphanedRecordsRemoved: 0,
        cacheCleared: 0
      };

      const archived = await this.archiveOldTickets(1);
      results.orphanedRecordsRemoved = (archived as any).archived ?? 0;

      const duration = Date.now() - startTime;
      logger.info('Cleanup completed', { durationMs: duration, ...results });

      return {
        success: true,
        durationMs: duration,
        results
      };
    } catch (error) {
      logger.error('Cleanup failed', { error: (error as Error).message });
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  async archiveOldTickets(daysOld: number = 30): Promise<{ archived: number } | { error: string }> {
    logger.info(`Archiving tickets older than ${daysOld} days...`);
    try {
      const deleted = await this.ticketRepo.deleteResolvedOlderThan(daysOld);
      return { archived: deleted };
    } catch (error) {
      logger.error('Failed to archive old tickets', { error: (error as Error).message });
      return { error: (error as Error).message };
    }
  }
}

export default CleanupService;
