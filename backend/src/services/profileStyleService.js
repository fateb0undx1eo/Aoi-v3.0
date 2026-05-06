import { logger } from '../utils/logger.js';

const DEFAULT_PROFILE_STYLE_CONFIG = Object.freeze({
  enabled: false,
  font_id: 11,
  effect_id: 1,
  colors: []
});

const FONT_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const EFFECT_IDS = new Set([1, 2, 3, 4, 5, 6]);

function clampColor(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > 0xffffff) return null;
  return parsed;
}

function parseHexColor(value) {
  const trimmed = String(value ?? '').trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return null;
  }

  return Number.parseInt(trimmed, 16);
}

export class ProfileStyleService {
  constructor({ client, configService, configCache, token }) {
    this.client = client;
    this.configService = configService;
    this.configCache = configCache;
    this.token = token;
  }

  normalizeConfig(rawConfig) {
    const fontId = FONT_IDS.has(Number(rawConfig?.font_id)) ? Number(rawConfig.font_id) : DEFAULT_PROFILE_STYLE_CONFIG.font_id;
    const effectId = EFFECT_IDS.has(Number(rawConfig?.effect_id)) ? Number(rawConfig.effect_id) : DEFAULT_PROFILE_STYLE_CONFIG.effect_id;
    const colors = Array.isArray(rawConfig?.colors)
      ? rawConfig.colors
          .map((value) => clampColor(value))
          .filter((value) => value !== null)
          .slice(0, 2)
      : [];

    return {
      enabled: Boolean(rawConfig?.enabled),
      font_id: fontId,
      effect_id: effectId,
      colors
    };
  }

  async getGuildConfig(guildId) {
    const cached = this.configCache.getModuleConfig(guildId, 'community');
    if (cached) {
      return this.normalizeConfig(cached.config?.profile_style);
    }

    const row = await this.configService.getModuleConfig(guildId, 'community').catch(() => null);
    return this.normalizeConfig(row?.config?.profile_style);
  }

  async updateGuildConfig(guildId, updates = {}) {
    const row = await this.configService.getModuleConfig(guildId, 'community').catch(() => null);
    const currentConfig = this.normalizeConfig(row?.config?.profile_style);
    const nextConfig = this.normalizeConfig({
      ...currentConfig,
      ...updates
    });

    await this.configService.upsertModuleConfig({
      guild_id: guildId,
      module_name: 'community',
      enabled: row?.enabled ?? true,
      config: {
        ...(row?.config ?? {}),
        profile_style: nextConfig
      }
    });
    await this.configCache.refreshGuild(guildId);
    await this.syncGuild(guildId);
    return nextConfig;
  }

  async clearGuildConfig(guildId) {
    return this.updateGuildConfig(guildId, DEFAULT_PROFILE_STYLE_CONFIG);
  }

  buildPayload(config) {
    const normalized = this.normalizeConfig(config);
    if (!normalized.enabled) {
      return {
        display_name_font_id: null,
        display_name_effect_id: null,
        display_name_colors: null
      };
    }

    return {
      display_name_font_id: normalized.font_id,
      display_name_effect_id: normalized.effect_id,
      display_name_colors: normalized.colors.length ? normalized.colors : null
    };
  }

  async applyGuildConfig(guildId, config) {
    if (!this.token) {
      logger.warn(`Profile style skipped for guild ${guildId}: missing bot token`);
      return false;
    }

    const payload = this.buildPayload(config);
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/@me`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bot ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Discord profile style update failed (${response.status}): ${text.slice(0, 200)}`);
    }

    logger.info(`Applied profile style for guild ${guildId}`);
    return true;
  }

  async syncGuild(guildId) {
    const config = await this.getGuildConfig(guildId);
    try {
      await this.applyGuildConfig(guildId, config);
    } catch (error) {
      logger.warn(`Profile style sync failed for guild ${guildId}`, error);
    }
    return config;
  }

  async restoreAll(guildIds = []) {
    for (const guildId of guildIds.filter(Boolean)) {
      await this.syncGuild(guildId);
    }
  }

  parseColorInput(value) {
    return parseHexColor(value);
  }
}
