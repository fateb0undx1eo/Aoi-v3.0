import { MessageFlags } from 'discord.js';
import { updateLeaderboard } from '../leaderboard-updater.js';

export async function handleForceUpdateLeaderboard(interaction, { redis, discordClient, database, supabase }) {
  await updateLeaderboard(redis, discordClient, supabase);

  await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [{ type: 17, components: [{ type: 10, content: 'Leaderboards updated.' }] }]
  });
}
