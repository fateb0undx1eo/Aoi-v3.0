import { logger } from '../utils/logger.js';

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

export function registerEventDispatcher(client, registry, context) {
  for (const eventName of DISCORD_EVENTS) {
    client.on(eventName, async (...args) => {
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
