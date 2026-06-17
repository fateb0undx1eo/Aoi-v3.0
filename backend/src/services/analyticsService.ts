import { deleteWhere, fetchMany, upsertRows } from '../database/repository.js';
import { redisClient } from '../core/redis.js';
import { format, subDays } from 'date-fns';

interface AnalyticsRow {
  guild_id: string;
  date_bucket: string;
  metrics: Record<string, any>;
  created_at: string;
}

const CACHE_TTL_SECONDS = 3600;
const CACHE_PREFIX = 'analytics';

export class AnalyticsService {
  async recordDaily(guildId: string, payload: Record<string, any>): Promise<void> {
    const date = format(new Date(), 'yyyy-MM-dd');
    await upsertRows(
      'analytics',
      {
        guild_id: guildId,
        date_bucket: date,
        metrics: payload
      },
      'guild_id,date_bucket'
    );
    await redisClient.del(`cache:${CACHE_PREFIX}:last30:${guildId}`).catch(() => {});
  }

  async getLast30Days(guildId: string): Promise<AnalyticsRow[]> {
    const cacheKey = `cache:${CACHE_PREFIX}:last30:${guildId}`;
    if (redisClient.isReady()) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached) as AnalyticsRow[];
      } catch {}
    }

    const since = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const result = await fetchMany<AnalyticsRow>('analytics', (table) =>
      table
        .select('guild_id,date_bucket,metrics,created_at')
        .eq('guild_id', guildId)
        .gte('date_bucket', since)
        .order('date_bucket', { ascending: true })
    );

    if (redisClient.isReady()) {
      redisClient.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result)).catch(() => {});
    }

    return result;
  }

  async cleanupOlderThan30Days(): Promise<void> {
    const cutoff = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    await deleteWhere('analytics', (table: any) => table.lt('date_bucket', cutoff));
    if (redisClient.isReady()) {
      try {
        const keys = await redisClient.keys('cache:analytics:last30:*');
        if (keys.length > 0) await redisClient.del(...keys);
      } catch {}
    }
  }
}
