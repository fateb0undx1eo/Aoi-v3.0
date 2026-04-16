import { fetchMany, upsertRows } from '../database/repository.js';

const CHANNEL_ACTIVITY_KEY = 'channels_activity';
const DEFAULT_CHANNEL_ACTIVITY_CONFIG = {
  enabled: false,
  default_delete_seconds: 15
};

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}

function normalizeChannelActivityConfig(config = {}) {
  return {
    enabled: Boolean(config.enabled),
    default_delete_seconds: clampInteger(
      config.default_delete_seconds,
      0,
      3600,
      DEFAULT_CHANNEL_ACTIVITY_CONFIG.default_delete_seconds
    )
  };
}

export class ToolsService {
  constructor(configService = null) {
    this.configService = configService;
  }

  async getModuleRow(guildId) {
    if (!this.configService) return null;
    return this.configService.getModuleConfig(guildId, 'tools').catch(() => null);
  }

  async getChannelActivityConfig(guildId) {
    const row = await this.getModuleRow(guildId);
    return normalizeChannelActivityConfig(row?.config?.[CHANNEL_ACTIVITY_KEY] ?? DEFAULT_CHANNEL_ACTIVITY_CONFIG);
  }

  async upsertAutoresponder(payload) {
    return upsertRows('autoresponders', payload, 'guild_id,trigger_pattern');
  }

  async listAutoresponders(guildId) {
    return fetchMany('autoresponders', (table) =>
      table.select('*').eq('guild_id', guildId).order('created_at', { ascending: false })
    );
  }

  async upsertSticky(payload) {
    return upsertRows('sticky_messages', payload, 'guild_id,channel_id');
  }

  async listStickies(guildId) {
    return fetchMany('sticky_messages', (table) =>
      table.select('*').eq('guild_id', guildId).order('id', { ascending: false })
    );
  }

  async upsertEmbedTemplate(payload) {
    return upsertRows('embed_templates', payload, 'guild_id,name');
  }

  async listEmbedTemplates(guildId) {
    return fetchMany('embed_templates', (table) =>
      table.select('*').eq('guild_id', guildId).order('id', { ascending: false })
    );
  }

  scheduleBulkDelete(messages, delaySeconds) {
    if (!Array.isArray(messages) || messages.length === 0 || delaySeconds <= 0) {
      return;
    }

    setTimeout(() => {
      for (const message of messages) {
        message.delete().catch(() => null);
      }
    }, delaySeconds * 1000);
  }

  async broadcastToGuildChannels(guild, content, deleteAfterSeconds = 0) {
    const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
    if (!me) {
      throw new Error('Bot member context could not be resolved.');
    }

    const channels = [...guild.channels.cache.values()]
      .filter((channel) => channel?.guild?.id === guild.id)
      .filter((channel) => typeof channel.send === 'function' && channel.isTextBased?.())
      .filter((channel) => {
        const permissions = channel.permissionsFor?.(me);
        return permissions?.has?.(['ViewChannel', 'SendMessages'], true);
      });

    const sentMessages = [];
    const failures = [];

    for (const channel of channels) {
      try {
        const message = await channel.send({
          content,
          allowedMentions: { parse: [] }
        });
        sentMessages.push(message);
      } catch (error) {
        failures.push({
          channelId: channel.id,
          reason: error?.message || 'send failed'
        });
      }
    }

    this.scheduleBulkDelete(sentMessages, deleteAfterSeconds);

    return {
      attempted: channels.length,
      sent: sentMessages.length,
      failed: failures.length,
      failures
    };
  }
}
