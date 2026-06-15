import type { Client, Guild, Role } from 'discord.js';
import { logger } from '../utils/logger.js';
import type { ConfigService } from '../types/index.js';

const FEATURE_KEY = 'role_color_rotation';
const DEFAULT_CONFIG = {
  enabled: false,
  interval_value: 1,
  interval_unit: 'minutes',
  role_ids: [] as string[],
};
const MIN_SECONDS_INTERVAL = 10;

interface RoleColorRotationConfig {
  enabled: boolean;
  interval_value: number;
  interval_unit: string;
  role_ids: string[];
}

interface RotationResult {
  changed: number;
  skipped: boolean;
}

interface RoleColorRotationServiceOptions {
  client: Client;
  configService: ConfigService;
  configCache: any;
}

function toPositiveInteger(value: any, fallback: number = 1): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeUnit(unit: string): string {
  if (unit === 'seconds' || unit === 'hours') return unit;
  return 'minutes';
}

function normalizeIntervalValue(value: any, unit: string): number {
  const parsed = toPositiveInteger(value, DEFAULT_CONFIG.interval_value);
  if (unit === 'seconds') {
    return Math.max(MIN_SECONDS_INTERVAL, parsed);
  }
  return parsed;
}

function intervalToMs(config: RoleColorRotationConfig): number {
  const unit = normalizeUnit(config.interval_unit);
  const value = normalizeIntervalValue(config.interval_value, unit);

  if (unit === 'seconds') return value * 1000;
  if (unit === 'hours') return value * 60 * 60 * 1000;
  return value * 60 * 1000;
}

function sanitizeRoleIds(roleIds: any): string[] {
  if (!Array.isArray(roleIds)) return [];
  return [...new Set(roleIds.map((value: any) => String(value)).filter(Boolean))];
}

function normalizeConfig(config: Record<string, any> = {}): RoleColorRotationConfig {
  const intervalUnit = normalizeUnit(config.interval_unit);
  return {
    enabled: Boolean(config.enabled),
    interval_value: normalizeIntervalValue(config.interval_value, intervalUnit),
    interval_unit: intervalUnit,
    role_ids: sanitizeRoleIds(config.role_ids),
  };
}

function mergeCommunityConfig(config: Record<string, any> = {}, roleColorConfig: RoleColorRotationConfig): Record<string, any> {
  return {
    ...config,
    [FEATURE_KEY]: roleColorConfig,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hslToColorInt(hue: number, saturation: number, lightness: number): number {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 100) / 100;
  const l = clamp(lightness, 0, 100) / 100;

  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const huePrime = h / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime >= 0 && huePrime < 1) {
    red = chroma;
    green = x;
  } else if (huePrime < 2) {
    red = x;
    green = chroma;
  } else if (huePrime < 3) {
    green = chroma;
    blue = x;
  } else if (huePrime < 4) {
    green = x;
    blue = chroma;
  } else if (huePrime < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const match = l - chroma / 2;
  const r = Math.round((red + match) * 255);
  const g = Math.round((green + match) * 255);
  const b = Math.round((blue + match) * 255);

  return (r << 16) + (g << 8) + b;
}

function generateDistinctColors(count: number): number[] {
  const used = new Set<number>();
  const colors: number[] = [];
  const baseHue = Math.random() * 360;
  const hueStep = 360 / Math.max(count, 1);

  for (let index = 0; index < count; index += 1) {
    let attempt = 0;
    let color = 0;

    while (attempt < 12) {
      const hueJitter = (Math.random() * 12) - 6;
      const hue = baseHue + index * hueStep + hueJitter + attempt * 3;
      const saturation = 72 + Math.floor(Math.random() * 18);
      const lightness = 45 + Math.floor(Math.random() * 14);
      color = hslToColorInt(hue, saturation, lightness);

      if (!used.has(color)) {
        break;
      }

      attempt += 1;
    }

    used.add(color);
    colors.push(color);
  }

  return colors;
}

export class RoleColorRotationService {
  private client: Client;
  private configService: ConfigService;
  private configCache: any;
  private timers: Map<string, ReturnType<typeof setTimeout>>;

  constructor({ client, configService, configCache }: RoleColorRotationServiceOptions) {
    this.client = client;
    this.configService = configService;
    this.configCache = configCache;
    this.timers = new Map();
  }

  getConfigFromModuleRow(row: Record<string, any> | null): RoleColorRotationConfig {
    return normalizeConfig((row?.config as Record<string, any>)?.[FEATURE_KEY] ?? DEFAULT_CONFIG);
  }

  async getGuildConfig(guildId: string): Promise<RoleColorRotationConfig> {
    const row = await this.configService.getModuleConfig(guildId, 'community').catch(() => null);
    return this.getConfigFromModuleRow(row);
  }

  async updateGuildConfig(guildId: string, updates: Record<string, any> = {}): Promise<RoleColorRotationConfig> {
    const row = await this.configService.getModuleConfig(guildId, 'community').catch(() => null);
    const existingConfig = (row?.config as Record<string, any>) ?? {};
    const nextRoleColorConfig = normalizeConfig({
      ...this.getConfigFromModuleRow(row),
      ...updates,
    });

    await this.configService.upsertModuleConfig({
      guild_id: guildId,
      module_name: 'community',
      enabled: (row?.enabled as boolean) ?? true,
      config: mergeCommunityConfig(existingConfig, nextRoleColorConfig),
    });

    await this.configCache.refreshGuild(guildId);
    await this.syncGuild(guildId);

    return nextRoleColorConfig;
  }

  clearGuildTimer(guildId: string): void {
    const existing = this.timers.get(guildId);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(guildId);
    }
  }

  scheduleGuild(guildId: string, config: RoleColorRotationConfig): void {
    this.clearGuildTimer(guildId);

    if (!config.enabled || config.role_ids.length === 0) {
      return;
    }

    const delay = intervalToMs(config);
    const timer = setTimeout(async () => {
      try {
        await this.rotateGuildRoles(guildId, config);
      } catch (error) {
        logger.error(`Role color rotation failed for guild ${guildId}`, error);
      } finally {
        await this.syncGuild(guildId);
      }
    }, delay);

    this.timers.set(guildId, timer);
  }

  async syncGuild(guildId: string): Promise<RoleColorRotationConfig> {
    const config = await this.getGuildConfig(guildId);
    this.scheduleGuild(guildId, config);
    return config;
  }

  async restoreAll(guildIds: string[] = []): Promise<void> {
    await Promise.all(guildIds.map((guildId) => this.syncGuild(guildId)));
  }

  async rotateGuildRoles(guildId: string, config: RoleColorRotationConfig | null = null): Promise<RotationResult> {
    const activeConfig = normalizeConfig(config ?? (await this.getGuildConfig(guildId)));
    if (!activeConfig.enabled || activeConfig.role_ids.length === 0) {
      this.clearGuildTimer(guildId);
      return { changed: 0, skipped: true };
    }

    const guild = this.client.guilds.cache.get(guildId) ?? (await this.client.guilds.fetch(guildId).catch(() => null));
    if (!guild) {
      return { changed: 0, skipped: true };
    }

    const roles = activeConfig.role_ids
      .map((roleId: string) => guild.roles.cache.get(roleId))
      .filter((role): role is Role => !!role && !role.managed && role.editable);

    if (roles.length === 0) {
      return { changed: 0, skipped: true };
    }

    const nextColors = generateDistinctColors(roles.length);

    await Promise.allSettled(
      roles.map((role, index) =>
        role.setColor(nextColors[index]!, 'Randomized role color rotation').catch((error) => {
          logger.warn(`Failed to update color for role ${role.id} in guild ${guildId}`, error);
        })
      )
    );

    return { changed: roles.length, skipped: false };
  }
}
