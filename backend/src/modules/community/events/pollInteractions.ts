import type { ButtonInteraction } from 'discord.js';
import type { BotContext, InteractionResult } from '../../../types/index.js';
import { POLL_VOTE_CUSTOM_ID } from '../../../services/visualPollService.js';
import { logger } from '../../../utils/logger.js';

function stringifyCause(value: any): string {
  if (typeof value === 'string') return value;
  try {
    const seen = new WeakSet();
    const json = JSON.stringify(value, (_key, val) => {
      if (val instanceof Error) return { name: val.name, message: val.message, stack: val.stack };
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[circular]';
        seen.add(val);
      }
      return val;
    });
    if (json && json !== '{}') return json;
  } catch {
    /* fall through to String() */
  }
  return String(value);
}

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

    let poll;
    try {
      poll = await services.visualPollService.getPoll(pollId);
    } catch (error: any) {
      // DB lookup failed (not "no row") — log the real cause server-side.
      // pino-pretty renders nested objects as [object Object], so flatten.
      const cause: any = error?.cause ?? error;
      logger.warn(
        `visual poll: vote lookup failed pollId=${pollId} guildId=${interaction.guildId} ` +
          `error=${cause?.message ?? cause?.details ?? cause?.hint ?? stringifyCause(cause)}`
      );
      return { type: 'REPLY' as const, message: 'Could not reach the poll database — try again in a moment.', ephemeral: true };
    }
    // Finalized (deleted) polls keep their baked "Final — …" message.
    if (!poll) {
      return { type: 'REPLY' as const, message: 'This poll has ended — final results are shown above.', ephemeral: true };
    }
    if (poll.status !== 'open') {
      return { type: 'REPLY' as const, message: 'This poll is closed.', ephemeral: true };
    }
    if (poll.guild_id !== interaction.guildId) {
      return { type: 'REPLY' as const, message: 'This poll could not be found.', ephemeral: true };
    }

    try {
      // Record the vote (this also edits the poll message with fresh totals
      // via refreshPollMessage) and thank the voter ephemerally. Never use
      // interaction.update here — the clicker must not see an "edited" tag.
      const updated = await services.visualPollService.recordVote(pollId, poll.guild_id, interaction.user.id, optionId);
      void services.visualPollService.refreshPollMessage(updated).catch(() => null);
      return {
        type: 'REPLY' as const,
        message: 'Thanks for voting!',
        ephemeral: true,
      };
    } catch (error: any) {
      return {
        type: 'REPLY' as const,
        message: error instanceof Error ? error.message : 'Failed to record your vote.',
        ephemeral: true
      };
    }
  }
};