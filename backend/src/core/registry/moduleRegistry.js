export class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this.plugins = new Map();
    this.asyncModules = new Map(); // For modules that need async initialization
    this.commands = new Map();
    this.events = new Map();
  }

  registerModule(definition, source = 'module') {
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
      this.events.get(event.name).push({
        ...event,
        moduleName: definition.name
      });
    }
  }

  /**
   * Register an async initialization function (called during bot startup with dependencies)
   */
  registerAsyncModule(moduleName, initFunction, source = 'module') {
    this.asyncModules.set(moduleName, {
      name: moduleName,
      initFunction,
      source
    });
  }

  /**
   * Initialize all async modules with provided dependencies
   * Must be called during bot startup after registry is loaded
   */
  async initializeAsyncModules(dependencies) {
    console.log(`\n📦 Initializing ${this.asyncModules.size} async module(s)...`);
    
    for (const [moduleName, asyncModuleEntry] of this.asyncModules) {
      try {
        console.log(`  ⏳ Initializing: ${moduleName}`);
        const definition = await asyncModuleEntry.initFunction(dependencies);
        
        // Validate the returned definition
        if (!definition?.name) {
          throw new Error(`Async module ${moduleName} did not return a valid definition`);
        }
        if (!Array.isArray(definition.commands) || !Array.isArray(definition.events)) {
          throw new Error(`Async module ${moduleName} missing commands or events array`);
        }

        // Register it as a normal module now
        const target = asyncModuleEntry.source === 'plugin' ? this.plugins : this.modules;
        target.set(definition.name, definition);

        // Register commands and events
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
          this.events.get(event.name).push({
            ...event,
            moduleName: definition.name
          });
        }

        console.log(`  ✓ ${moduleName} initialized: ${definition.commands.length} command(s), ${definition.events.length} event(s)`);
      } catch (error) {
        console.error(`  ✗ Failed to initialize async module ${moduleName}:`, error.message);
        throw error;
      }
    }

    // Clear async modules map after initialization
    this.asyncModules.clear();
    console.log(`✓ All async modules initialized\n`);
  }

  getCommand(name) {
    return this.commands.get(name.toLowerCase()) ?? null;
  }

  getEventHandlers(eventName) {
    return this.events.get(eventName) ?? [];
  }

  listDefinitions() {
    return [...this.modules.values(), ...this.plugins.values()];
  }
}
