import logger from '../services/logging-service.js';
import { TICKET_COOLDOWN_MS } from '../utils/constants.js';
import { isValidDiscordId } from '../utils/validators.js';
import { DatabaseError, ValidationError } from '../utils/error-handler.js';

export class CooldownRepository {
  private db: any;

  constructor(database: any) {
    this.db = database;
  }

  async setCooldown(guildId: string, userId: string): Promise<number> {
    if (!isValidDiscordId(guildId)) throw new ValidationError('Invalid guild ID');
    if (!isValidDiscordId(userId)) throw new ValidationError('Invalid user ID');

    try {
      const now = new Date();
      const cooldownEndsAt = new Date(now.getTime() + TICKET_COOLDOWN_MS);

      await this.db.fetchMany('ticket_cooldowns', (table: any) =>
        table
          .upsert(
            {
              guild_id: guildId,
              user_id: userId,
              closed_at: now.toISOString(),
              cooldown_ends_at: cooldownEndsAt.toISOString(),
            },
            { onConflict: 'guild_id,user_id' }
          )
          .select()
          .limit(1)
      );

      logger.debug('Cooldown set', { guildId, userId });
      return Date.now();
    } catch (error) {
      logger.error('Failed to set cooldown', { guildId, userId, error: (error as Error).message });
      throw new DatabaseError('Failed to set cooldown', { guildId, userId });
    }
  }

  async getRemainingCooldown(guildId: string, userId: string): Promise<number> {
    if (!isValidDiscordId(guildId)) throw new ValidationError('Invalid guild ID');
    if (!isValidDiscordId(userId)) throw new ValidationError('Invalid user ID');

    try {
      // Clean expired cooldowns on read
      await this.db.fetchMany('ticket_cooldowns', (table: any) =>
        table.delete().lt('cooldown_ends_at', new Date().toISOString())
      ).catch(() => {});

      const rows = await this.db.fetchMany('ticket_cooldowns', (table: any) =>
        table
          .select('cooldown_ends_at')
          .eq('guild_id', guildId)
          .eq('user_id', userId)
          .gte('cooldown_ends_at', new Date().toISOString())
          .limit(1)
      );

      if (!rows || rows.length === 0) return 0;

      const endsAt = new Date(rows[0].cooldown_ends_at).getTime();
      const remaining = endsAt - Date.now();
      return remaining > 0 ? remaining : 0;
    } catch (error) {
      logger.error('Failed to get remaining cooldown', { guildId, userId, error: (error as Error).message });
      throw new DatabaseError('Failed to get remaining cooldown', { guildId, userId });
    }
  }

  async isOnCooldown(guildId: string, userId: string): Promise<boolean> {
    const remaining = await this.getRemainingCooldown(guildId, userId);
    return remaining > 0;
  }

  async getCooldownExpiration(guildId: string, userId: string): Promise<number | null> {
    const remaining = await this.getRemainingCooldown(guildId, userId);
    return remaining > 0 ? Date.now() + remaining : null;
  }

  async clearCooldown(guildId: string, userId: string): Promise<void> {
    if (!isValidDiscordId(guildId)) throw new ValidationError('Invalid guild ID');
    if (!isValidDiscordId(userId)) throw new ValidationError('Invalid user ID');

    try {
      await this.db.fetchMany('ticket_cooldowns', (table: any) =>
        table.delete().eq('guild_id', guildId).eq('user_id', userId)
      );
      logger.debug('Cooldown cleared', { guildId, userId });
    } catch (error) {
      logger.error('Failed to clear cooldown', { guildId, userId, error: (error as Error).message });
      throw new DatabaseError('Failed to clear cooldown', { guildId, userId });
    }
  }

  async getAllActiveCooldowns(): Promise<Array<{ guildId: string; userId: string; closedAt: number }>> {
    try {
      const rows = await this.db.fetchMany('ticket_cooldowns', (table: any) =>
        table
          .select('guild_id, user_id, closed_at')
          .gte('cooldown_ends_at', new Date().toISOString())
      );

      return (rows || []).map((row: any) => ({
        guildId: String(row.guild_id),
        userId: String(row.user_id),
        closedAt: new Date(row.closed_at).getTime(),
      }));
    } catch (error) {
      logger.error('Failed to fetch all active cooldowns', { error: (error as Error).message });
      throw new DatabaseError('Failed to fetch all active cooldowns');
    }
  }

  async clearAllCooldowns(): Promise<number> {
    try {
      const rows = await this.db.fetchMany('ticket_cooldowns', (table: any) =>
        table.delete().gte('cooldown_ends_at', new Date().toISOString()).select('id')
      );
      return (rows || []).length;
    } catch (error) {
      logger.error('Failed to clear all cooldowns', { error: (error as Error).message });
      throw new DatabaseError('Failed to clear all cooldowns');
    }
  }
}

export default CooldownRepository;
