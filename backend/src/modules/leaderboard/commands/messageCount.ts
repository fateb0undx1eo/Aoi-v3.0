import { MessageFlags } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { messagesKey } from '../redis-keys.js';
import type { RedisClient } from '../../../types/index.js';

export function createMessageCountCommand(redis: RedisClient) {
  return {
    name: 'message',
    description: 'Message leaderboard commands',
    options: [
      {
        name: 'count',
        type: 1,
        description: 'Show your message count'
      }
    ],
    async execute(interaction: any): Promise<void> {
      const subcommand = interaction.options.getSubcommand(true);
      if (subcommand !== 'count') return;

      try {
        const userId = interaction.user.id;
        let daily = 0, weekly = 0, monthly = 0;

        if (redis.isReady?.()) {
          const results = await redis.mget(messagesKey('daily', userId), messagesKey('weekly', userId), messagesKey('monthly', userId));
          daily = Number(results[0]) || 0;
          weekly = Number(results[1]) || 0;
          monthly = Number(results[2]) || 0;
        }

        const total = daily + weekly + monthly;

        await interaction.editReply({
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          components: [{ type: 17, components: [{ type: 10, content: `**YOU HAVE ${total.toLocaleString('en-US')} MESSAGES**` }] }]
        });
      } catch (error: any) {
        logger.error({ err: error }, 'Message count command failed');
        try {
          await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [{ type: 17, components: [{ type: 10, content: `Error: ${error.message}` }] }]
          });
        } catch {}
      }
    }
  };
}
