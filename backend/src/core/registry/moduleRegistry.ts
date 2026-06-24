import { logger } from '../../utils/logger.js';
import type { ModuleDefinition, ModuleCommand, ModuleEvent } from '../../types/index.js';

interface AsyncModuleEntry {
  name: string;
  initFunction: (deps: Record<string, any>) => Promise<ModuleDefinition>;
  source: string;
}

export class ModuleRegistry {
  public modules: Map<string, ModuleDefinition>;
  public plugins: Map<string, ModuleDefinition>;
  public commands: Map<string, ModuleCommand & { moduleName: string }>;
  public events: Map<string, (ModuleEvent & { moduleName: string })[]>;
  private asyncModules: Map<string, AsyncModuleEntry>;

  constructor() {
    this.modules = new Map();
    this.plugins = new Map();
    this.asyncModules = new Map();
    this.commands = new Map();
    this.events = new Map();
  }

  registerModule(definition: ModuleDefinition, source: string = 'module'): void {
    if (!definition?.name) {
      throw new Error('Module definition must include a name');
    }

    const target = source === 'plugin' ? this.plugins : this.modules;
    target.set(definition.name, definition);

    for (const command of definition.commands ?? []) {
      const key = command.name.toLowerCase();
      if (this.commands.has(key)) {
        throw new Error(`Duplicate command registration: ${command.name}`);
      }
      this.commands.set(key, { ...command, moduleName: definition.name });
    }

    for (const event of definition.events ?? []) {
      if (!this.events.has(event.name)) {
        this.events.set(event.name, []);
      }
      this.events.get(event.name)!.push({
        ...event,
        moduleName: definition.name
      });
    }
  }

  registerAsyncModule(
    moduleName: string,
    initFunction: (deps: Record<string, any>) => Promise<ModuleDefinition>,
    source: string = 'module'
  ): void {
    this.asyncModules.set(moduleName, {
      name: moduleName,
      initFunction,
      source
    });
  }

  async initializeAsyncModules(dependencies: Record<string, any>): Promise<void> {
    logger.info(`\n📦 Initializing ${this.asyncModules.size} async module(s)...`);

    const entries = [...this.asyncModules.entries()];

    const results = await Promise.allSettled(
      entries.map(async ([moduleName, asyncModuleEntry]) => {
        logger.info(`  ⏳ Initializing: ${moduleName}`);
        const definition = await asyncModuleEntry.initFunction(dependencies);

        if (!definition?.name) {
          throw new Error(`Async module ${moduleName} did not return a valid definition`);
        }
        if (!Array.isArray(definition.commands) || !Array.isArray(definition.events)) {
          throw new Error(`Async module ${moduleName} missing commands or events array`);
        }

        return { moduleName, definition, source: asyncModuleEntry.source };
      })
    );

    const errors: string[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { moduleName, definition, source } = result.value;
        try {
          const target = source === 'plugin' ? this.plugins : this.modules;
          target.set(definition.name, definition);

          for (const command of definition.commands) {
            const key = command.name.toLowerCase();
            if (this.commands.has(key)) {
              throw new Error(`Duplicate command registration: ${command.name}`);
            }
            this.commands.set(key, { ...command, moduleName: definition.name });
          }

          for (const event of definition.events) {
            if (!this.events.has(event.name)) {
              this.events.set(event.name, []);
            }
            this.events.get(event.name)!.push({
              ...event,
              moduleName: definition.name
            });
          }

          logger.info(`  ✓ ${moduleName} initialized: ${definition.commands.length} command(s), ${definition.events.length} event(s)`);
        } catch (error: any) {
          errors.push(`${moduleName}: ${error.message}`);
        }
      } else {
        errors.push(result.reason?.message ?? 'unknown error');
      }
    }

    this.asyncModules.clear();

    if (errors.length > 0) {
      logger.error(`  ✗ ${errors.length} async module(s) failed to initialize: ${errors.join('; ')}`);
      throw new Error(`Async module initialization failed: ${errors.join(', ')}`);
    }

    logger.info(`✓ All async modules initialized\n`);
  }

  getCommand(name: string): (ModuleCommand & { moduleName: string }) | null {
    return this.commands.get(name.toLowerCase()) ?? null;
  }

  getEventHandlers(eventName: string): (ModuleEvent & { moduleName: string })[] {
    return this.events.get(eventName) ?? [];
  }

  listDefinitions(): ModuleDefinition[] {
    return [...this.modules.values(), ...this.plugins.values()];
  }
}
