import { EmbedBuilder } from 'discord.js';

const MODERATION_SCHEMA = {
  type: 'object',
  properties: {
    ghost_ping_window_seconds: { type: 'number' },
    ping_protection_roles: { type: 'array', items: { type: 'string' } },
    afk: { type: 'object' },
    loa: { type: 'object' }
  }
};

function colorFor(type) {
  switch (type) {
    case 'BAN':
    case 'TEMPBAN':
      return 0xed4245;
    case 'KICK':
      return 0xfaa61a;
    case 'WARN':
      return 0xfee75c;
    case 'MUTE':
    case 'TIMEOUT':
      return 0x5865f2;
    case 'UNBAN':
    case 'UNMUTE':
      return 0x57f287;
    default:
      return 0x808080;
  }
}

function formatDuration(seconds) {
  if (!seconds) return 'Permanent';
  if (seconds >= 86400) return `${Math.floor(seconds / 86400)} day(s)`;
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)} hour(s)`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)} minute(s)`;
  return `${seconds} second(s)`;
}

function caseEmbed(title, description, color) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
}

export default {
  name: 'moderation',
  configSchema: MODERATION_SCHEMA,
  commands: [],
  events: [
    {
      name: 'messageDelete',
      async execute(message, { services }) {
        if (!message?.guild || !message.mentions?.users?.size) return;

        await services.moderationService.recordGhostPing({
          guild_id: message.guild.id,
          message_id: message.id,
          channel_id: message.channel.id,
          author_id: message.author?.id ?? null,
          mentions: [...message.mentions.users.keys()],
          created_at: new Date().toISOString()
        });
      }
    },
    {
      name: 'messageCreate',
      async execute(message, { services }) {
        if (!message.guild || message.author.bot) return;

        const afk = await services.moderationService.getAfk(message.guild.id, message.author.id);
        if (afk) {
          await services.moderationService.clearAfk(message.guild.id, message.author.id);
          await message.channel.send({
            embeds: [caseEmbed('Welcome Back', `<@${message.author.id}> your AFK status has been removed.`, 0x57f287)]
          });
        }

        await services.moderationService.touchLoaLastSeen(message.guild.id, message.author.id).catch(() => null);
      }
    }
  ]
};
