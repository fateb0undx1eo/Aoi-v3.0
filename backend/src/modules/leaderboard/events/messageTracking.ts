import type { Message } from 'discord.js';
import { onMessage } from '../helpers.js';
import type { RedisClient } from '../../../types/index.js';

export function createMessageTrackingEvent(redis: RedisClient) {
  return {
    name: 'messageCreate',
    async execute(message: Message): Promise<void> {
      onMessage(redis, message);
    }
  };
}
