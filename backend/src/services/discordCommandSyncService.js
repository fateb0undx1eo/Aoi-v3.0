import { REST, Routes } from 'discord.js';

export class DiscordCommandSyncService {
  constructor(env, registry) {
    this.env = env;
    this.registry = registry;
  }

  async syncGuildCommands() {
    const commands = [...this.registry.commands.values()].map((command) => ({
      name: command.name,
      description: command.description ?? 'No description',
      options: command.options ?? []
    }));

    const rest = new REST({ version: '10' }).setToken(this.env.discord.token);
    if (!this.env.discord.guildId) {
      throw new Error('GUILD_ID is required for guild command synchronization');
    }

    await rest.put(
      Routes.applicationGuildCommands(this.env.discord.clientId, this.env.discord.guildId),
      { body: commands }
    );
  }
}
