import type { BotContext } from '../../../types/index.js';
import { getModerationService } from '../helpers.js';

export default {
  name: 'messageDelete',
  async execute(message: any, context: BotContext): Promise<void> {
    const moderationService = getModerationService(context);
    if (!moderationService || !message?.guild || !message.mentions?.users?.size) return;
    await moderationService.recordGhostPing({
      guild_id: message.guild.id,
      message_id: message.id,
      channel_id: message.channel.id,
      author_id: message.author?.id ?? null,
      mentions: [...message.mentions.users.keys()],
      created_at: new Date().toISOString()
    });
  }
};
