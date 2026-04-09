import { logger } from '../utils/logger.js';

const FEATURE_KEY = 'role_color_rotation';
const DEFAULT_CONFIG = {
  enabled: false,
  interval_value: 1,
  interval_unit: 'minutes',
  role_ids: []
};
const MIN_SECONDS_INTERVAL = 10;

function toPositiveInteger(value, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeUnit(unit) {
  if (unit === 'seconds' || unit === 'hours') return unit;
  return 'minutes';
}

function normalizeIntervalValue(value, unit) {
  const parsed = toPositiveInteger(value, DEFAULT_CONFIG.interval_value);
  if (unit === 'seconds') {
    return Math.max(MIN_SECONDS_INTERVAL, parsed);
  }
  return parsed;
}

function intervalToMs(config) {
  const unit = normalizeUnit(config.interval_unit);
  const value = normalizeIntervalValue(config.interval_value, unit);

  if (unit === 'seconds') return value * 1000;
  if (unit === 'hours') return value * 60 * 60 * 1000;
  return value * 60 * 1000;
}

function sanitizeRoleIds(roleIds) {
  if (!Array.isArray(roleIds)) return [];
  return [...new Set(roleIds.map((value) => String(value)).filter(Boolean))];
}

function normalizeConfig(config = {}) {
  const intervalUnit = normalizeUnit(config.interval_unit);
  return {
    enabled: Boolean(config.enabled),
    interval_value: normalizeIntervalValue(config.interval_value, intervalUnit),
    interval_unit: intervalUnit,
    role_ids: sanitizeRoleIds(config.role_ids)
  };
}

function mergeCommunityConfig(config = {}, roleColorConfig) {
  return {
    ...config,
    [FEATURE_KEY]: normalizeConfig(roleColorConfig)
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hslToColorInt(hue, saturation, lightness) {
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

function generateDistinctColors(count) {
  const used = new Set();
  const colors = [];
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
  constructor({ client, configService, configCache }) {
    this.client = client;
    this.configService = configService;
    this.configCache = configCache;
    this.timers = new Map();
  }

  getConfigFromModuleRow(row) {
    return normalizeConfig(row?.config?.[FEATURE_KEY] ?? DEFAULT_CONFIG);
  }

  async getGuildConfig(guildId) {
    const row = await this.configService.getModuleConfig(guildId, 'community').catch(() => null);
    return this.getConfigFromModuleRow(row);
  }

  async updateGuildConfig(guildId, updates = {}) {
    const row = await this.configService.getModuleConfig(guildId, 'community').catch(() => null);
    const existingConfig = row?.config ?? {};
    const nextRoleColorConfig = normalizeConfig({
      ...this.getConfigFromModuleRow(row),
      ...updates
    });

    await this.configService.upsertModuleConfig({
      guild_id: guildId,
      module_name: 'community',
      enabled: row?.enabled ?? true,
      config: mergeCommunityConfig(existingConfig, nextRoleColorConfig)
    });

    await this.configCache.refreshGuild(guildId);
    await this.syncGuild(guildId);

    return nextRoleColorConfig;
  }

  clearGuildTimer(guildId) {
    const existing = this.timers.get(guildId);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(guildId);
    }
  }

  scheduleGuild(guildId, config) {
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

  async syncGuild(guildId) {
    const config = await this.getGuildConfig(guildId);
    this.scheduleGuild(guildId, config);
    return config;
  }

  async restoreAll(guildIds = []) {
    await Promise.all(guildIds.map((guildId) => this.syncGuild(guildId)));
  }

  async rotateGuildRoles(guildId, config = null) {
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
      .map((roleId) => guild.roles.cache.get(roleId))
      .filter((role) => role && !role.managed && role.editable);

    if (roles.length === 0) {
      return { changed: 0, skipped: true };
    }

    const nextColors = generateDistinctColors(roles.length);

    for (let index = 0; index < roles.length; index += 1) {
      const role = roles[index];
      const color = nextColors[index];
      await role.setColor(color, 'Randomized role color rotation').catch((error) => {
        logger.warn(`Failed to update color for role ${role.id} in guild ${guildId}`, error);
      });
    }

    return { changed: roles.length, skipped: false };
  }
}
