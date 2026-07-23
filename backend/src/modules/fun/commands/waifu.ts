import type { BotContext, InteractionResult } from '../../../types/index.js';
import { handleSummonCommand } from '../helpers.js';

export default {
  name: 'waifu',
  description: 'Summon a waifu drop for the server',
  options: [],
  async execute(interaction: any, context: BotContext): Promise<InteractionResult> {
    return handleSummonCommand(interaction, context, 'waifu');
  }
};
