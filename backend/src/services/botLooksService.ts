import { ActivityType, type Client } from 'discord.js';
import { logger } from '../utils/logger.js';
import type { ConfigService, ConfigCache as ConfigCacheBase } from '../types/index.js';

interface ConfigCache extends ConfigCacheBase {
  getModuleConfig(guildId: string, moduleName: string): Record<string, any> | null;
}

interface BotLooksConfig {
  enabled: boolean;
  status: string;
  activity_type: string;
  activity_text: string;
  custom_status: string;
  streaming_url: string;
}

interface BotLooksServiceOptions {
  client: Client;
  configService: ConfigService;
  configCache: ConfigCache;
  preferredGuildId?: string | null;
}

const DEFAULT_BOT_LOOKS_CONFIG: BotLooksConfig = Object.freeze({
  enabled: false,
  status: 'online',
  activity_type: 'custom',
  activity_text: '',
  custom_status: '',
  streaming_url: ''
});

const STATUS_VALUES = new Set<string>(['online', 'idle', 'dnd', 'invisible']);

const ACTIVITY_TYPE_MAP: Record<string, number> = {
  playing: ActivityType.Playing,
  streaming: ActivityType.Streaming,
  listening: ActivityType.Listening,
  watching: ActivityType.Watching,
  competing: ActivityType.Competing,
  custom: ActivityType.Custom
};

function trimToLength(value: unknown, maxLength: number): string {
  return String(value ?? '').trim().slice(0, maxLength);
}

function isValidStreamUrl(value: unknown): boolean {
  if (!value) return false;

  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export class BotLooksService {
  private client: Client;
  private configService: ConfigService;
  private configCache: ConfigCache;
  private preferredGuildId: string | null;
  private activeGuildId: string | null;

  constructor({ client, configService, configCache, preferredGuildId = null }: BotLooksServiceOptions) {
    this.client = client;
    this.configService = configService;
    this.configCache = configCache;
    this.preferredGuildId = preferredGuildId ?? null;
    this.activeGuildId = null;
  }

  normalizeConfig(rawConfig: Record<string, any> | undefined): BotLooksConfig {
    const status = STATUS_VALUES.has(rawConfig?.status) ? rawConfig!.status : DEFAULT_BOT_LOOKS_CONFIG.status;
    const activityType = Object.hasOwn(ACTIVITY_TYPE_MAP, rawConfig?.activity_type)
      ? rawConfig!.activity_type
      : DEFAULT_BOT_LOOKS_CONFIG.activity_type;

    return {
      enabled: Boolean(rawConfig?.enabled),
      status,
      activity_type: activityType,
      activity_text: trimToLength(rawConfig?.activity_text, 128),
      custom_status: trimToLength(rawConfig?.custom_status, 128),
      streaming_url: trimToLength(rawConfig?.streaming_url, 256)
    };
  }

  async getGuildConfig(guildId: string): Promise<BotLooksConfig> {
    const cached = this.configCache.getModuleConfig(guildId, 'community');
    if (cached) {
      return this.normalizeConfig(cached.config?.bot_looks);
    }

    const row = await this.configService.getModuleConfig(guildId, 'community').catch(() => null);
    return this.normalizeConfig(row?.config?.bot_looks);
  }

  buildPresenceData(config: Record<string, any>): { status: string; activities: Array<{ type: number; name: string; state?: string; url?: string }> } {
    const normalized = this.normalizeConfig(config);
    const activities: Array<{ type: number; name: string; state?: string; url?: string }> = [];

    if (normalized.activity_type === 'custom') {
      const state = normalized.custom_status || normalized.activity_text;
      if (state) {
        activities.push({
          type: ACTIVITY_TYPE_MAP.custom!,
          name: 'Custom Status',
          state
        });
      }
    } else if (normalized.activity_text) {
      const activity: { type: number; name: string; url?: string } = {
        type: ACTIVITY_TYPE_MAP[normalized.activity_type]!,
        name: normalized.activity_text
      };

      if (normalized.activity_type === 'streaming' && isValidStreamUrl(normalized.streaming_url)) {
        activity.url = normalized.streaming_url;
      }

      activities.push(activity);
    }

    return {
      status: normalized.status,
      activities
    };
  }

  async applyGuildConfig(guildId: string, config: Record<string, any>): Promise<boolean> {
    if (!this.client.user) {
      return false;
    }

    this.client.user.setPresence(this.buildPresenceData(config) as any);
    this.activeGuildId = guildId;
    logger.info(`Applied bot looks from guild ${guildId}`);
    return true;
  }

  async reset(): Promise<boolean> {
    if (!this.client.user) {
      return false;
    }

    this.client.user.setPresence({
      status: DEFAULT_BOT_LOOKS_CONFIG.status,
      activities: []
    } as any);
    this.activeGuildId = null;
    logger.info('Reset bot looks to default presence');
    return true;
  }

  async restoreAll(guildIds: string[] = []): Promise<{ guildId: string; config: BotLooksConfig } | null> {
    const orderedGuildIds = Array.from(
      new Set([this.preferredGuildId, ...guildIds].filter(Boolean) as string[])
    );

    for (const guildId of orderedGuildIds) {
      const config = await this.getGuildConfig(guildId);
      if (!config.enabled) {
        continue;
      }

      await this.applyGuildConfig(guildId, config);
      return { guildId, config };
    }

    await this.reset();
    return null;
  }

  async syncGuild(guildId: string): Promise<BotLooksConfig> {
    const config = await this.getGuildConfig(guildId);

    if (config.enabled) {
      await this.applyGuildConfig(guildId, config);
      return config;
    }

    if (this.activeGuildId === guildId) {
      await this.restoreAll(
        this.client.guilds.cache.map((guild) => guild.id).filter((id) => id !== guildId)
      );
    }

    return config;
  }
}
