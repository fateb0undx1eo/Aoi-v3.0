import type { BotContext, InteractionResult } from '../../../types/index.js';
import { handleSummonCommand } from '../helpers.js';

export default {
  name: 'husbando',
  description: 'Summon a husbando drop for the server',
  options: [],
  async execute(interaction: any, context: BotContext): Promise<InteractionResult> {
    return handleSummonCommand(interaction, context, 'husbando');
  }
};
