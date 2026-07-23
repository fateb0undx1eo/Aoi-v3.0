import type { ChatInputCommandInteraction } from 'discord.js';
import type { BotContext } from '../../../types/index.js';
import { buildMemeAutopostControlEmbed, buildMemeAutopostButtons, storePendingAction, pendingMemeAutopostActions } from '../helpers.js';

export default {
  name: 'memes',
  description: 'View meme autopost status',
  permissionOverrides: {
    discordPermissions: ['ManageGuild', 'ManageMessages']
  },
  options: [
    {
      name: 'autopost',
      type: 1,
      description: 'Show meme autopost status and recent stats'
    }
  ],
  async execute(interaction: ChatInputCommandInteraction, context: BotContext): Promise<void> {
    const { services } = context as any;
    const subcommand = interaction.options.getSubcommand(true);
    if (subcommand !== 'autopost') {
      await interaction.editReply('Unsupported memes action.');
      return;
    }

    const { config, stats } = await services.memeService.getAutopostStatus(interaction.guildId);
    const token = storePendingAction(pendingMemeAutopostActions, {
      guildId: interaction.guildId,
      issuerId: interaction.user.id
    });

    await interaction.editReply({
      embeds: [buildMemeAutopostControlEmbed(config, stats)],
      components: buildMemeAutopostButtons(token, config.enabled)
    });
  }
};
