import type { Client } from 'discord.js';
import { logger } from '../utils/logger.js';

interface ProfileStyleConfig {
  enabled: boolean;
  font_id: number;
  effect_id: number;
  colors: number[];
}

const DEFAULT_PROFILE_STYLE_CONFIG: ProfileStyleConfig = Object.freeze({
  enabled: false,
  font_id: 11,
  effect_id: 1,
  colors: []
});

const FONT_IDS: Set<number> = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const EFFECT_IDS: Set<number> = new Set([1, 2, 3, 4, 5, 6]);

interface ProfileStylePayload {
  display_name_font_id: number | null;
  display_name_effect_id: number | null;
  display_name_colors: number[] | null;
}

interface ModuleConfigRow {
  guild_id: string;
  module_name: string;
  enabled: boolean;
  config: Record<string, any>;
  updated_at: string;
}

interface ConfigServiceLike {
  getModuleConfig(guildId: string, moduleName: string): Promise<ModuleConfigRow>;
  upsertModuleConfig(data: Record<string, any>): Promise<void>;
}

interface ConfigCacheLike {
  getModuleConfig(guildId: string, moduleName: string): ModuleConfigRow | null;
  refreshGuild(guildId: string): Promise<void>;
}

interface ProfileStyleServiceOptions {
  client: Client;
  configService: ConfigServiceLike;
  configCache: ConfigCacheLike;
  token: string;
}

function clampColor(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > 0xffffff) return null;
  return parsed;
}

function parseHexColor(value: string): number | null {
  const trimmed = String(value ?? '').trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return null;
  }

  return Number.parseInt(trimmed, 16);
}

export class ProfileStyleService {
  private client: Client;
  private configService: ConfigServiceLike;
  private configCache: ConfigCacheLike;
  private token: string;

  constructor({ client, configService, configCache, token }: ProfileStyleServiceOptions) {
    this.client = client;
    this.configService = configService;
    this.configCache = configCache;
    this.token = token;
  }

  normalizeConfig(rawConfig: Record<string, any>): ProfileStyleConfig {
    const fontId = FONT_IDS.has(Number(rawConfig?.font_id)) ? Number(rawConfig.font_id) : DEFAULT_PROFILE_STYLE_CONFIG.font_id;
    const effectId = EFFECT_IDS.has(Number(rawConfig?.effect_id)) ? Number(rawConfig.effect_id) : DEFAULT_PROFILE_STYLE_CONFIG.effect_id;
    const colors = Array.isArray(rawConfig?.colors)
      ? (rawConfig.colors as any[])
          .map((value) => clampColor(value))
          .filter((value): value is number => value !== null)
          .slice(0, 2)
      : [];

    return {
      enabled: Boolean(rawConfig?.enabled),
      font_id: fontId,
      effect_id: effectId,
      colors
    };
  }

  async getGuildConfig(guildId: string): Promise<ProfileStyleConfig> {
    const cached = this.configCache.getModuleConfig(guildId, 'community');
    if (cached) {
      return this.normalizeConfig(cached.config?.profile_style);
    }

    const row = await this.configService.getModuleConfig(guildId, 'community').catch(() => null);
    return this.normalizeConfig((row as ModuleConfigRow)?.config?.profile_style);
  }

  async updateGuildConfig(guildId: string, updates: Record<string, any> = {}): Promise<ProfileStyleConfig> {
    const row = await this.configService.getModuleConfig(guildId, 'community').catch(() => null);
    const currentConfig = this.normalizeConfig((row as ModuleConfigRow)?.config?.profile_style);
    const nextConfig = this.normalizeConfig({
      ...currentConfig,
      ...updates
    });

    await this.configService.upsertModuleConfig({
      guild_id: guildId,
      module_name: 'community',
      enabled: (row as ModuleConfigRow)?.enabled ?? true,
      config: {
        ...((row as ModuleConfigRow)?.config ?? {}),
        profile_style: nextConfig
      }
    });
    await this.configCache.refreshGuild(guildId);
    await this.syncGuild(guildId);
    return nextConfig;
  }

  async clearGuildConfig(guildId: string): Promise<ProfileStyleConfig> {
    return this.updateGuildConfig(guildId, DEFAULT_PROFILE_STYLE_CONFIG);
  }

  buildPayload(config: Record<string, any>): ProfileStylePayload {
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

  async applyGuildConfig(guildId: string, config: Record<string, any>): Promise<boolean> {
    if (!this.token) {
      logger.warn(`Profile style skipped for guild ${guildId}: missing bot token`);
      return false;
    }

    const payload = this.buildPayload(config);
    logger.info(`[ProfileStyle] PATCH guild=${guildId} payload=${JSON.stringify(payload)}`);

    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/@me`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bot ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    logger.info(`[ProfileStyle] Response status=${response.status}`);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.error(`[ProfileStyle] Discord API error (${response.status}): ${text.slice(0, 500)}`);
      throw new Error(`Discord profile style update failed (${response.status}): ${text.slice(0, 200)}`);
    }

    const body = await response.text().catch(() => '');
    if (body) logger.info(`[ProfileStyle] Response body: ${body}`);

    logger.info(`Applied profile style for guild ${guildId}`);
    return true;
  }

  async syncGuild(guildId: string): Promise<ProfileStyleConfig> {
    const config = await this.getGuildConfig(guildId);
    try {
      await this.applyGuildConfig(guildId, config);
    } catch (error) {
      logger.error(`[ProfileStyle] Sync failed for guild ${guildId}`, error);
      throw error;
    }
    return config;
  }

  async restoreAll(guildIds: string[] = []): Promise<void> {
    for (const guildId of guildIds.filter(Boolean)) {
      await this.syncGuild(guildId);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  parseColorInput(value: string): number | null {
    return parseHexColor(value);
  }
}
