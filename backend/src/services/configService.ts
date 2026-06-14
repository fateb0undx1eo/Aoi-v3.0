import { fetchMany, fetchOne, updateWhere, upsertRows } from '../database/repository.js';
import type { ModuleConfigRow, CommandConfigRow } from '../types/database.js';

interface LogConfigRow {
  guild_id: string;
  event_name: string;
  channel_id: string;
  enabled: boolean;
  updated_at: string;
}

function isNoRowsError(error: any): boolean {
  const details = String(error?.cause?.details || error?.cause?.message || error?.message || '');
  return details.includes('0 rows');
}

export class ConfigService {
  async getGuildModuleConfigs(guildId: string): Promise<ModuleConfigRow[]> {
    return fetchMany<ModuleConfigRow>('module_configs', (table) =>
      table
        .select('guild_id,module_name,enabled,config,updated_at')
        .eq('guild_id', guildId)
    );
  }

  async getGuildCommandConfigs(guildId: string): Promise<CommandConfigRow[]> {
    return fetchMany<CommandConfigRow>('command_configs', (table) =>
      table
        .select('guild_id,command_name,enabled,overrides,updated_at')
        .eq('guild_id', guildId)
    );
  }

  async getLogsConfig(guildId: string): Promise<LogConfigRow[]> {
    return fetchMany<LogConfigRow>('logs_config', (table) =>
      table
        .select('guild_id,event_name,channel_id,enabled,updated_at')
        .eq('guild_id', guildId)
    );
  }

  async getModuleConfig(guildId: string, moduleName: string): Promise<ModuleConfigRow> {
    return fetchOne<ModuleConfigRow>('module_configs', (table) =>
      table
        .select('guild_id,module_name,enabled,config,updated_at')
        .eq('guild_id', guildId)
        .eq('module_name', moduleName)
    ) as Promise<ModuleConfigRow>;
  }

  async upsertModuleConfig(payload: Record<string, any>): Promise<void> {
    return upsertRows('module_configs', payload, 'guild_id,module_name');
  }

  async upsertCommandConfig(payload: Record<string, any>): Promise<void> {
    return upsertRows('command_configs', payload, 'guild_id,command_name');
  }

  async upsertLogsConfig(payload: Record<string, any>): Promise<void> {
    return upsertRows('logs_config', payload, 'guild_id,event_name');
  }

  async getGuildConfig(guildId: string, module: string, feature: string): Promise<Record<string, any> | null> {
    return fetchOne<Record<string, any>>('guild_configs_v2', (table) =>
      table
        .select('*')
        .eq('guild_id', guildId)
        .eq('module', module)
        .eq('feature', feature)
    );
  }

  async getGuildModuleConfigsV2(guildId: string, module: string): Promise<Record<string, any>[]> {
    return fetchMany<Record<string, any>>('guild_configs_v2', (table) =>
      table
        .select('*')
        .eq('guild_id', guildId)
        .eq('module', module)
    );
  }

  async upsertGuildConfig(guildId: string, module: string, feature: string, configJson: Record<string, any>, isEnabled: boolean = true): Promise<void> {
    const payload: Record<string, any> = {
      guild_id: guildId,
      module: module,
      feature: feature,
      config_json: configJson,
      is_enabled: isEnabled,
      updated_at: new Date().toISOString()
    };
    return upsertRows('guild_configs_v2', payload, 'guild_id,module,feature');
  }

  async getWelcomeConfig(guildId: string): Promise<Record<string, any> | null> {
    try {
      return await this.getGuildConfig(guildId, 'welcome', 'join_message');
    } catch (error: any) {
      if (isNoRowsError(error)) {
        return null;
      }
      throw error;
    }
  }

  async setFeatureEnabled(guildId: string, module: string, feature: string, enabled: boolean): Promise<boolean> {
    await updateWhere(
      'guild_configs_v2',
      { is_enabled: enabled, updated_at: new Date().toISOString() },
      (table) =>
        table
          .eq('guild_id', guildId)
          .eq('module', module)
          .eq('feature', feature)
    );
    return true;
  }
}
