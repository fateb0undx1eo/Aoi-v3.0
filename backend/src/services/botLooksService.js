import { ActivityType } from 'discord.js';
import { logger } from '../utils/logger.js';

const DEFAULT_BOT_LOOKS_CONFIG = Object.freeze({
  enabled: false,
  status: 'online',
  activity_type: 'custom',
  activity_text: '',
  custom_status: '',
  streaming_url: ''
});

const STATUS_VALUES = new Set(['online', 'idle', 'dnd', 'invisible']);
const ACTIVITY_TYPE_MAP = {
  playing: ActivityType.Playing,
  streaming: ActivityType.Streaming,
  listening: ActivityType.Listening,
  watching: ActivityType.Watching,
  competing: ActivityType.Competing,
  custom: ActivityType.Custom
};

function trimToLength(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function isValidStreamUrl(value) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export class BotLooksService {
  constructor({ client, configService, configCache, preferredGuildId = null }) {
    this.client = client;
    this.configService = configService;
    this.configCache = configCache;
    this.preferredGuildId = preferredGuildId;
    this.activeGuildId = null;
  }

  normalizeConfig(rawConfig) {
    const status = STATUS_VALUES.has(rawConfig?.status) ? rawConfig.status : DEFAULT_BOT_LOOKS_CONFIG.status;
    const activityType = Object.hasOwn(ACTIVITY_TYPE_MAP, rawConfig?.activity_type)
      ? rawConfig.activity_type
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

  async getGuildConfig(guildId) {
    const cached = this.configCache.getModuleConfig(guildId, 'community');
    if (cached) {
      return this.normalizeConfig(cached.config?.bot_looks);
    }

    const row = await this.configService.getModuleConfig(guildId, 'community').catch(() => null);
    return this.normalizeConfig(row?.config?.bot_looks);
  }

  buildPresenceData(config) {
    const normalized = this.normalizeConfig(config);
    const activities = [];

    if (normalized.activity_type === 'custom') {
      const state = normalized.custom_status || normalized.activity_text;
      if (state) {
        activities.push({
          type: ACTIVITY_TYPE_MAP.custom,
          name: 'Custom Status',
          state
        });
      }
    } else if (normalized.activity_text) {
      const activity = {
        type: ACTIVITY_TYPE_MAP[normalized.activity_type],
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

  async applyGuildConfig(guildId, config) {
    if (!this.client.user) {
      return false;
    }

    this.client.user.setPresence(this.buildPresenceData(config));
    this.activeGuildId = guildId;
    logger.info(`Applied bot looks from guild ${guildId}`);
    return true;
  }

  async reset() {
    if (!this.client.user) {
      return false;
    }

    this.client.user.setPresence({
      status: DEFAULT_BOT_LOOKS_CONFIG.status,
      activities: []
    });
    this.activeGuildId = null;
    logger.info('Reset bot looks to default presence');
    return true;
  }

  async restoreAll(guildIds = []) {
    const orderedGuildIds = Array.from(
      new Set([this.preferredGuildId, ...guildIds].filter(Boolean))
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

  async syncGuild(guildId) {
    const config = await this.getGuildConfig(guildId);

    if (config.enabled) {
      await this.applyGuildConfig(guildId, config);
      return config;
    }

    if (this.activeGuildId === guildId) {
      await this.restoreAll(this.client.guilds.cache.map((guild) => guild.id).filter((id) => id !== guildId));
    }

    return config;
  }
}
