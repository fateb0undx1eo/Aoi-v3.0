import type { Guild, Message, TextBasedChannel } from 'discord.js';
import { fetchMany, upsertRows } from '../database/repository.js';
import type { ConfigService } from '../types/index.js';

const CHANNEL_ACTIVITY_KEY = 'channels_activity';
const DEFAULT_CHANNEL_ACTIVITY_CONFIG = {
  enabled: false,
  default_delete_seconds: 15,
};

interface ChannelActivityConfig {
  enabled: boolean;
  default_delete_seconds: number;
}

interface BroadcastFailure {
  channelId: string;
  reason: string;
}

interface BroadcastResult {
  attempted: number;
  sent: number;
  failed: number;
  failures: BroadcastFailure[];
}

function clampInteger(value: any, minimum: number, maximum: number, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}

function normalizeChannelActivityConfig(config: Record<string, any> = {}): ChannelActivityConfig {
  return {
    enabled: Boolean(config.enabled),
    default_delete_seconds: clampInteger(
      config.default_delete_seconds,
      0,
      3600,
      DEFAULT_CHANNEL_ACTIVITY_CONFIG.default_delete_seconds
    ),
  };
}

export class ToolsService {
  private configService: ConfigService | null;

  constructor(configService: ConfigService | null = null) {
    this.configService = configService;
  }

  async getModuleRow(guildId: string): Promise<Record<string, any> | null> {
    if (!this.configService) return null;
    return this.configService.getModuleConfig(guildId, 'tools').catch(() => null);
  }

  async getChannelActivityConfig(guildId: string): Promise<ChannelActivityConfig> {
    const row = await this.getModuleRow(guildId);
    return normalizeChannelActivityConfig((row?.config as Record<string, any>)?.[CHANNEL_ACTIVITY_KEY] ?? DEFAULT_CHANNEL_ACTIVITY_CONFIG);
  }

  async upsertAutoresponder(payload: Record<string, any>): Promise<void> {
    return upsertRows('autoresponders', payload, 'guild_id,trigger_pattern');
  }

  async listAutoresponders(guildId: string): Promise<any[]> {
    return fetchMany('autoresponders', (table) =>
      table.select('*').eq('guild_id', guildId).order('created_at', { ascending: false })
    );
  }

  async upsertSticky(payload: Record<string, any>): Promise<void> {
    return upsertRows('sticky_messages', payload, 'guild_id,channel_id');
  }

  async listStickies(guildId: string): Promise<any[]> {
    return fetchMany('sticky_messages', (table) =>
      table.select('*').eq('guild_id', guildId).order('id', { ascending: false })
    );
  }

  async upsertEmbedTemplate(payload: Record<string, any>): Promise<void> {
    return upsertRows('embed_templates', payload, 'guild_id,name');
  }

  async listEmbedTemplates(guildId: string): Promise<any[]> {
    return fetchMany('embed_templates', (table) =>
      table.select('*').eq('guild_id', guildId).order('id', { ascending: false })
    );
  }

  scheduleBulkDelete(messages: Message[], delaySeconds: number): void {
    if (!Array.isArray(messages) || messages.length === 0 || delaySeconds <= 0) {
      return;
    }

    setTimeout(() => {
      for (const message of messages) {
        message.delete().catch(() => null);
      }
    }, delaySeconds * 1000);
  }

  async broadcastToGuildChannels(guild: Guild, content: string, deleteAfterSeconds: number = 0): Promise<BroadcastResult> {
    const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
    if (!me) {
      throw new Error('Bot member context could not be resolved.');
    }

    const channels = [...guild.channels.cache.values()]
      .filter((channel) => typeof (channel as any).send === 'function' && channel.isTextBased?.())
      .map((channel) => channel as any);

    const sentMessages: Message[] = [];
    const failures: BroadcastFailure[] = [];

    for (const channel of channels) {
      try {
        const message = await (channel as any).send({
          content,
          allowedMentions: { parse: [] },
        });
        sentMessages.push(message);
      } catch (error: any) {
        failures.push({
          channelId: channel.id,
          reason: error?.message || 'send failed',
        });
      }
    }

    this.scheduleBulkDelete(sentMessages, deleteAfterSeconds);

    return {
      attempted: channels.length,
      sent: sentMessages.length,
      failed: failures.length,
      failures,
    };
  }
}
