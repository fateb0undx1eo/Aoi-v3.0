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

async function reactOptions(reaction: any, userId: string, context: BotContext, action: 'add' | 'remove'): Promise<void> {
  const { services } = context as any;
  const message = reaction?.message as any;
  if (!message?.guildId || message.author?.id !== (context.client as any)?.user?.id) return;
  if (!reaction) return;

  const poll = await services.visualPollService.getPollByMessageId(message.id).catch(() => null);
  if (!poll) return;
  if (poll.settings.vote_method !== 'reactions') {
    if (action === 'add') {
      await reaction.users.remove(userId).catch(() => null);
    }
    return;
  }
  if (poll.status !== 'open') return;

  const raw = normalizeEmoji(reaction);
  if (!raw) return;

  const option = poll.options.find((entry: any) => matchesEmoji(entry.emoji, raw));
  if (option) {
    if (action === 'add') {
      try {
        await services.visualPollService.recordVote(poll.id, poll.guild_id, userId, option.id);
      } catch {
        // Poll closed or other failure — remove the reaction to keep it clean
        await reaction.users.remove(userId).catch(() => null);
      }
    } else {
      await services.visualPollService.removeVote(poll.id, poll.guild_id, userId).catch(() => null);
    }
    return;
  }

  // Unknown emoji on a poll message — clean it up
  if (action === 'add') {
    await reaction.users.remove(userId).catch(() => null);
  }
}

export default {
  name: 'messageReactionAdd',
  async execute(reaction: MessageReaction, user: User, context: BotContext): Promise<void> {
    if (user?.bot) return;
    await reactOptions(reaction as any, user?.id, context, 'add');
  }
};