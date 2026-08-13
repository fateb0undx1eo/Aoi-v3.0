import { MessageFlags } from 'discord.js';
import type { ButtonInteraction } from 'discord.js';
import type { BotContext, InteractionResult } from '../../../types/index.js';
import { POLL_VOTE_CUSTOM_ID, buildPollComponents } from '../../../services/visualPollService.js';

/**
 * Handles vote buttons on visual polls. Custom id shape:
 *   vp:vote:<pollId>:<optionId>
 */
export default {
  name: 'interactionCreate',
  async execute(interaction: ButtonInteraction, context: BotContext): Promise<InteractionResult | void> {
    if (interaction.isCommand()) return;
    if (!interaction.isButton() || !interaction.customId.startsWith(`${POLL_VOTE_CUSTOM_ID}:`)) return;

    const { services } = context as any;
    const parts = interaction.customId.split(':');
    const pollId = parts[2];
    const optionId = parts.slice(3).join(':');
    if (!pollId || !optionId) {
      return { type: 'REPLY' as const, message: 'That poll action is not valid anymore.', ephemeral: true };
    }

    const poll = await services.visualPollService.getPoll(pollId);
    if (!poll || poll.guild_id !== interaction.guildId) {
      return { type: 'REPLY' as const, message: 'This poll could not be found.', ephemeral: true };
    }

    try {
      const updated = await services.visualPollService.recordVote(pollId, poll.guild_id, interaction.user.id, optionId);
      return {
        type: 'UPDATE' as const,
        components: buildPollComponents(updated),
        flags: Number(MessageFlags.IsComponentsV2)
      } as unknown as InteractionResult;
    } catch (error: any) {
      return {
        type: 'REPLY' as const,
        message: error instanceof Error ? error.message : 'Failed to record your vote.',
        ephemeral: true
      };
    }
  }
};