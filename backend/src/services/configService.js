import { fetchMany, fetchOne, updateWhere, upsertRows } from '../database/repository.js';

function isNoRowsError(error) {
  const details = String(error?.cause?.details || error?.cause?.message || error?.message || '');
  return details.includes('0 rows');
}

export class ConfigService {
  async getGuildModuleConfigs(guildId) {
    return fetchMany('module_configs', (table) =>
      table
        .select('guild_id,module_name,enabled,config,updated_at')
        .eq('guild_id', guildId)
    );
  }

  async getGuildCommandConfigs(guildId) {
    return fetchMany('command_configs', (table) =>
      table
        .select('guild_id,command_name,enabled,overrides,updated_at')
        .eq('guild_id', guildId)
    );
  }

  async getLogsConfig(guildId) {
    return fetchMany('logs_config', (table) =>
      table
        .select('guild_id,event_name,channel_id,enabled,updated_at')
        .eq('guild_id', guildId)
    );
  }

  async getModuleConfig(guildId, moduleName) {
    return fetchOne('module_configs', (table) =>
      table
        .select('guild_id,module_name,enabled,config,updated_at')
        .eq('guild_id', guildId)
        .eq('module_name', moduleName)
    );
  }

  async upsertModuleConfig(payload) {
    return upsertRows('module_configs', payload, 'guild_id,module_name');
  }

  async upsertCommandConfig(payload) {
    return upsertRows('command_configs', payload, 'guild_id,command_name');
  }

  // ============================================
  // UNIFIED CONFIG SYSTEM (guild_configs_v2)
  // ============================================

  /**
   * Get specific feature config
   */
  async getGuildConfig(guildId, module, feature) {
    return fetchOne('guild_configs_v2', (table) =>
      table
        .select('*')
        .eq('guild_id', guildId)
        .eq('module', module)
        .eq('feature', feature)
    );
  }

  /**
   * Get all configs for a module
   */
  async getGuildModuleConfigsV2(guildId, module) {
    return fetchMany('guild_configs_v2', (table) =>
      table
        .select('*')
        .eq('guild_id', guildId)
        .eq('module', module)
    );
  }

  /**
   * Update or insert feature config
   */
  async upsertGuildConfig(guildId, module, feature, configJson, isEnabled = true) {
    const payload = {
      guild_id: guildId,
      module: module,
      feature: feature,
      config_json: configJson,
      is_enabled: isEnabled,
      updated_at: new Date().toISOString()
    };
    return upsertRows('guild_configs_v2', payload, 'guild_id,module,feature');
  }

  /**
   * Get Welcome config
   */
  async getWelcomeConfig(guildId) {
    try {
      return await this.getGuildConfig(guildId, 'welcome', 'join_message');
    } catch (error) {
      if (isNoRowsError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update feature enabled state
   */
  async setFeatureEnabled(guildId, module, feature, enabled) {
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
