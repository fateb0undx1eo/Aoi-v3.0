export class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this.plugins = new Map();
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
