import type { Guild } from 'discord.js';
import { fetchMany, fetchOne, upsertRows } from '../database/repository.js';
import { redisClient } from '../core/redis.js';
import { logger } from '../utils/logger.js';

interface GuildSnapshotRow {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
  stats: Record<string, any>;
  updated_at: string;
}

const CACHE_TTL_SECONDS = 300;
const CACHE_PREFIX = 'guild';

export class GuildService {
  async upsertGuildSnapshot(guild: Guild): Promise<void> {
    await upsertRows(
      'guilds',
      {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL(),
        owner_id: guild.ownerId,
        stats: {
          member_count: guild.memberCount,
          boost_level: guild.premiumTier,
          roles_count: guild.roles.cache.size,
          emojis_count: guild.emojis.cache.size,
          channels_count: guild.channels.cache.size
        }
      },
      'id'
    );
    await redisClient.del(`cache:guild:overview:${guild.id}`).catch(() => {});
  }

  async getOverview(guildId: string): Promise<GuildSnapshotRow | null> {
    const cacheKey = `cache:guild:overview:${guildId}`;
    if (redisClient.isReady()) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached) as GuildSnapshotRow;
      } catch {}
    }

    const result = await fetchOne<GuildSnapshotRow>('guilds', (table) =>
      table
        .select('id,name,icon,owner_id,stats,updated_at')
        .eq('id', guildId)
    );

    if (result && redisClient.isReady()) {
      redisClient.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result)).catch(() => {});
    }

    return result;
  }

  async listGuilds(): Promise<GuildSnapshotRow[]> {
    const cacheKey = 'cache:guild:list';
    if (redisClient.isReady()) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached) as GuildSnapshotRow[];
      } catch {}
    }

    const result = await fetchMany<GuildSnapshotRow>('guilds', (table) =>
      table.select('id,name,icon,stats,updated_at').order('updated_at', { ascending: false })
    );

    if (redisClient.isReady()) {
      redisClient.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result)).catch(() => {});
    }

    return result;
  }

  async getGuildSnapshots(guildIds: string[] = []): Promise<GuildSnapshotRow[]> {
    if (!Array.isArray(guildIds) || guildIds.length === 0) return [];

    const batchKeys = guildIds.map(id => `cache:guild:overview:${id}`);
    const results: GuildSnapshotRow[] = [];
    const misses: string[] = [];

    if (redisClient.isReady()) {
      try {
        const cached = await redisClient.mget(...batchKeys);
        for (let i = 0; i < cached.length; i++) {
          const val = cached[i];
          if (val) {
            results.push(JSON.parse(val) as GuildSnapshotRow);
          } else {
            const id = guildIds[i];
            if (id) misses.push(id);
          }
        }
      } catch {
        misses.push(...guildIds);
      }
    } else {
      misses.push(...guildIds);
    }

    if (misses.length > 0) {
      const fetched = await fetchMany<GuildSnapshotRow>('guilds', (table) =>
        table
          .select('id,name,icon,stats,updated_at')
          .in('id', misses)
      );
      results.push(...fetched);
      if (redisClient.isReady()) {
        for (const row of fetched) {
          redisClient.setex(`cache:guild:overview:${row.id}`, CACHE_TTL_SECONDS, JSON.stringify(row)).catch(() => {});
        }
      }
    }

    return results;
  }
}
