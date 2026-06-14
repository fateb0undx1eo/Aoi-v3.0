import type { ModuleRegistry, ModuleDefinition } from '../types/index.js';

interface ModuleConfigRow {
  guild_id: string;
  module_name: string;
  enabled: boolean;
  config: Record<string, any>;
  updated_at: string;
}

interface ConfigCacheLike {
  getModuleConfig(guildId: string, moduleName: string): ModuleConfigRow | null;
}

interface ModuleInfo {
  name: string;
  configSchema: Record<string, any>;
  enabled: boolean;
  config: Record<string, any>;
}

export class ModuleService {
  private registry: ModuleRegistry;
  private configCache: ConfigCacheLike;

  constructor(registry: ModuleRegistry, configCache: ConfigCacheLike) {
    this.registry = registry;
    this.configCache = configCache;
  }

  listModules(guildId: string): ModuleInfo[] {
    return this.registry.listDefinitions().map((definition: ModuleDefinition) => {
      const cached = this.configCache.getModuleConfig(guildId, definition.name);
      return {
        name: definition.name,
        configSchema: definition.configSchema,
        enabled: cached?.enabled ?? true,
        config: cached?.config ?? {}
      };
    });
  }
}
