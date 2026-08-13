import { MessageFlags } from 'discord.js';
import type { Client, TextBasedChannel, Message } from 'discord.js';
import { fetchMany, fetchOne, upsertRows, updateWhere, deleteWhere } from '../database/repository.js';
import { logger } from '../utils/logger.js';
import { renderVsCard, renderTrackCard, type VsCardOption } from './pollCanvas.js';
import type { UploadService } from './upload/uploadService.js';

export type PollType = 'vs' | 'music';
export type PollStatus = 'open' | 'closed';
export type VoteMethod = 'buttons' | 'reactions';

export interface PollOption {
  id: string;
  label: string;
  image_url?: string | null;
  emoji?: string | null;
  accent?: string | null;
  track_url?: string | null;
  track_artist?: string | null;
}

export interface PollSettings {
  vote_method: VoteMethod;
  multi_select: boolean;
  allow_change: boolean;
  show_results: 'always' | 'after_vote' | 'closed';
  accent_color: string;
  background_top: string;
  background_bottom: string;
  ends_at: string | null;
  instructions?: string;
}

export interface PollDraft {
  type: PollType;
  title: string;
  subtitle?: string;
  instructions?: string;
  options: PollOption[];
  settings?: Partial<PollSettings>;
}

export interface PollRow {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  created_by: string;
  type: PollType;
  title: string;
  subtitle: string;
  options: PollOption[];
  settings: PollSettings;
  results: Record<string, number>;
  status: PollStatus;
  media_url: string | null;
  created_at: string;
  updated_at: string;
  ends_at: string | null;
}

export interface PollTotals {
  option_id: string;
  count: number;
  pct: number;
}

export const POLL_ACTION_PREFIX = 'vp';
export const POLL_VOTE_CUSTOM_ID = `${POLL_ACTION_PREFIX}:vote`;
export const POLL_MAX_OPTIONS = 20;

const REACTION_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

export const DEFAULT_POLL_SETTINGS: PollSettings = {
  vote_method: 'buttons',
  multi_select: false,
  allow_change: true,
  show_results: 'after_vote',
  accent_color: '#e11d48',
  background_top: '#101014',
  background_bottom: '#1b1b23',
  ends_at: null,
  instructions: '',
};

// ─── Helpers ───────────────────────────────────────────────────

function normalizeSettings(raw: Partial<PollSettings> | undefined | null): PollSettings {
  const settings = { ...DEFAULT_POLL_SETTINGS, ...(raw ?? {}) };
  settings.vote_method = settings.vote_method === 'reactions' ? 'reactions' : 'buttons';
  settings.multi_select = Boolean(settings.multi_select);
  settings.allow_change = settings.allow_change !== false;
  settings.show_results = settings.show_results === 'closed' ? 'closed'
    : settings.show_results === 'always' ? 'always' : 'after_vote';
  if (!/^#[0-9a-f]{6}$/i.test(String(settings.accent_color ?? ''))) settings.accent_color = DEFAULT_POLL_SETTINGS.accent_color;
  if (!/^#[0-9a-f]{6}$/i.test(String(settings.background_top ?? ''))) settings.background_top = DEFAULT_POLL_SETTINGS.background_top;
  if (!/^#[0-9a-f]{6}$/i.test(String(settings.background_bottom ?? ''))) settings.background_bottom = DEFAULT_POLL_SETTINGS.background_bottom;
  settings.ends_at = typeof settings.ends_at === 'string' && settings.ends_at ? settings.ends_at : null;
  settings.instructions = String(settings.instructions ?? '').trim().slice(0, 500);
  return settings;
}

export function normalizePollOptions(rawOptions: any[] | undefined | null): PollOption[] {
  if (!Array.isArray(rawOptions)) return [];
  return rawOptions
    .map((raw, index) => ({
      id: String(raw?.id ?? `opt_${index + 1}`).trim().slice(0, 32),
      label: String(raw?.label ?? '').trim().slice(0, 80),
      image_url: typeof raw?.image_url === 'string' && /^https?:\/\//i.test(raw.image_url) ? raw.image_url : null,
      emoji: typeof raw?.emoji === 'string' ? raw.emoji.slice(0, 64) : null,
      accent: typeof raw?.accent === 'string' && /^#[0-9a-f]{6}$/i.test(raw.accent) ? raw.accent : null,
      track_url: typeof raw?.track_url === 'string' && /^https?:\/\//i.test(raw.track_url) ? raw.track_url.slice(0, 2000) : null,
      track_artist: typeof raw?.track_artist === 'string' ? raw.track_artist.slice(0, 80) : null,
    }))
    .filter((option) => option.label.length > 0);
}

export function parsePollRow(raw: any): PollRow | null {
  if (!raw) return null;
  const options = normalizePollOptions(raw.options);
  if (options.length < 2) return null;
  return {
    id: String(raw.id),
    guild_id: String(raw.guild_id),
    channel_id: String(raw.channel_id),
    message_id: raw.message_id ? String(raw.message_id) : null,
    created_by: String(raw.created_by ?? ''),
    type: (raw.type === 'vs' || raw.type === 'music') ? raw.type : 'vs',
    title: String(raw.title ?? '').slice(0, 150),
    subtitle: String(raw.subtitle ?? '').slice(0, 500),
    options,
    settings: normalizeSettings(raw.settings),
    results: (raw.results && typeof raw.results === 'object' ? raw.results : {}) as Record<string, number>,
    status: raw.status === 'closed' ? 'closed' : 'open',
    media_url: typeof raw.media_url === 'string' ? raw.media_url : null,
    created_at: String(raw.created_at ?? new Date().toISOString()),
    updated_at: String(raw.updated_at ?? new Date().toISOString()),
    ends_at: raw.ends_at ? String(raw.ends_at) : null,
  };
}

function emojiObject(emoji: string | null | undefined): any | null {
  const raw = String(emoji ?? '').trim();
  if (!raw) return null;
  const match = raw.match(/^<a?:(\w+):(\d+)>$/);
  if (match) {
    return { name: match[1], id: match[2], animated: raw.startsWith('<a:') };
  }
  return { name: raw };
}

function computeTotals(poll: PollRow, results: Record<string, number>): PollTotals[] {
  const total = Object.values(results).reduce((sum, value) => sum + (Number(value) || 0), 0);
  return poll.options.map((option) => ({
    option_id: option.id,
    count: Number(results[option.id]) || 0,
    pct: total > 0 ? Math.round((Number(results[option.id]) || 0) / total * 100) : 0,
  }));
}

function countVotes(votes: Array<{ option_ids: any }>): Record<string, number> {
  const results: Record<string, number> = {};
  for (const vote of votes) {
    const ids = Array.isArray(vote.option_ids) ? vote.option_ids : [];
    for (const id of ids) {
      const key = String(id);
      results[key] = (results[key] || 0) + 1;
    }
  }
  return results;
}

function buildResultBar(pct: number): string {
  const filled = Math.round(pct / 10);
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
}

// ─── V2 component builders ─────────────────────────────────────

export function buildPollComponents(poll: PollRow, results?: Record<string, number>): any[] {
  const settings = poll.settings;
  const totals = computeTotals(poll, results ?? poll.results);
  const showResults = settings.show_results === 'always'
    || (settings.show_results === 'closed' && poll.status === 'closed');
  const totalVotes = totals.reduce((sum, t) => sum + t.count, 0);
  const tally = results ?? poll.results;

  const typeTag = poll.type === 'vs' ? '⚔️ VS' : '📊 POLL';

  const children: any[] = [];

  if (poll.type !== 'music') {
    children.push({ type: 10, content: typeTag });
    children.push({ type: 10, content: poll.title });
    if (poll.subtitle) children.push({ type: 10, content: poll.subtitle });

    if (poll.media_url) {
      children.push({ type: 12, items: [{ media: { url: poll.media_url } }] });
    }
  }

  const instructions: string[] = [];
  if (settings.instructions) instructions.push(settings.instructions);
  if (settings.ends_at) {
    instructions.push(`Ends <t:${Math.floor(new Date(settings.ends_at).getTime() / 1000)}:R>`);
  }
  if (poll.type !== 'music' && settings.vote_method === 'reactions') {
    instructions.push('React with your choice below.');
  }

  if (instructions.length > 0) {
    children.push({ type: 10, content: instructions.join(' • ') });
  }

  if (poll.type === 'music') {
    const option = poll.options[0];
    if (option) {
      const link = option.track_url ?? '';
      children.push({ type: 10, content: link ? `## Would you listen to this [track](${link})?` : `Would you listen to this track?` });
      if (showResults) {
        const listen = Number(tally[`${option.id}:listen`] ?? 0);
        const skip = Number(tally[`${option.id}:skip`] ?? 0);
        children.push({ type: 10, content: `👍 Listen ${listen} • 👎 Skip ${skip}` });
      }
    }
    if (poll.media_url) {
      children.push({ type: 12, items: [{ media: { url: poll.media_url } }] });
    }
  } else if (showResults && totalVotes > 0) {
    children.push({ type: 10, content: `${totalVotes} vote${totalVotes === 1 ? '' : 's'}` });
    for (const option of poll.options) {
      const entry = totals.find((t) => t.option_id === option.id);
      const pct = entry?.pct ?? 0;
      const count = entry?.count ?? 0;
      const emoji = option.emoji ? `${option.emoji} ` : '';
      children.push({
        type: 10,
        content: `${buildResultBar(pct)} ${emoji}**${option.label}** — ${count} (${pct}%)`,
      });
    }
  } else if (showResults) {
    children.push({ type: 10, content: 'No votes yet — be the first!' });
  }

  if (settings.vote_method === 'buttons') {
    const disabled = poll.status !== 'open';
    if (poll.type === 'music') {
      const closed = poll.status === 'closed';
      for (const option of poll.options) {
        const listen = Number(tally[`${option.id}:listen`] ?? 0);
        const skip = Number(tally[`${option.id}:skip`] ?? 0);
        children.push({
          type: 1,
          components: [
            {
              type: 2,
              style: 2,
              custom_id: `${POLL_VOTE_CUSTOM_ID}:${poll.id}:${option.id}:listen`,
              label: closed ? `LISTEN:${listen}` : 'LISTEN',
              disabled: closed,
            },
            {
              type: 2,
              style: 2,
              custom_id: `${POLL_VOTE_CUSTOM_ID}:${poll.id}:${option.id}:skip`,
              label: closed ? `SKIP:${skip}` : 'SKIP',
              disabled: closed,
            },
          ],
        });
      }
    } else {
      const rows: any[][] = [];
      poll.options.forEach((option, index) => {
        const rowIndex = Math.floor(index / 5);
        if (!rows[rowIndex]) rows[rowIndex] = [];
        rows[rowIndex]!.push({
          type: 2,
          style: 2,
          custom_id: `${POLL_VOTE_CUSTOM_ID}:${poll.id}:${option.id}`,
          label: option.label.slice(0, 80),
          disabled,
          ...(option.emoji ? { emoji: emojiObject(option.emoji) } : {}),
        });
      });
      for (const row of rows) {
        children.push({ type: 1, components: row });
      }
    }
  }

  return [{ type: 17, components: children }];
}

// ─── Service ───────────────────────────────────────────────────

export class VisualPollService {
  private client: Client;
  private uploadService: UploadService;

  constructor({ client, uploadService }: { client: Client; uploadService: UploadService }) {
    this.client = client;
    this.uploadService = uploadService;
  }

  async resolveGuild(guildId: string): Promise<any | null> {
    return this.client.guilds.cache.get(guildId) ?? await this.client.guilds.fetch(guildId).catch(() => null);
  }

  async resolveChannel(guild: any, channelId: string): Promise<TextBasedChannel | null> {
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
    return channel?.isTextBased() ? channel as TextBasedChannel : null;
  }

  async createPoll(guildId: string, channelId: string, draft: PollDraft, userId: string): Promise<PollRow> {
    const type: PollType = draft.type === 'vs' || draft.type === 'music' ? draft.type : 'vs';
    const options = normalizePollOptions(draft.options);
    if (type !== 'music' && options.length < 2) throw new Error('A poll needs at least 2 options.');
    if (options.length > POLL_MAX_OPTIONS) throw new Error(`A poll can have at most ${POLL_MAX_OPTIONS} options.`);
    if (type === 'music' && options.some((option) => !option.track_url || !option.image_url)) {
      throw new Error('Every music option needs a track link and cover.');
    }
    const title = type === 'music'
      ? (String(draft.title ?? '').trim() || options[0]?.label || 'Music Poll').slice(0, 150)
      : String(draft.title ?? '').trim().slice(0, 150);
    if (type !== 'music' && !title) throw new Error('Poll needs a title.');

    const settings = normalizeSettings(draft.settings);
    if (settings.vote_method === 'reactions' && options.length > 10) {
      throw new Error('Reaction polls support at most 10 options.');
    }

    const guild = await this.resolveGuild(guildId);
    if (!guild) throw new Error('Guild not found.');
    const channel = await this.resolveChannel(guild, channelId);
    if (!channel) throw new Error('Target channel not found.');

    // Render + upload the VS card when type is "vs", or per-track cards for "music"
    let mediaUrl: string | null = null;
    if (type === 'vs' && options.every((option) => option.image_url)) {
      try {
        const cardOptions: VsCardOption[] = options.map((option) => ({
          imageUrl: option.image_url,
          label: option.label,
        }));
        const buffer = await renderVsCard(cardOptions, {
          badgeLabel: 'VS',
        });
        mediaUrl = await this.uploadService.processFile({
          buffer,
          originalname: 'poll-vs-card.png',
          mimetype: 'image/png',
          size: buffer.length,
        });
      } catch (error: any) {
        logger.warn({ guildId, error: error.message }, 'visual poll: vs card render failed, falling back to option gallery');
      }
    } else if (type === 'music') {
      // Composite the single track cover onto the VS background (with the
      // song name overlaid) and upload it as the poll's media.
      const track = options[0];
      if (track?.image_url) {
        try {
          const buffer = await renderTrackCard(track.image_url, track.label, track.track_artist ?? '');
          mediaUrl = await this.uploadService.processFile({
            buffer,
            originalname: 'poll-track.png',
            mimetype: 'image/png',
            size: buffer.length,
          });
        } catch (error: any) {
          logger.warn({ guildId, error: error.message }, 'visual poll: track card render failed');
        }
      }
    }

    const now = new Date().toISOString();
    const pollRow: PollRow = {
      id: 'pending',
      guild_id: guildId,
      channel_id: channelId,
      message_id: null,
      created_by: userId,
      type,
      title,
      subtitle: String(draft.subtitle ?? '').slice(0, 500),
      options,
      settings,
      results: {},
      status: 'open',
      media_url: mediaUrl,
      created_at: now,
      updated_at: now,
      ends_at: settings.ends_at,
    };

    const payload: Record<string, any> = {
      flags: Number(MessageFlags.IsComponentsV2),
      components: buildPollComponents(pollRow),
      allowedMentions: { parse: [] },
    };
    const sent = await (channel as any).send(payload);
    pollRow.message_id = (sent as Message).id;

    await upsertRows('visual_polls', {
      guild_id: guildId,
      channel_id: channelId,
      message_id: pollRow.message_id,
      created_by: userId,
      type,
      title,
      subtitle: pollRow.subtitle,
      options,
      settings,
      results: {},
      status: 'open',
      media_url: mediaUrl,
      ends_at: settings.ends_at,
    });

    if (settings.vote_method === 'reactions') {
      const emojis = options.map((option, index) => option.emoji || REACTION_EMOJIS[index] || `👍`);
      for (const emoji of emojis) {
        await (sent as Message).react(emoji).catch(() => null);
      }
    }

    logger.info({ guildId, pollId: pollRow.id, channelId }, 'visual poll: created');
    return pollRow;
  }

  async getPoll(pollId: string): Promise<PollRow | null> {
    const rows = await fetchMany<any>('visual_polls', (table) =>
      (table as any).select('*').eq('id', pollId).limit(1)
    );
    return parsePollRow(rows[0]);
  }

  async getPollByMessageId(messageId: string): Promise<PollRow | null> {
    const rows = await fetchMany<any>('visual_polls', (table) =>
      (table as any).select('*').eq('message_id', messageId).limit(1)
    );
    return parsePollRow(rows[0]);
  }

  async listPolls(guildId: string): Promise<PollRow[]> {
    const rows = await fetchMany<any>('visual_polls', (table) =>
      (table as any)
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(50)
    );
    return rows.map(parsePollRow).filter((row): row is PollRow => row !== null);
  }

  async getVotes(pollId: string): Promise<Array<{ user_id: string; option_ids: string[] }>> {
    const rows = await fetchMany<any>('visual_poll_votes', (table) =>
      (table as any).select('user_id,option_ids').eq('poll_id', pollId)
    );
    return rows.map((row) => ({
      user_id: String(row.user_id),
      option_ids: Array.isArray(row.option_ids) ? row.option_ids.map(String) : [],
    }));
  }

  async recomputeResults(poll: PollRow): Promise<Record<string, number>> {
    const votes = await this.getVotes(poll.id);
    const results = countVotes(votes);
    await updateWhere('visual_polls', { results }, (table) => (table as any).eq('id', poll.id));
    poll.results = results;
    return results;
  }

  /**
   * Records (or toggles) a user's vote and refreshes the poll message.
   * Returns updated totals. Throws when the poll is closed or already
   * voted without allow_change.
   */
  async recordVote(pollId: string, guildId: string, userId: string, optionId: string): Promise<PollRow> {
    const poll = await this.getPoll(pollId);
    if (!poll || poll.guild_id !== guildId) throw new Error('Poll not found.');
    if (poll.status !== 'open') throw new Error('This poll is closed.');
    if (poll.ends_at && new Date(poll.ends_at).getTime() < Date.now()) {
      await updateWhere('visual_polls', { status: 'closed' }, (table) => (table as any).eq('id', poll.id));
      throw new Error('This poll has ended.');
    }

    const baseOptionId = optionId.includes(':') ? optionId.split(':')[0] : optionId;
    const option = poll.options.find((o) => o.id === baseOptionId);
    if (!option) throw new Error('That poll option does not exist.');

    const existing = await fetchMany<any>('visual_poll_votes', (table) =>
      (table as any).select('*').eq('poll_id', pollId).eq('user_id', userId).limit(1)
    );
    const current = existing[0] as any;

    // Music polls vote per-track (listen/skip) and toggle independently.
    const independent = poll.settings.multi_select || poll.type === 'music';
    let nextOptionIds: string[];
    if (independent && current) {
      const currentIds: string[] = Array.isArray(current.option_ids)
        ? current.option_ids.map((value: unknown) => String(value))
        : [];
      const nextSet = new Set<string>(currentIds);
      if (nextSet.has(optionId)) nextSet.delete(optionId);
      else nextSet.add(optionId);
      nextOptionIds = [...nextSet];
    } else {
      if (current) {
        const currentIds: string[] = Array.isArray(current.option_ids)
          ? current.option_ids.map((value: unknown) => String(value))
          : [];
        if (currentIds.includes(optionId)) {
          if (!poll.settings.allow_change) throw new Error('You have already voted');
          nextOptionIds = [];
        } else {
          if (!poll.settings.allow_change) throw new Error('You have already voted');
          nextOptionIds = [optionId];
        }
      } else {
        nextOptionIds = [optionId];
      }
    }

    if (current) {
      if (nextOptionIds.length === 0) {
        await deleteWhere('visual_poll_votes', (table) =>
          (table as any).eq('poll_id', pollId).eq('user_id', userId)
        );
      } else {
        await upsertRows('visual_poll_votes', {
          poll_id: pollId,
          guild_id: guildId,
          user_id: userId,
          option_ids: nextOptionIds,
        }, 'poll_id,user_id');
      }
    } else {
      await upsertRows('visual_poll_votes', {
        poll_id: pollId,
        guild_id: guildId,
        user_id: userId,
        option_ids: nextOptionIds,
      }, 'poll_id,user_id');
    }

    await this.recomputeResults(poll);
    return poll;
  }

  /**
   * Removes a user's vote entirely (used by reaction toggle-off).
   */
  async removeVote(pollId: string, guildId: string, userId: string): Promise<PollRow> {
    const poll = await this.getPoll(pollId);
    if (!poll || poll.guild_id !== guildId) throw new Error('Poll not found.');
    await deleteWhere('visual_poll_votes', (table) =>
      (table as any).eq('poll_id', pollId).eq('user_id', userId)
    );
    await this.recomputeResults(poll);
    return poll;
  }

  async refreshPollMessage(poll: PollRow): Promise<void> {
    if (!poll.message_id) return;
    try {
      const guild = await this.resolveGuild(poll.guild_id);
      if (!guild) return;
      const channel = await this.resolveChannel(guild, poll.channel_id);
      if (!channel) return;
      const message = await (channel as any).messages.fetch(poll.message_id).catch(() => null);
      if (!message) return;
      await message.edit({
        flags: Number(MessageFlags.IsComponentsV2),
        components: buildPollComponents(poll),
      });
    } catch (error: any) {
      logger.warn({ pollId: poll.id, error: error.message }, 'visual poll: message refresh failed');
    }
  }

  async setStatus(pollId: string, guildId: string, status: PollStatus): Promise<PollRow> {
    const poll = await this.getPoll(pollId);
    if (!poll || poll.guild_id !== guildId) throw new Error('Poll not found.');
    await updateWhere('visual_polls', { status }, (table) => (table as any).eq('id', pollId));
    poll.status = status;
    await this.refreshPollMessage(poll);
    return poll;
  }

  /**
   * Dev-only helper: post a poll to any channel the bot can see, resolving the
   * guild from the channel. Requires no auth — only registered when not production.
   */
  async sendDevPoll(channelId: string, draft: PollDraft): Promise<PollRow> {
    const channel =
      this.client.channels.cache.get(channelId) ?? (await this.client.channels.fetch(channelId).catch(() => null));
    if (!channel) throw new Error('Channel not found — is the bot in that server?');
    const guild = (channel as any).guild;
    const guildId: string | undefined = guild?.id ?? (channel as any).guildId;
    if (!guildId) throw new Error('That channel is not in a guild');
    return this.createPoll(guildId, channelId, draft, 'dev');
  }

  async deletePoll(pollId: string, guildId: string): Promise<void> {
    const poll = await this.getPoll(pollId);
    if (!poll || poll.guild_id !== guildId) throw new Error('Poll not found.');
    if (poll.message_id) {
      try {
        const guild = await this.resolveGuild(guildId);
        if (guild) {
          const channel = await this.resolveChannel(guild, poll.channel_id);
          if (channel) {
            const message = await (channel as any).messages.fetch(poll.message_id).catch(() => null);
            await message?.delete().catch(() => null);
          }
        }
      } catch {}
    }
    await deleteWhere('visual_poll_votes', (table) => (table as any).eq('poll_id', pollId));
    await deleteWhere('visual_polls', (table) => (table as any).eq('id', pollId));
  }

  async totals(poll: PollRow): Promise<PollTotals[]> {
    return computeTotals(poll, poll.results);
  }
}
