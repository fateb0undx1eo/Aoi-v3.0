import type { ButtonInteraction } from 'discord.js';
import type { BotContext, InteractionResult } from '../../../types/index.js';
import { MEME_ACTION_PREFIX, pendingMemeAutopostActions, buildMemeAutopostControlEmbed, buildMemeAutopostButtons } from '../helpers.js';

export default {
  name: 'interactionCreate',
  async execute(interaction: ButtonInteraction, context: BotContext): Promise<InteractionResult | void> {
    const { services } = context as any;
    if (interaction.isCommand()) return;
    if (!interaction.isButton() || !interaction.customId.startsWith(`${MEME_ACTION_PREFIX}:`)) return;

    const [, , token, action] = interaction.customId.split(':');
    const pending = token ? pendingMemeAutopostActions.get(token) : undefined;
    if (!pending) {
      return { type: 'REPLY' as const, message: 'This meme autopost panel expired. Run the command again.', ephemeral: true };
    }
    if (pending.issuerId !== interaction.user.id) {
      return { type: 'REPLY' as const, message: 'Only the original invoker can use this meme autopost panel.', ephemeral: true };
    }
    if (pending.guildId !== interaction.guildId) {
      return { type: 'REPLY' as const, message: 'This meme autopost panel belongs to a different server context.', ephemeral: true };
    }
    if (action !== 'start' && action !== 'stop') {
      return { type: 'REPLY' as const, message: 'That meme autopost action is not recognized anymore.', ephemeral: true };
    }

    const nextEnabled = action === 'start';
    const config = await services.memeService.updateGuildConfig(interaction.guildId, { enabled: nextEnabled });
    const { stats } = await services.memeService.getAutopostStatus(interaction.guildId);

    return {
      type: 'UPDATE' as const,
      embeds: [buildMemeAutopostControlEmbed(config, stats)],
      components: buildMemeAutopostButtons(token!, config.enabled)
    };
  }
};
