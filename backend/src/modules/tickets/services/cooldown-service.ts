import logger from './logging-service.js';
import { CooldownError } from '../utils/error-handler.js';
import type CooldownRepository from '../repositories/cooldown-repository.js';

export interface CooldownStatus {
  isOnCooldown: boolean;
  remainingMs: number;
  expiresAt: number | null;
  expiresAtUnix: number | null;
}

export class CooldownService {
  private repo: CooldownRepository;

  constructor(cooldownRepository: CooldownRepository) {
    this.repo = cooldownRepository;
  }

  async applyCooldown(userId: string): Promise<number> {
    logger.debug('Applying cooldown', { userId });
    return this.repo.setCooldown(userId);
  }

  async checkCooldown(userId: string): Promise<true> {
    const remaining = await this.repo.getRemainingCooldown(userId);

    if (remaining > 0) {
      const readyAt = Math.floor((Date.now() + remaining) / 1000);
      throw new CooldownError(
        `You recently closed a ticket. You can open another <t:${readyAt}:R>.`,
        readyAt,
        { userId, remainingMs: remaining }
      );
    }

    return true;
  }

  async getCooldownStatus(userId: string): Promise<CooldownStatus> {
    const remaining = await this.repo.getRemainingCooldown(userId);
    const isOnCooldown = remaining > 0;
    const expiresAt = isOnCooldown ? Date.now() + remaining : null;

    return {
      isOnCooldown,
      remainingMs: remaining,
      expiresAt,
      expiresAtUnix: expiresAt ? Math.floor(expiresAt / 1000) : null
    };
  }

  async clearCooldown(userId: string): Promise<void> {
    logger.info('Clearing cooldown', { userId });
    return this.repo.clearCooldown(userId);
  }

  async getAllActiveCooldowns(): Promise<Array<{ userId: string; closedAt: number }>> {
    return this.repo.getAllActiveCooldowns();
  }

  async clearAllCooldowns(): Promise<number> {
    logger.warn('Clearing all cooldowns');
    return this.repo.clearAllCooldowns();
  }
}

export default CooldownService;
