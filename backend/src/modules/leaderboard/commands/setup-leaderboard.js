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
      for (const bucket of ['daily', 'weekly', 'monthly']) {
        const oldMsgId = await redis.get(`leaderboard:msg:${bucket}`);
        if (oldMsgId) {
          try {
            const oldMsg = await oldChannel.messages.fetch(oldMsgId);
            await oldMsg.delete();
          } catch {}
          await redis.del(`leaderboard:msg:${bucket}`).catch(() => {});
        }
      }
    }
    await redis.del(REDIS_KEYS.leaderboardChannel).catch(() => {});
  }

  await redis.set(REDIS_KEYS.leaderboardChannel, channel.id);

  const buckets = ['daily', 'weekly', 'monthly'];
  const titles = ['CHAT LEADERBOARD DAILY', 'CHAT LEADERBOARD WEEKLY', 'CHAT LEADERBOARD MONTHLY'];

  for (let i = 0; i < buckets.length; i++) {
    const container = {
      type: 17,
      components: [
        { type: 10, content: `# ${titles[i]}` },
        { type: 10, content: 'Loading...' }
      ]
    };

    try {
      const sent = await channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [container]
      });
      await redis.set(`leaderboard:msg:${buckets[i]}`, sent.id);
    } catch (err) {
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
