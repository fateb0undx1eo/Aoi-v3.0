import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { REDIS_KEYS } from '../redis-keys.js';
import { LEADERBOARD_CHANNEL_ID } from '../helpers.js';
import type { RedisClient } from '../../../types/index.js';
import type { Client } from 'discord.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createSetupCommand(redis: RedisClient, discordClient: Client, supabase: SupabaseClient) {
  return {
    name: 'leaderboard',
    description: 'Set up or update the leaderboard',
    async execute(interaction: any): Promise<void> {
      try {
        const isOwner = interaction.guild?.ownerId === interaction.user.id;
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) && !isOwner) {
          await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [{ type: 17, components: [{ type: 10, content: 'You need to be an Administrator or server owner to use this command.' }] }]
          });
          return;
        }

        const channelId = LEADERBOARD_CHANNEL_ID || (await redis.get(REDIS_KEYS.leaderboardChannel));
        if (!channelId) {
          await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [{ type: 17, components: [{ type: 10, content: 'Leaderboard channel not configured. Set LEADERBOARD_CHANNEL_ID in .env.' }] }]
          });
          return;
        }

        const channel = await discordClient.channels.fetch(channelId).catch(() => null);
        if (!channel?.isTextBased()) {
          await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [{ type: 17, components: [{ type: 10, content: 'Leaderboard channel not found or not text-based.' }] }]
          });
          return;
        }

        if (LEADERBOARD_CHANNEL_ID && LEADERBOARD_CHANNEL_ID !== (await redis.get(REDIS_KEYS.leaderboardChannel))) {
          await redis.set(REDIS_KEYS.leaderboardChannel, LEADERBOARD_CHANNEL_ID);
        }

        const existing = await redis.get('leaderboard:msg:header');
        if (!existing) {
          const ok = await ensureLeaderboardMessages(channel, redis);
          if (!ok) {
            await interaction.editReply({
              flags: MessageFlags.IsComponentsV2,
              components: [{ type: 17, components: [{ type: 10, content: 'Failed to create leaderboard messages.' }] }]
            });
            return;
          }
        }

        const { updateLeaderboard } = await import('../leaderboard-updater.js');
        await updateLeaderboard(redis, discordClient, supabase);

        await interaction.editReply({
          flags: MessageFlags.IsComponentsV2,
          components: [{ type: 17, components: [{ type: 10, content: 'Leaderboard updated.' }] }]
        });
      } catch (error: any) {
        logger.error({ err: error }, 'Leaderboard command failed');
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

async function ensureLeaderboardMessages(channel: any, redis: RedisClient): Promise<boolean> {
  const headerId = await redis.get('leaderboard:msg:header');
  if (headerId) return true;

  try {
    const header = await channel.send({ content: '# <:Empty:1503044372487471328> <:trophy:1511688001321828403> CHAT LEADERBOARD' });
    await redis.set('leaderboard:msg:header', header.id);
  } catch {
    return false;
  }

  const buckets = ['monthly', 'weekly', 'daily'];
  const titles = ['MONTHLY', 'WEEKLY', 'DAILY'];

  for (let i = 0; i < buckets.length; i++) {
    try {
      const sent = await channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: `### ${titles[i]}` }, { type: 10, content: 'Loading...' }] }]
      });
      await redis.set(`leaderboard:msg:${buckets[i]}`, sent.id);
    } catch {
      return false;
    }
  }

  return true;
}
