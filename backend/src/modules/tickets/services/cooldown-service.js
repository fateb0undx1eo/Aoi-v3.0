/**
 * Cooldown service
 * Business logic for managing ticket creation cooldowns
 */

import logger from './logging-service.js';
import { CooldownError } from '../utils/error-handler.js';

export class CooldownService {
  constructor(cooldownRepository) {
    this.repo = cooldownRepository;
  }

  /**
   * Sets a cooldown for a user after they close a ticket
   */
  async applyCooldown(userId) {
    logger.debug('Applying cooldown', { userId });
    return this.repo.setCooldown(userId);
  }

  /**
   * Checks if a user can create a ticket
   * Throws CooldownError if on cooldown, otherwise returns true
   */
  async checkCooldown(userId) {
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

  /**
   * Gets the cooldown status for a user
   */
  async getCooldownStatus(userId) {
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

  /**
   * Removes a cooldown (admin operation)
   */
  async clearCooldown(userId) {
    logger.info('Clearing cooldown', { userId });
    return this.repo.clearCooldown(userId);
  }

  /**
   * Gets all active cooldowns (admin operation)
   */
  async getAllActiveCooldowns() {
    return this.repo.getAllActiveCooldowns();
  }

  /**
   * Clears all cooldowns (admin operation - use with caution)
   */
  async clearAllCooldowns() {
    logger.warn('Clearing all cooldowns');
    return this.repo.clearAllCooldowns();
  }
}

export default CooldownService;
