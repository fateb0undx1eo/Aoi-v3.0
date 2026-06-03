import { MessageFlags } from 'discord.js';
import { REDIS_KEYS } from '../redis-keys.js';
import { updateLeaderboard } from '../leaderboard-updater.js';

export async function handleSetupLeaderboard(interaction, { redis, discordClient, database }) {
  const channel = interaction.options.getChannel('channel', true);

  if (!channel.isTextBased()) {
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [{ type: 17, components: [{ type: 10, content: 'Please select a text channel.' }] }]
    });
    return;
  }

  const existingChannelId = await redis.get(REDIS_KEYS.leaderboardChannel);
  if (existingChannelId) {
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [{
        type: 17,
        components: [{
          type: 10,
          content: `Leaderboard already configured in <#${existingChannelId}>. Use \`/force-update-leaderboard\` to refresh. To move it, remove the old messages manually first.`
        }]
      }]
    });
    return;
  }

  await redis.set(REDIS_KEYS.leaderboardChannel, channel.id);

  const buckets = ['daily', 'weekly', 'monthly'];
  const titles = ['CHAT LEADERBOARD — DAILY', 'CHAT LEADERBOARD — WEEKLY', 'CHAT LEADERBOARD — MONTHLY'];
  const colors = [0x57F287, 0x5865F2, 0xFEE75C];

  for (let i = 0; i < buckets.length; i++) {
    const embed = {
      title: titles[i],
      color: colors[i],
      description: 'Loading...',
      timestamp: new Date().toISOString()
    };

    try {
      const sent = await channel.send({ embeds: [embed] });
      await redis.set(`leaderboard:msg:${buckets[i]}`, sent.id);
    } catch (err) {
      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: `Failed to send ${buckets[i]} leaderboard embed.` }] }]
      });
      return;
    }
  }

  const supabase = (await import('../../../database/supabase.js')).supabase;
  await updateLeaderboard(redis, discordClient, supabase).catch(() => {});

  await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [{ type: 17, components: [{ type: 10, content: 'Leaderboard setup complete. Messages will update every hour.' }] }]
  });
}
