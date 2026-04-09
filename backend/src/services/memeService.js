import { MessageFlags } from 'discord.js';
import { fetchMany, upsertRows } from '../database/repository.js';
import { logger } from '../utils/logger.js';

const FEATURE_KEY = 'meme_autopost';
const DEFAULT_CONFIG = {
  enabled: false,
  interval_value: 30,
  interval_unit: 'minutes',
  channel_id: '',
  ping_role_id: '',
  subreddits: []
};
const MIN_SECONDS_INTERVAL = 30;
const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_API_BASE = 'https://oauth.reddit.com';
const REDDIT_FETCH_TIMEOUT_MS = 12_000;

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

function sanitizeSubreddits(subreddits) {
  if (!Array.isArray(subreddits)) return [];
  return [...new Set(
    subreddits
      .map((value) => String(value ?? '').trim().replace(/^r\//i, ''))
      .map((value) => value.replace(/[^a-zA-Z0-9_]/g, ''))
      .filter(Boolean)
  )];
}

function normalizeConfig(config = {}) {
  const intervalUnit = normalizeUnit(config.interval_unit);
  return {
    enabled: Boolean(config.enabled),
    interval_value: normalizeIntervalValue(config.interval_value, intervalUnit),
    interval_unit: intervalUnit,
    channel_id: String(config.channel_id ?? '').trim(),
    ping_role_id: String(config.ping_role_id ?? '').trim(),
    subreddits: sanitizeSubreddits(config.subreddits)
  };
}

function pickRandom(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function isImagePost(post) {
  if (!post || post.over_18 || post.is_video) return false;
  const url = String(post.url_overridden_by_dest || post.url || '');
  if (!url) return false;
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
}

function buildMemeComponents({ subreddit, meme, pingRoleId }) {
  const imageUrl = meme.url_overridden_by_dest || meme.url;
  const safeTitle = String(meme.title || 'Random meme').trim();
  const ping = pingRoleId ? `<@&${pingRoleId}>` : '';

  return [
    {
      type: 17,
      components: [
        {
          type: 12,
          items: [
            {
              media: { url: imageUrl },
              description: safeTitle
            }
          ]
        },
        {
          type: 14,
          divider: true,
          spacing: 1
        },
        {
          type: 10,
          content: [
            ping,
            `From r/${subreddit}`,
            safeTitle
          ].filter(Boolean).join('\n')
        }
      ]
    }
  ];
}

function isNetworkTimeoutError(error) {
  return (
    error?.name === 'AbortError' ||
    error?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    String(error?.message || '').includes('Connect Timeout Error')
  );
}

function formatExternalError(prefix, error) {
  if (isNetworkTimeoutError(error)) {
    return `${prefix}: connection timed out`;
  }

  const causeMessage = error?.cause?.message || error?.message || 'unknown error';
  return `${prefix}: ${causeMessage}`;
}

export class MemeService {
  constructor({ configService, configCache, client, env }) {
    this.configService = configService;
    this.configCache = configCache;
    this.client = client;
    this.env = env;
    this.timers = new Map();
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  async getModuleRow(guildId) {
    return this.configService.getModuleConfig(guildId, 'community').catch(() => null);
  }

  getConfigFromModuleRow(row) {
    return normalizeConfig(row?.config?.[FEATURE_KEY] ?? DEFAULT_CONFIG);
  }

  async getGuildConfig(guildId) {
    const row = await this.getModuleRow(guildId);
    return this.getConfigFromModuleRow(row);
  }

  async updateGuildConfig(guildId, updates = {}) {
    const row = await this.getModuleRow(guildId);
    const nextConfig = normalizeConfig({
      ...this.getConfigFromModuleRow(row),
      ...updates
    });

    await this.configService.upsertModuleConfig({
      guild_id: guildId,
      module_name: 'community',
      enabled: row?.enabled ?? true,
      config: {
        ...(row?.config ?? {}),
        [FEATURE_KEY]: nextConfig
      }
    });

    await this.configCache.refreshGuild(guildId);
    await this.syncGuild(guildId);
    return nextConfig;
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

    if (!config.enabled || !config.channel_id || config.subreddits.length === 0) {
      return;
    }

    const delay = intervalToMs(config);
    const timer = setTimeout(async () => {
      try {
        await this.postGuildMeme(guildId);
      } catch (error) {
        logger.warn(formatExternalError(`Meme autopost failed for guild ${guildId}`, error));
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

  async recordFetch(guildId, subreddit, resultCount) {
    return upsertRows('meme_fetch_stats', {
      guild_id: guildId,
      subreddit,
      result_count: resultCount,
      fetched_at: new Date().toISOString()
    });
  }

  async getStats(guildId) {
    return fetchMany('meme_fetch_stats', (table) =>
      table
        .select('subreddit,result_count,fetched_at')
        .eq('guild_id', guildId)
        .order('fetched_at', { ascending: false })
        .limit(50)
    );
  }

  async getAutopostStatus(guildId) {
    const config = await this.getGuildConfig(guildId);
    const rows = await this.getStats(guildId);
    return {
      config,
      stats: rows
    };
  }

  async getRedditAccessToken() {
    const hasCredentials = this.env.reddit.clientId && this.env.reddit.clientSecret;
    if (!hasCredentials) {
      throw new Error('Missing Reddit credentials in backend environment.');
    }

    if (this.token && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.token;
    }

    const basicAuth = Buffer.from(
      `${this.env.reddit.clientId}:${this.env.reddit.clientSecret}`
    ).toString('base64');

    let response;
    try {
      response = await fetch(REDDIT_TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.env.reddit.userAgent
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials'
        }),
        signal: AbortSignal.timeout(REDDIT_FETCH_TIMEOUT_MS)
      });
    } catch (error) {
      throw new Error(formatExternalError('Reddit token request failed', error));
    }

    if (!response.ok) {
      throw new Error(`Reddit token request failed: ${response.status}`);
    }

    const payload = await response.json();
    this.token = payload.access_token;
    this.tokenExpiresAt = Date.now() + ((payload.expires_in ?? 3600) * 1000);
    return this.token;
  }

  async fetchRandomMeme(subreddit) {
    const token = await this.getRedditAccessToken();
    const url = `${REDDIT_API_BASE}/r/${subreddit}/hot?limit=25&raw_json=1`;
    let response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': this.env.reddit.userAgent
        },
        signal: AbortSignal.timeout(REDDIT_FETCH_TIMEOUT_MS)
      });
    } catch (error) {
      throw new Error(formatExternalError(`Reddit fetch failed for r/${subreddit}`, error));
    }

    if (!response.ok) {
      throw new Error(`Reddit fetch failed: ${response.status}`);
    }

    const payload = await response.json();
    const posts = payload?.data?.children?.map((item) => item.data).filter(isImagePost) ?? [];
    return pickRandom(posts);
  }

  async postGuildMeme(guildId, overrideConfig = null) {
    const config = normalizeConfig(overrideConfig ?? (await this.getGuildConfig(guildId)));
    if (!config.enabled || !config.channel_id || config.subreddits.length === 0) {
      this.clearGuildTimer(guildId);
      return { posted: false, reason: 'disabled' };
    }

    const guild = this.client.guilds.cache.get(guildId) ?? (await this.client.guilds.fetch(guildId).catch(() => null));
    if (!guild) {
      return { posted: false, reason: 'missing_guild' };
    }

    const channel = guild.channels.cache.get(config.channel_id);
    if (!channel || !channel.isTextBased()) {
      return { posted: false, reason: 'missing_channel' };
    }

    const subreddit = pickRandom(config.subreddits);
    const meme = subreddit ? await this.fetchRandomMeme(subreddit).catch((error) => {
      logger.warn(error?.message || formatExternalError(`Reddit fetch failed for r/${subreddit}`, error));
      return null;
    }) : null;

    if (!meme) {
      if (subreddit) {
        await this.recordFetch(guildId, subreddit, 0).catch(() => null);
      }
      return { posted: false, reason: 'missing_meme' };
    }

    await channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: buildMemeComponents({
        subreddit,
        meme,
        pingRoleId: config.ping_role_id
      }),
      allowedMentions: config.ping_role_id ? { roles: [config.ping_role_id] } : { parse: [] }
    });

    await this.recordFetch(guildId, subreddit, 1).catch(() => null);
    return { posted: true, subreddit, url: meme.url_overridden_by_dest || meme.url };
  }
}
