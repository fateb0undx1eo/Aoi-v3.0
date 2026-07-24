import type { ModuleRegistry, ModuleDefinition, ModuleCommand } from '../types/index.js';

interface ModuleConfigRow {
  guild_id: string;
  module_name: string;
  enabled: boolean;
  config: Record<string, any>;
  updated_at: string;
}

interface CommandConfigRow {
  guild_id: string;
  command_name: string;
  enabled: boolean;
  overrides: Record<string, any> | null;
  updated_at: string;
}

interface ConfigCacheLike {
  getModuleConfig(guildId: string, moduleName: string): ModuleConfigRow | null;
  getCommandConfig(guildId: string, commandName: string): CommandConfigRow | null;
}

interface ModuleInfo {
  name: string;
  configSchema: Record<string, any>;
  enabled: boolean;
  config: Record<string, any>;
}

interface ModuleWithCommands {
  name: string;
  display_name?: string;
  description?: string;
  enabled: boolean;
  commands: Array<{
    name: string;
    description: string;
    enabled: boolean;
  }>;
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

  listModulesWithCommands(guildId: string): ModuleWithCommands[] {
    return this.registry.listDefinitions().map((definition: ModuleDefinition) => {
      const cachedModule = this.configCache.getModuleConfig(guildId, definition.name);
      const commands = definition.commands.map((cmd: ModuleCommand) => {
        const cachedCmd = this.configCache.getCommandConfig(guildId, cmd.name);
        return {
          name: cmd.name,
          description: cmd.description,
          enabled: cachedCmd?.enabled ?? true,
        };
      });
      return {
        name: definition.name,
        display_name: definition.display_name,
        description: definition.description,
        enabled: cachedModule?.enabled ?? true,
        commands,
      };
    });
  }
}
