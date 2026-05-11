import { REST, Routes } from 'discord.js';

export class DiscordCommandSyncService {
  constructor(env, registry) {
    this.env = env;
    this.registry = registry;
  }

  async syncGuildCommands() {
    const commands = [...this.registry.commands.values()].map((command) => {
      const type = command.type ?? 1;

      if (type === 3 || type === 2) {
        return {
          name: command.name,
          type
        };
      }

      return {
        name: command.name,
        type,
        description: command.description ?? 'No description',
        options: command.options ?? []
      };
    });

    const rest = new REST({ version: '10' }).setToken(this.env.discord.token);
    if (!this.env.discord.guildId) {
      throw new Error('GUILD_ID is required for guild command synchronization');
    }

    await rest.put(
      Routes.applicationGuildCommands(this.env.discord.clientId, this.env.discord.guildId),
      { body: commands }
    );

    // Clear stale global commands so only synced guild commands are visible.
    await rest.put(
      Routes.applicationCommands(this.env.discord.clientId),
      { body: [] }
    );
  }
}
