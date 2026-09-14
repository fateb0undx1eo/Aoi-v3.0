import type { BotContext } from '../../../types/index.js';
import { isAdminOrOwner } from '../../moderation/helpers.js';
import { resolveTrackMetadata } from '../../../api/routes/oembedRoutes.js';

const MIN_DELAY_MS = 60_000;
const MAX_DELAY_MS = 30 * 24 * 60 * 60 * 1000;

const DURATION_RE = /^(\d+)\s*([mhdw])$/i;

function parseEndsIn(raw: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'never') return null;
  const match = DURATION_RE.exec(trimmed.replace(/\s+/g, ''));
  if (!match) return undefined as unknown as number | null;
  const amount = Number(match[1]);
  const unit = (match[2] ?? '').toLowerCase();
  const multiplier =
    unit === 'm' ? 60_000
    : unit === 'h' ? 3_600_000
    : unit === 'd' ? 86_400_000
    : unit === 'w' ? 604_800_000
    : 0;
  if (!Number.isFinite(amount) || amount <= 0 || !multiplier) return undefined as unknown as number | null;
  return amount * multiplier;
}

/**
 * /music poll — post a dashboard-identical music poll from a track link.
 * Same VisualPollService.createPoll path as the studio, so the message is the
 * same Components V2 container with the track cover card + LISTEN/SKIP buttons.
 * Gated to server owner, admins, and the STAFF role id env var.
 */
export default {
  name: 'music',
  description: 'Post a music poll',
  options: [
    {
      name: 'poll',
      type: 1,
      description: 'Post a music poll from a Spotify or YouTube link',
      options: [
        {
          name: 'link',
          type: 3,
          description: 'Spotify or YouTube track link',
          required: true,
        },
        {
          name: 'channel',
          type: 7,
          description: 'Channel to post in (defaults to this channel)',
          required: false,
          channel_types: [0, 5],
        },
        {
          name: 'ends_in',
          type: 3,
          description: 'When voting closes: never, 30m, 12h, 3d, 2w …',
          required: false,
        },
      ],
    },
  ],
  async execute(interaction: any, context: BotContext): Promise<void> {
    const services = (context as any)?.services;
    const subcommand = interaction.options.getSubcommand(true);
    if (subcommand !== 'poll') {
      await interaction.editReply('Unsupported music action.');
      return;
    }

    const staffRoleId = process.env.STAFF;
    const isStaff = staffRoleId ? interaction.member?.roles?.cache?.has(staffRoleId) : false;
    if (!isAdminOrOwner(interaction.member, interaction.guild) && !isStaff) {
      await interaction.editReply('You do not have permission to use this command.');
      return;
    }

    const link = String(interaction.options.getString('link', true) ?? '').trim();
    if (!/^https?:\/\//i.test(link)) {
      await interaction.editReply('That does not look like a link. Paste a full Spotify or YouTube URL.');
      return;
    }

    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    if (!channel?.id || !channel?.isTextBased?.()) {
      await interaction.editReply('Pick a text channel for the poll.');
      return;
    }

    const endsRaw = interaction.options.getString('ends_in');
    const delayMs = parseEndsIn(endsRaw);
    if (endsRaw && delayMs === (undefined as unknown as number | null)) {
      await interaction.editReply('Bad `ends_in`. Use e.g. `never`, `30m`, `12h`, `3d`, `2w`.');
      return;
    }
    if (delayMs != null && (delayMs < MIN_DELAY_MS || delayMs > MAX_DELAY_MS)) {
      await interaction.editReply('`ends_in` must be between 1 minute and 30 days.');
      return;
    }

    let track;
    try {
      track = await resolveTrackMetadata(link);
    } catch {
      track = null;
    }
    if (!track?.title || !track?.thumbnail_url) {
      await interaction.editReply('Could not fetch that track. Check the link is a public Spotify or YouTube track.');
      return;
    }

    const endsAt = delayMs != null ? new Date(Date.now() + delayMs).toISOString() : null;

    try {
      const poll = await services.visualPollService.createPoll(
        interaction.guildId,
        channel.id,
        {
          type: 'music',
          title: '',
          subtitle: '',
          options: [
            {
              id: 'track',
              label: track.title,
              image_url: track.thumbnail_url,
              track_url: link,
              track_artist: track.artist,
              track_duration: track.duration,
            },
          ],
          settings: {
            vote_method: 'buttons',
            multi_select: false,
            allow_change: false,
            show_results: 'after_vote',
            accent_color: '#e11d48',
            background_top: '#101014',
            background_bottom: '#1b1b23',
            ends_at: endsAt,
            instructions: '',
          },
        },
        interaction.user.id
      );
      const jump = poll?.message_id
        ? `https://discord.com/channels/${interaction.guildId}/${channel.id}/${poll.message_id}`
        : null;
      await interaction.editReply(
        jump ? `Music poll posted: ${jump}` : 'Music poll posted.'
      );
    } catch (error: any) {
      await interaction.editReply(error instanceof Error ? error.message : 'Failed to post the music poll.');
    }
  },
};
