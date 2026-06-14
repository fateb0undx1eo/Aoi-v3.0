import { logger } from '../utils/logger.js';
import type { Client } from 'discord.js';
import type { ModuleRegistry } from '../types/index.js';

const DISCORD_EVENTS = [
  'messageCreate',
  'messageDelete',
  'messageUpdate',
  'interactionCreate',
  'guildMemberAdd',
  'guildMemberUpdate',
  'guildMemberRemove',
  'voiceStateUpdate'
];

export function registerEventDispatcher(client: Client, registry: ModuleRegistry, context: any): void {
  for (const eventName of DISCORD_EVENTS) {
    client.on(eventName as any, async (...args: any[]) => {
      const handlers = registry.getEventHandlers(eventName);
      for (const handler of handlers) {
        try {
          await handler.execute(...args, context);
        } catch (error) {
          logger.error(`Event handler failed (${handler.moduleName}:${eventName})`, error);
        }
      }
    });
  }
}
