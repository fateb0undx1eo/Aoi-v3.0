import { deleteWhere, fetchMany, upsertRows } from '../database/repository.js';

export class CommunityService {
  constructor(configService, staffRatingService) {
    this.configService = configService;
    this.staffRatingService = staffRatingService;
  }

  async getModuleConfig(guildId) {
    return this.configService.getModuleConfig(guildId, 'community').catch(() => null);
  }

  async upsertModuleConfig(guildId, updater) {
    const row = await this.getModuleConfig(guildId);
    const nextConfig = updater(row?.config ?? {});

    await this.configService.upsertModuleConfig({
      guild_id: guildId,
      module_name: 'community',
      enabled: row?.enabled ?? true,
      config: nextConfig
    });

    return nextConfig;
  }

  async setMessageConfig(guildId, messageType, payload) {
    await this.upsertModuleConfig(guildId, (config) => {
      const nextConfig = { ...config };
      nextConfig.messages = nextConfig.messages ?? {};
      nextConfig.messages[messageType] = payload;
      return nextConfig;
    });
  }

  async setUwuLock(guildId, userId, options) {
    return upsertRows('uwu_locks', {
      guild_id: guildId,
      user_id: userId,
      settings: options
    }, 'guild_id,user_id');
  }

  async removeUwuLock(guildId, userId) {
    return deleteWhere('uwu_locks', (table) => table.eq('guild_id', guildId).eq('user_id', userId));
  }

  async getUwuLock(guildId, userId) {
    const rows = await fetchMany('uwu_locks', (table) =>
      table.select('guild_id,user_id,settings').eq('guild_id', guildId).eq('user_id', userId)
    );
    return rows[0] ?? null;
  }

  async addStaffRating(guildId, staffUserId, reviewerUserId, stars, reviewText) {
    await this.staffRatingService.addRating(guildId, staffUserId, reviewerUserId, stars, reviewText);
  }

  async getStaffLeaderboard(guildId, limit = 10) {
    return this.staffRatingService.getLeaderboard(guildId, limit);
  }
}
