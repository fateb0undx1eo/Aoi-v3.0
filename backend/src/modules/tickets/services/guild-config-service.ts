import logger from './logging-service.js';
import { REDIS_KEYS, KEY_TTLS } from '../utils/redis-keys.js';
import { DEFAULT_GUILD_CONFIG } from '../utils/constants.js';
import type { TicketGuildConfig } from '../utils/constants.js';
import type { RedisClient } from '../../../types/index.js';

const CACHE_PREFIX = 'tickets:guild_config:';

export class GuildConfigService {
  private redis: RedisClient;
  private db: any;

  constructor(redis: RedisClient, database: any) {
    this.redis = redis;
    this.db = database;
  }

  async getConfig(guildId: string): Promise<TicketGuildConfig> {
    try {
      const cached = await this.redis.get(`${CACHE_PREFIX}${guildId}`).catch(() => null);
      if (cached) {
        try {
          return { ...DEFAULT_GUILD_CONFIG, ...JSON.parse(cached as string) };
        } catch {}
      }

      const config = await this.loadFromDatabase(guildId);

      await this.redis.setex(
        `${CACHE_PREFIX}${guildId}`,
        KEY_TTLS.WEBHOOK_CACHE,
        JSON.stringify(config)
      ).catch(() => null);

      return { ...DEFAULT_GUILD_CONFIG, ...config };
    } catch (error) {
      logger.warn('Failed to load guild config, using defaults', { guildId, error: (error as Error).message });
      return { ...DEFAULT_GUILD_CONFIG };
    }
  }

  async setConfig(guildId: string, config: Partial<TicketGuildConfig>): Promise<void> {
    try {
      const existing = await this.loadFromDatabase(guildId);
      const merged = { ...existing, ...config };

      // Upsert into database
      await this.db.fetchMany('ticket_configs', (table: any) =>
        table
          .upsert({
            guild_id: guildId,
            staff_role_ids: merged.staffRoleIds,
            log_channel_id: merged.logChannelId,
            add_staff_to_thread: merged.addStaffToThread,
            cooldown_ms: merged.cooldownMs,
            auto_archive_24h: merged.autoArchive24h,
            auto_archive_1h: merged.autoArchive1h
          })
          .select()
      );

      // Update cache
      await this.redis.setex(
        `${CACHE_PREFIX}${guildId}`,
        KEY_TTLS.WEBHOOK_CACHE,
        JSON.stringify(merged)
      ).catch(() => null);

      logger.info('Guild config updated', { guildId });
    } catch (error) {
      logger.error('Failed to set guild config', { guildId, error: (error as Error).message });
      throw error;
    }
  }

  private async loadFromDatabase(guildId: string): Promise<Partial<TicketGuildConfig>> {
    try {
      const rows = await this.db.fetchMany('ticket_configs', (table: any) =>
        table.select('*').eq('guild_id', guildId).limit(1)
      );

      if (rows?.[0]) {
        const row = rows[0];
        return {
          staffRoleIds: row.staff_role_ids || DEFAULT_GUILD_CONFIG.staffRoleIds,
          logChannelId: row.log_channel_id || DEFAULT_GUILD_CONFIG.logChannelId,
          addStaffToThread: row.add_staff_to_thread ?? DEFAULT_GUILD_CONFIG.addStaffToThread,
          cooldownMs: row.cooldown_ms || DEFAULT_GUILD_CONFIG.cooldownMs,
          autoArchive24h: row.auto_archive_24h || DEFAULT_GUILD_CONFIG.autoArchive24h,
          autoArchive1h: row.auto_archive_1h || DEFAULT_GUILD_CONFIG.autoArchive1h
        };
      }
    } catch (error) {
      logger.warn('Failed to load guild config from DB', { guildId, error: (error as Error).message });
    }
    return {};
  }
}

export default GuildConfigService;
