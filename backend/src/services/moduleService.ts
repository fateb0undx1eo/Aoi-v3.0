import type { ModuleRegistry, ModuleDefinition, ModuleCommand } from '../types/index.js';
import type { ModuleConfigRow, CommandConfigRow } from '../types/database.js';

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
