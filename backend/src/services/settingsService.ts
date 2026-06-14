import { fetchOne, upsertRows } from '../database/repository.js';
import type { ConfigService } from '../types/index.js';

interface GuildSettings {
  id: string;
  prefix: string;
  branding: Record<string, any>;
  dashboardRoles: string[];
}

export class SettingsService {
  private configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  async setPrefix(guildId: string, prefix: string): Promise<void> {
    await upsertRows('guilds', { id: guildId, prefix }, 'id');
  }

  async setBranding(guildId: string, branding: Record<string, any>): Promise<void> {
    await upsertRows('guilds', { id: guildId, branding }, 'id');
  }

  async setDashboardRoles(guildId: string, roleIds: string[]): Promise<void> {
    const row = await this.configService.getModuleConfig(guildId, 'settings').catch(() => null);
    const config = (row?.config as Record<string, any>) ?? {};
    config.dashboard_roles = roleIds;
    await this.configService.upsertModuleConfig({
      guild_id: guildId,
      module_name: 'settings',
      enabled: (row?.enabled as boolean) ?? true,
      config,
    });
  }

  async getGuildSettings(guildId: string): Promise<GuildSettings> {
    const guild = await fetchOne<any>('guilds', (table) =>
      table.select('id,prefix,branding').eq('id', guildId)
    );
    const settingsConfig = await this.configService.getModuleConfig(guildId, 'settings').catch(() => null);
    return {
      ...guild,
      dashboardRoles: (settingsConfig?.config as Record<string, any>)?.['dashboard_roles'] ?? [],
    } as GuildSettings;
  }
}
