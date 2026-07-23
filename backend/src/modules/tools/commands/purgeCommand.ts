import { ChannelType } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { checkUserPermissions, validateChannel, checkBotPermissions, activePurges, runPurge } from '../purge.js';
import type { InteractionResult } from '../../../types/index.js';

function ephemeralError(message: string): InteractionResult {
  return { type: 'ERROR', message, ephemeral: true };
}

export default {
  name: 'purge',
  description: 'Delete all messages from a text channel',
  options: [
    {
      name: 'channel',
      type: 7,
      description: 'The channel to purge messages from',
      required: true,
      channel_types: [
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement
      ]
    },
    {
      name: 'count',
      type: 4,
      description: 'Number of messages to delete (leave empty for all)',
      required: false,
      min_value: 1,
      max_value: 100000
    },
    {
      name: 'dry-run',
      type: 5,
      description: 'Scan and count messages without deleting',
      required: false
    }
  ] as any[],
  permissionOverrides: {
    discordPermissions: ['Administrator']
  },
  async execute(interaction: any): Promise<InteractionResult> {
    const guild = interaction.guild;
    if (!guild) {
      return ephemeralError('This command can only be used in a server.');
    }

    const userPermError = checkUserPermissions(interaction.member, guild);
    if (userPermError) return userPermError;

    const channel = interaction.options.getChannel('channel', true);
    const channelPermError = validateChannel(channel, guild);
    if (channelPermError) return channelPermError;

    const botPermError = checkBotPermissions(guild, channel);
    if (botPermError) return botPermError;

    if (activePurges.has(channel.id)) {
      return ephemeralError('A purge is already running in this channel. Please wait for it to finish before starting another.');
    }
    activePurges.add(channel.id);

    const count = interaction.options.getInteger('count') ?? null;
    const dryRun = interaction.options.getBoolean('dry-run') ?? false;

    try {
      let initialBatch: any;
      try {
        initialBatch = await channel.messages.fetch({ limit: 1 });
      } catch {
        return ephemeralError('Unable to read messages from this channel. Please verify the bot has proper permissions.');
      }

      if (!initialBatch || initialBatch.size === 0) {
        await interaction.editReply({
          content: `**No Messages Found**\n\nThe channel #${channel.name} is empty. There are no messages to purge.`
        });
        return { type: 'IGNORE' };
      }

      const dryLabel = dryRun ? ' (Dry Run)' : '';
      const countInfo = count
        ? `Target: ${dryRun ? 'Count' : 'Delete'} up to ${count.toLocaleString()} messages.`
        : `Target: ${dryRun ? 'Count' : 'Delete'} all messages in the channel.`;

      await interaction.editReply({
        content: [
          `**Starting Purge${dryLabel} in #${channel.name}**`,
          '',
          countInfo,
          'Using Discord\'s built-in rate limit handling for optimal speed.',
          '',
          dryRun ? 'DRY RUN MODE: Messages will be counted but not deleted.' : 'WARNING: Messages will be permanently deleted!'
        ].join('\n')
      });

      logger.info('Purge started', {
        channelId: channel.id,
        channelName: channel.name,
        count: count ?? 'all',
        dryRun,
        userId: interaction.user.id
      });

      await runPurge({ channel, count, dryRun, interaction });
      return { type: 'IGNORE' };

    } catch (error: any) {
      logger.error('Purge: unexpected error', {
        error: error.message,
        stack: error.stack
      });

      try {
        await interaction.editReply({
          content: `**Error**\n\nAn unexpected error occurred while running the purge: ${error.message}`
        });
      } catch {}

      return { type: 'ERROR', message: `An unexpected error occurred: ${error.message}`, ephemeral: true };
    } finally {
      activePurges.delete(channel.id);
    }
  }
};
