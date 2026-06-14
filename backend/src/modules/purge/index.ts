import {
  ChannelType,
  PermissionFlagsBits
} from 'discord.js';
import type { BotContext, InteractionResult, BotInteraction } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

const activePurges = new Set<string>();

interface PurgeParams {
  channel: any;
  count: number | null;
  dryRun: boolean;
  interaction: any;
}

interface ProgressTextParams {
  channelName: string;
  scanned: number;
  deleted: number;
  failed: number;
  wouldDelete?: number;
  elapsed: string;
  mode: 'count' | 'all';
  targetCount: number | null;
  status?: string;
}

function ephemeralError(message: string): InteractionResult {
  return {
    type: 'ERROR',
    message,
    ephemeral: true
  };
}

function checkUserPermissions(member: any, guild: any): InteractionResult | null {
  if (member.id === guild.ownerId) return null;
  if (member.permissions?.has?.(PermissionFlagsBits.Administrator)) return null;
  return ephemeralError('You need the Administrator permission to use this command.');
}

function checkBotPermissions(guild: any, channel: any): InteractionResult | null {
  const me = guild.members.me;
  if (!me) return ephemeralError('Unable to verify bot member in this guild.');

  const perms = channel.permissionsFor(me);
  if (!perms) return ephemeralError('Unable to check bot permissions in this channel.');

  const required = [
    { flag: PermissionFlagsBits.ViewChannel, label: 'View Channel' },
    { flag: PermissionFlagsBits.ReadMessageHistory, label: 'Read Message History' },
    { flag: PermissionFlagsBits.ManageMessages, label: 'Manage Messages' }
  ];

  const missing = required.filter(({ flag }) => !perms.has(flag));
  if (missing.length === 0) return null;

  const list = missing.map(({ label }) => label).join(', ');
  return ephemeralError(`The bot is missing required permissions in the target channel: ${list}`);
}

function validateChannel(channel: any, guild: any): InteractionResult | null {
  if (!channel) return ephemeralError('Channel not found.');
  if (channel.guild?.id !== guild.id) return ephemeralError('That channel is not in this server.');

  const allowedTypes = [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement
  ];

  if (!allowedTypes.includes(channel.type)) {
    return ephemeralError('Only text and announcement channels can be purged.');
  }

  return null;
}

function formatElapsed(startMs: number): string {
  const duration = Date.now() - startMs;
  const sec = Math.floor(duration / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function buildProgressText({ channelName, scanned, deleted, failed, wouldDelete, elapsed, mode, targetCount, status }: ProgressTextParams): string {
  const lines = [
    `**Purge in #${channelName}**`,
    `Scanned: ${scanned.toLocaleString()} | Deleted: ${deleted.toLocaleString()} | Failed: ${failed.toLocaleString()}`
  ];

  if (wouldDelete !== undefined) {
    lines.push(`Messages matching criteria: ${wouldDelete.toLocaleString()}`);
  }

  lines.push(`Elapsed: ${elapsed}`);

  if (status) {
    lines.push(`\n${status}`);
  }

  if (mode === 'count' && targetCount !== null && targetCount > 0) {
    const current = wouldDelete !== undefined ? wouldDelete : deleted;
    const pct = Math.min(100, Math.round((current / targetCount) * 100));
    lines.push(`Progress: ${pct}% (${current}/${targetCount})`);
  }

  return lines.join('\n');
}

async function safeEditReply(interaction: any, content: string): Promise<void> {
  try {
    await interaction.editReply({ content });
  } catch (err: any) {
    logger.warn('Purge: editReply failed', { code: err.code, message: err.message });
  }
}

async function runPurge({ channel, count, dryRun, interaction }: PurgeParams): Promise<void> {
  const startTime = Date.now();
  let before: string | undefined = undefined;
  let scanned = 0;
  let deleted = 0;
  let wouldDelete = 0;
  let failed = 0;
  let done = false;
  let lastProgressUpdate = 0;
  const PROGRESS_INTERVAL = 5000;

  logger.info('Purge loop starting', {
    channelId: channel.id,
    channelName: channel.name,
    count: count ?? 'all',
    dryRun
  });

  try {
    while (!done) {
      if (count !== null && (dryRun ? wouldDelete : deleted) >= count) {
        logger.info('Purge: count target reached', {
          target: count,
          deleted: dryRun ? wouldDelete : deleted
        });
        break;
      }

      let batch: any;
      try {
        batch = await channel.messages.fetch({ limit: 100, before });
        logger.debug('Purge: batch fetched', {
          size: batch.size,
          before: before ?? 'latest'
        });
      } catch (fetchError: any) {
        logger.error('Purge: fetch failed', {
          code: fetchError.code,
          message: fetchError.message
        });
        break;
      }

      if (!batch || batch.size === 0) {
        logger.info('Purge: no more messages');
        break;
      }

      for (const message of batch.values()) {
        scanned++;

        if (count !== null && (dryRun ? wouldDelete : deleted) >= count) {
          done = true;
          break;
        }

        if (dryRun) {
          wouldDelete++;
          const now = Date.now();
          if (now - lastProgressUpdate > PROGRESS_INTERVAL) {
            lastProgressUpdate = now;
            await safeEditReply(interaction, buildProgressText({
              channelName: channel.name,
              scanned,
              deleted,
              wouldDelete,
              failed,
              elapsed: formatElapsed(startTime),
              mode: count !== null ? 'count' : 'all',
              targetCount: count,
              status: 'Dry run mode active. Counting messages that would be deleted.'
            }));
          }
          continue;
        }

        try {
          await channel.client.rest.delete(
            `/channels/${channel.id}/messages/${message.id}`
          );
          deleted++;
        } catch (deleteError: any) {
          if (deleteError.code === 10008) {
            deleted++;
          } else if (deleteError.code === 10003 || deleteError.code === 50001) {
            logger.warn('Purge: channel unavailable', {
              channelId: channel.id,
              code: deleteError.code
            });
            done = true;
            break;
          } else {
            failed++;
            logger.warn('Purge: delete failed', {
              messageId: message.id,
              code: deleteError.code,
              message: deleteError.message
            });
          }
        }

        const now = Date.now();
        if (now - lastProgressUpdate > PROGRESS_INTERVAL) {
          lastProgressUpdate = now;
          await safeEditReply(interaction, buildProgressText({
            channelName: channel.name,
            scanned,
            deleted,
            failed,
            elapsed: formatElapsed(startTime),
            mode: count !== null ? 'count' : 'all',
            targetCount: count,
            status: `Processing... (${deleted} deleted so far)`
          }));
        }
      }

      before = batch.last().id;

      await safeEditReply(interaction, buildProgressText({
        channelName: channel.name,
        scanned,
        deleted,
        wouldDelete,
        failed,
        elapsed: formatElapsed(startTime),
        mode: count !== null ? 'count' : 'all',
        targetCount: count,
        status: 'Batch complete. Fetching more messages...'
      }));

      if (batch.size < 100) {
        logger.info('Purge: reached end of history');
        break;
      }
    }
  } catch (error: any) {
    logger.error('Purge: unexpected error in loop', {
      error: error.message,
      stack: error.stack
    });
  }

  const duration = Date.now() - startTime;
  const avgSpeed = duration > 0 ? ((dryRun ? wouldDelete : deleted) / (duration / 1000)).toFixed(1) : '0.0';

  const label = dryRun ? 'Dry Run' : 'Purge';
  const completionMessage = [
    `**${label} Complete in #${channel.name}**`,
    '',
    `**Final Statistics**`,
    `Messages Scanned: ${scanned.toLocaleString()}`,
  ];

  if (dryRun) {
    completionMessage.push(`Messages Matching Criteria: ${wouldDelete.toLocaleString()}`);
    completionMessage.push(`(These would have been deleted in a real purge)`);
  } else {
    completionMessage.push(`Messages Deleted: ${deleted.toLocaleString()}`);
    completionMessage.push(`Deletions Failed: ${failed.toLocaleString()}`);
  }

  completionMessage.push(
    `Total Duration: ${formatElapsed(startTime)}`,
    `Average Speed: ${avgSpeed} messages/second`,
    '',
    dryRun ? 'This was a dry run. No messages were actually deleted.' : 'All messages in the channel have been processed.'
  );

  await safeEditReply(interaction, completionMessage.join('\n'));

  logger.info('Purge completed', {
    channelId: channel.id,
    scanned,
    deleted,
    wouldDelete,
    failed,
    dryRun,
    duration: formatElapsed(startTime),
    avgSpeed
  });
}

export default {
  name: 'purge',
  configSchema: {
    type: 'object',
    properties: {}
  },
  commands: [
    {
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
      ],
      permissionOverrides: {
        discordPermissions: ['Administrator']
      },
      async execute(interaction: any): Promise<InteractionResult | void> {
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
            return;
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
        } finally {
          activePurges.delete(channel.id);
        }
      }
    }
  ],
  events: []
};
