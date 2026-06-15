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

  async applyCooldown(guildId: string, userId: string): Promise<number> {
    logger.debug('Applying cooldown', { guildId, userId });
    return this.repo.setCooldown(guildId, userId);
  }

  async checkCooldown(guildId: string, userId: string): Promise<true> {
    const remaining = await this.repo.getRemainingCooldown(guildId, userId);

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

  async getCooldownStatus(guildId: string, userId: string): Promise<CooldownStatus> {
    const remaining = await this.repo.getRemainingCooldown(guildId, userId);
    const isOnCooldown = remaining > 0;
    const expiresAt = isOnCooldown ? Date.now() + remaining : null;

    return {
      isOnCooldown,
      remainingMs: remaining,
      expiresAt,
      expiresAtUnix: expiresAt ? Math.floor(expiresAt / 1000) : null
    };
  }

  async clearCooldown(guildId: string, userId: string): Promise<void> {
    logger.info('Clearing cooldown', { guildId, userId });
    return this.repo.clearCooldown(guildId, userId);
  }

  async getAllActiveCooldowns(): Promise<Array<{ guildId: string; userId: string; closedAt: number }>> {
    return this.repo.getAllActiveCooldowns();
  }

  async clearAllCooldowns(): Promise<number> {
    logger.warn('Clearing all cooldowns');
    return this.repo.clearAllCooldowns();
  }
}

export default CooldownService;
