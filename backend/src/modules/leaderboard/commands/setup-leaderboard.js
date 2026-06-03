import { MessageFlags } from 'discord.js';
import { REDIS_KEYS } from '../redis-keys.js';
import { updateLeaderboard } from '../leaderboard-updater.js';

export async function handleSetupLeaderboard(interaction, { redis, discordClient, database, supabase }) {
  const channel = interaction.options.getChannel('channel', true);

  if (!channel.isTextBased()) {
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [{ type: 17, components: [{ type: 10, content: 'Please select a text channel.' }] }]
    });
    return;
  }

  const oldChannelId = await redis.get(REDIS_KEYS.leaderboardChannel);
  const guild = discordClient.guilds.cache.first();

  if (oldChannelId && guild) {
    const oldChannel = await guild.channels.fetch(oldChannelId).catch(() => null);
    if (oldChannel?.isTextBased?.()) {
      for (const key of ['leaderboard:msg:header', 'leaderboard:msg:daily', 'leaderboard:msg:weekly', 'leaderboard:msg:monthly']) {
        const oldMsgId = await redis.get(key);
        if (oldMsgId) {
          try {
            const oldMsg = await oldChannel.messages.fetch(oldMsgId);
            await oldMsg.delete();
          } catch {}
          await redis.del(key).catch(() => {});
        }
      }
    }
    await redis.del(REDIS_KEYS.leaderboardChannel).catch(() => {});
  }

  await redis.set(REDIS_KEYS.leaderboardChannel, channel.id);

  const buckets = ['daily', 'weekly', 'monthly'];
  const titles = ['DAILY', 'WEEKLY', 'MONTHLY'];

  try {
    const header = await channel.send({ content: '# <:trophy:1511688001321828403> CHAT LEADERBOARD' });
    await redis.set('leaderboard:msg:header', header.id);
  } catch {
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [{ type: 17, components: [{ type: 10, content: 'Failed to send header message.' }] }]
    });
    return;
  }

  for (let i = 0; i < buckets.length; i++) {
    try {
      const sent = await channel.send({ content: `### ${titles[i]}\nLoading...` });
      await redis.set(`leaderboard:msg:${buckets[i]}`, sent.id);
    } catch {
      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: `Failed to send ${buckets[i]} leaderboard.` }] }]
      });
      return;
    }
  }

  await updateLeaderboard(redis, discordClient, supabase).catch(() => {});

  await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [{ type: 17, components: [{ type: 10, content: 'Leaderboard setup complete.' }] }]
  });
}
