import { MessageFlags } from 'discord.js';
import { updateLeaderboard } from '../leaderboard-updater.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { RedisClient } from '../../../types/index.js';
import type { Client } from 'discord.js';
import type { SupabaseClient } from '@supabase/supabase-js';

interface ForceUpdateContext {
  redis: RedisClient;
  discordClient: Client;
  database: any;
  supabase: SupabaseClient;
}

export async function handleForceUpdateLeaderboard(interaction: ChatInputCommandInteraction, { redis, discordClient, supabase }: ForceUpdateContext): Promise<void> {
  await updateLeaderboard(redis, discordClient, supabase);

  await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [{ type: 17, components: [{ type: 10, content: 'Leaderboards updated.' }] }]
  });
}
