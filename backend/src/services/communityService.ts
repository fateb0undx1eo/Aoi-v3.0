import { deleteWhere, fetchMany, upsertRows } from '../database/repository.js';
import type { ConfigService } from './configService.js';
import type { StaffRatingService } from './staffRatingService.js';
import type { ModuleConfigRow } from '../types/database.js';

interface UwuLockRow {
  guild_id: string;
  user_id: string;
  settings: Record<string, any>;
}

export class CommunityService {
  private configService: ConfigService;
  private staffRatingService: StaffRatingService;

  constructor(configService: ConfigService, staffRatingService: StaffRatingService) {
    this.configService = configService;
    this.staffRatingService = staffRatingService;
  }

  async getModuleConfig(guildId: string): Promise<ModuleConfigRow | null> {
    return this.configService.getModuleConfig(guildId, 'community').catch(() => null);
  }

  async upsertModuleConfig(guildId: string, updater: (config: Record<string, any>) => Record<string, any>): Promise<Record<string, any>> {
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

  async setMessageConfig(guildId: string, messageType: string, payload: Record<string, any>): Promise<void> {
    await this.upsertModuleConfig(guildId, (config) => {
      const nextConfig = { ...config };
      nextConfig.messages = nextConfig.messages ?? {};
      nextConfig.messages[messageType] = payload;
      return nextConfig;
    });
  }

  async setUwuLock(guildId: string, userId: string, options: Record<string, any>): Promise<void> {
    return upsertRows('uwu_locks', {
      guild_id: guildId,
      user_id: userId,
      settings: options
    }, 'guild_id,user_id');
  }

  async removeUwuLock(guildId: string, userId: string): Promise<void> {
    return deleteWhere('uwu_locks', (table: any) => table.eq('guild_id', guildId).eq('user_id', userId));
  }

  async getUwuLock(guildId: string, userId: string): Promise<UwuLockRow | null> {
    const rows = await fetchMany<UwuLockRow>('uwu_locks', (table: any) =>
      table.select('guild_id,user_id,settings').eq('guild_id', guildId).eq('user_id', userId)
    );
    return rows[0] ?? null;
  }

  async addStaffRating(guildId: string, staffUserId: string, reviewerUserId: string, stars: number, reviewText: string): Promise<void> {
    await this.staffRatingService.addRating(guildId, staffUserId, reviewerUserId, stars, reviewText);
  }

  async getStaffLeaderboard(guildId: string, limit: number = 10): Promise<any[]> {
    return this.staffRatingService.getLeaderboard(guildId, limit);
  }
}
