import { deleteWhere, fetchMany, upsertRows } from '../database/repository.js';

export class AnalyticsService {
  async recordDaily(guildId, payload) {
    const date = new Date().toISOString().slice(0, 10);
    return upsertRows(
      'analytics',
      {
        guild_id: guildId,
        date_bucket: date,
        metrics: payload
      },
      'guild_id,date_bucket'
    );
  }

  async getLast30Days(guildId) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return fetchMany('analytics', (table) =>
      table
        .select('guild_id,date_bucket,metrics,created_at')
        .eq('guild_id', guildId)
        .gte('date_bucket', since)
        .order('date_bucket', { ascending: true })
    );
  }

  async cleanupOlderThan30Days() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return deleteWhere('analytics', (table) => table.lt('date_bucket', cutoff));
  }
}
