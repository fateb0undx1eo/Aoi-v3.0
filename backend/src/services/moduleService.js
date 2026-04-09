export class ModuleService {
  constructor(registry, configCache) {
    this.registry = registry;
    this.configCache = configCache;
  }

  listModules(guildId) {
    return this.registry.listDefinitions().map((definition) => {
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
