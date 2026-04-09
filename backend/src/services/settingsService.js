import { fetchOne, upsertRows } from '../database/repository.js';

export class SettingsService {
  constructor(configService) {
    this.configService = configService;
  }

  async setPrefix(guildId, prefix) {
    await upsertRows('guilds', { id: guildId, prefix }, 'id');
  }

  async setBranding(guildId, branding) {
    await upsertRows('guilds', { id: guildId, branding }, 'id');
  }

  async setDashboardRoles(guildId, roleIds) {
    const row = await this.configService.getModuleConfig(guildId, 'settings').catch(() => null);
    const config = row?.config ?? {};
    config.dashboard_roles = roleIds;
    await this.configService.upsertModuleConfig({
      guild_id: guildId,
      module_name: 'settings',
      enabled: row?.enabled ?? true,
      config
    });
  }

  async getGuildSettings(guildId) {
    const guild = await fetchOne('guilds', (table) =>
      table.select('id,prefix,branding').eq('id', guildId)
    );
    const settingsConfig = await this.configService.getModuleConfig(guildId, 'settings').catch(() => null);
    return {
      ...guild,
      dashboardRoles: settingsConfig?.config?.dashboard_roles ?? []
    };
  }
}
