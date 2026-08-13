import type { MessageReaction, User } from 'discord.js';
import type { BotContext } from '../../../types/index.js';

function normalizeEmoji(reaction: any): string | null {
  const emoji = reaction?.emoji;
  if (!emoji) return null;
  if (emoji.id) {
    return emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
  }
  return String(emoji.name ?? '').trim() || null;
}

function matchesEmoji(optionEmoji: string | null | undefined, raw: string | null): boolean {
  if (!raw) return false;
  const expected = String(optionEmoji ?? '').trim();
  if (!expected) return false;
  return expected === raw;
}

export default {
  name: 'messageReactionRemove',
  async execute(reaction: MessageReaction, user: User, context: BotContext): Promise<void> {
    if (user?.bot) return;
    const { services } = context as any;
    const message = (reaction as any)?.message as any;
    if (!message?.guildId || message.author?.id !== (context.client as any)?.user?.id) return;

    const poll = await services.visualPollService.getPollByMessageId(message.id).catch(() => null);
    if (!poll || poll.settings.vote_method !== 'reactions') return;

    const raw = normalizeEmoji(reaction as any);
    if (!raw) return;
    const option = poll.options.find((entry: any) => matchesEmoji(entry.emoji, raw));
    if (option) {
      await services.visualPollService.removeVote(poll.id, poll.guild_id, user.id).catch(() => null);
    }
  }
};