import type { ChatInputCommandInteraction } from 'discord.js';
import type { BotContext } from '../../../types/index.js';
import { buildProfileModal } from '../helpers.js';

export default {
  name: 'profile',
  description: 'Manage the bot profile style for this server',
  defer: false,
  permissionOverrides: {
    discordPermissions: ['Administrator']
  },
  options: [],
  async execute(interaction: ChatInputCommandInteraction, context: BotContext): Promise<void> {
    const { services } = context as any;
    const config = await services.profileStyleService.getGuildConfig(interaction.guildId);
    const modal = buildProfileModal(config);
    await interaction.showModal(modal);
  }
};
