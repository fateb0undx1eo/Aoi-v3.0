import { REST, Routes } from 'discord.js';
import type { EnvConfig } from '../types/env.js';
import { logger } from '../utils/logger.js';
import type { ModuleRegistry } from '../types/index.js';

export class DiscordCommandSyncService {
  private env: EnvConfig;
  private registry: ModuleRegistry;

  constructor(env: EnvConfig, registry: ModuleRegistry) {
    this.env = env;
    this.registry = registry;
  }

  async syncGuildCommands(): Promise<void> {
    const commands = [...this.registry.commands.values()].map((command: Record<string, any>) => {
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

    logger.info(`\n📡 Syncing ${commands.length} command(s) to Discord...`);
    commands.forEach((cmd: Record<string, any>) => {
      logger.info(`  - /${cmd.name}${cmd.options?.length ? ` [${cmd.options.length} option(s)]` : ''}`);
    });

    const rest = new REST({ version: '10' }).setToken(this.env.discord.token);
    if (!this.env.discord.guildId) {
      throw new Error('GUILD_ID is required for guild command synchronization');
    }

    try {
      const result = await rest.put(
        Routes.applicationGuildCommands(this.env.discord.clientId, this.env.discord.guildId),
        { body: commands }
      ) as any[];
      logger.info(`✓ Synced ${result.length} command(s) to guild ${this.env.discord.guildId}\n`);

      await rest.put(
        Routes.applicationCommands(this.env.discord.clientId),
        { body: [] }
      );
    } catch (error: any) {
      logger.error(`✗ Failed to sync commands:`, error.message);
      throw error;
    }
  }
}
