import type { BotContext } from '../../../types/index.js';
import { getModerationService, caseEmbed } from '../helpers.js';

export default {
  name: 'messageCreate',
  async execute(message: any, context: BotContext): Promise<void> {
    const moderationService = getModerationService(context);
    if (!moderationService || !message.guild || message.author.bot) return;

    const afk = await moderationService.getAfk(message.guild.id, message.author.id);
    if (afk) {
      await moderationService.clearAfk(message.guild.id, message.author.id);
      await message.channel.send({
        embeds: [caseEmbed('Welcome Back', `<@${message.author.id}> your AFK status has been removed.`, 0x57f287)]
      });
    }
    await moderationService.touchLoaLastSeen(message.guild.id, message.author.id).catch(() => null);
  }
};
