import type { Client, Guild } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { fetchMany, upsertRows } from '../database/repository.js';
import { logger } from '../utils/logger.js';

const FEATURE_KEY = 'meme_autopost';

interface MemeAutopostConfig {
  enabled: boolean;
  interval_value: number;
  interval_unit: string;
  channel_id: string;
  ping_role_id: string;
  subreddits: string[];
}

const DEFAULT_CONFIG: MemeAutopostConfig = {
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

interface RedditMeme {
  url_overridden_by_dest?: string;
  url?: string;
  title?: string;
  over_18?: boolean;
  is_video?: boolean;
}

interface RedditChild {
  data: RedditMeme;
}

interface RedditListingData {
  data?: {
    children?: RedditChild[];
  };
}

interface PostMemeResult {
  posted: boolean;
  reason?: string;
  subreddit?: string;
  url?: string;
}

interface MemeFetchStatsRow {
  subreddit: string;
  result_count: number;
  fetched_at: string;
}

interface AutopostStatus {
  config: MemeAutopostConfig;
  stats: MemeFetchStatsRow[];
}

interface MemeComponentsOptions {
  subreddit: string;
  meme: RedditMeme;
  pingRoleId: string;
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
  refreshGuild(guildId: string): Promise<void>;
}

interface RedditEnv {
  clientId: string;
  clientSecret: string;
  userAgent: string;
}

interface MemeServiceEnv {
  reddit: RedditEnv;
}

interface MemeServiceOptions {
  configService: ConfigServiceLike;
  configCache: ConfigCacheLike;
  client: Client;
  env: MemeServiceEnv;
}

function toPositiveInteger(value: unknown, fallback: number = 1): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeUnit(unit: string): string {
  if (unit === 'seconds' || unit === 'hours') return unit;
  return 'minutes';
}

function normalizeIntervalValue(value: unknown, unit: string): number {
  const parsed = toPositiveInteger(value, DEFAULT_CONFIG.interval_value);
  if (unit === 'seconds') {
    return Math.max(MIN_SECONDS_INTERVAL, parsed);
  }
  return parsed;
}

function intervalToMs(config: MemeAutopostConfig): number {
  const unit = normalizeUnit(config.interval_unit);
  const value = normalizeIntervalValue(config.interval_value, unit);

  if (unit === 'seconds') return value * 1000;
  if (unit === 'hours') return value * 60 * 60 * 1000;
  return value * 60 * 1000;
}

function sanitizeSubreddits(subreddits: unknown): string[] {
  if (!Array.isArray(subreddits)) return [];
  return [...new Set(
    (subreddits as string[])
      .map((value: string) => String(value ?? '').trim().replace(/^r\//i, ''))
      .map((value: string) => value.replace(/[^a-zA-Z0-9_]/g, ''))
      .filter(Boolean)
  )];
}

function normalizeConfig(config: Record<string, any> = {}): MemeAutopostConfig {
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

function pickRandom<T>(items: T[]): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function isImagePost(post: RedditMeme | null | undefined): boolean {
  if (!post || post.over_18 || post.is_video) return false;
  const url = String(post.url_overridden_by_dest || post.url || '');
  if (!url) return false;
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
}

function buildMemeComponents({ subreddit, meme, pingRoleId }: MemeComponentsOptions): Record<string, any>[] {
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
              media: { url: imageUrl }
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

function isNetworkTimeoutError(error: any): boolean {
  return (
    error?.name === 'AbortError' ||
    error?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    String(error?.message || '').includes('Connect Timeout Error')
  );
}

function formatExternalError(prefix: string, error: any): string {
  if (isNetworkTimeoutError(error)) {
    return `${prefix}: connection timed out`;
  }

  const causeMessage = error?.cause?.message || error?.message || 'unknown error';
  return `${prefix}: ${causeMessage}`;
}

export class MemeService {
  private configService: ConfigServiceLike;
  private configCache: ConfigCacheLike;
  private client: Client;
  private env: MemeServiceEnv;
  private timers: Map<string, ReturnType<typeof setTimeout>>;
  private token: string | null;
  private tokenExpiresAt: number;

  constructor({ configService, configCache, client, env }: MemeServiceOptions) {
    this.configService = configService;
    this.configCache = configCache;
    this.client = client;
    this.env = env;
    this.timers = new Map();
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  async getModuleRow(guildId: string): Promise<ModuleConfigRow | null> {
    return this.configService.getModuleConfig(guildId, 'community').catch(() => null);
  }

  getConfigFromModuleRow(row: ModuleConfigRow | null): MemeAutopostConfig {
    return normalizeConfig(row?.config?.[FEATURE_KEY] ?? DEFAULT_CONFIG);
  }

  async getGuildConfig(guildId: string): Promise<MemeAutopostConfig> {
    const row = await this.getModuleRow(guildId);
    return this.getConfigFromModuleRow(row);
  }

  async updateGuildConfig(guildId: string, updates: Record<string, any> = {}): Promise<MemeAutopostConfig> {
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

  clearGuildTimer(guildId: string): void {
    const existing = this.timers.get(guildId);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(guildId);
    }
  }

  scheduleGuild(guildId: string, config: MemeAutopostConfig): void {
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

  async syncGuild(guildId: string): Promise<MemeAutopostConfig> {
    const config = await this.getGuildConfig(guildId);
    this.scheduleGuild(guildId, config);
    return config;
  }

  async restoreAll(guildIds: string[] = []): Promise<void> {
    await Promise.all(guildIds.map((guildId) => this.syncGuild(guildId)));
  }

  async recordFetch(guildId: string, subreddit: string, resultCount: number): Promise<void> {
    return upsertRows('meme_fetch_stats', {
      guild_id: guildId,
      subreddit,
      result_count: resultCount,
      fetched_at: new Date().toISOString()
    });
  }

  async getStats(guildId: string): Promise<MemeFetchStatsRow[]> {
    return fetchMany('meme_fetch_stats', (table: any) =>
      table
        .select('subreddit,result_count,fetched_at')
        .eq('guild_id', guildId)
        .order('fetched_at', { ascending: false })
        .limit(50)
    );
  }

  async getAutopostStatus(guildId: string): Promise<AutopostStatus> {
    const config = await this.getGuildConfig(guildId);
    const rows = await this.getStats(guildId);
    return {
      config,
      stats: rows
    };
  }

  async getRedditAccessToken(): Promise<string> {
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

    let response: Response;
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

    const payload: any = await response.json();
    this.token = payload.access_token ?? null;
    this.tokenExpiresAt = Date.now() + ((payload.expires_in ?? 3600) * 1000);
    return this.token!;
  }

  async fetchRandomMeme(subreddit: string): Promise<RedditMeme | undefined> {
    const token = await this.getRedditAccessToken();
    const url = `${REDDIT_API_BASE}/r/${subreddit}/hot?limit=25&raw_json=1`;
    let response: Response;
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

    const payload: RedditListingData = await response.json();
    const posts = payload?.data?.children?.map((item) => item.data).filter(isImagePost) ?? [];
    return pickRandom(posts);
  }

  async postGuildMeme(guildId: string, overrideConfig: Record<string, any> | null = null): Promise<PostMemeResult> {
    const config = normalizeConfig(overrideConfig ?? (await this.getGuildConfig(guildId)));
    if (!config.enabled || !config.channel_id || config.subreddits.length === 0) {
      this.clearGuildTimer(guildId);
      return { posted: false, reason: 'disabled' };
    }

    const guild: Guild | null = this.client.guilds.cache.get(guildId) ?? (await this.client.guilds.fetch(guildId).catch(() => null));
    if (!guild) {
      return { posted: false, reason: 'missing_guild' };
    }

    const channel = guild.channels.cache.get(config.channel_id);
    if (!channel || !channel.isTextBased()) {
      return { posted: false, reason: 'missing_channel' };
    }

    const subreddit = pickRandom(config.subreddits);
    const meme: RedditMeme | undefined = subreddit ? await this.fetchRandomMeme(subreddit).catch((error) => {
      logger.warn(error?.message || formatExternalError(`Reddit fetch failed for r/${subreddit}`, error));
      return undefined;
    }) : undefined;

    if (!meme) {
      if (subreddit) {
        await this.recordFetch(guildId, subreddit, 0).catch(() => null);
      }
      return { posted: false, reason: 'missing_meme' };
    }

    await (channel as any).send({
      flags: MessageFlags.IsComponentsV2,
      components: buildMemeComponents({
        subreddit: subreddit!,
        meme,
        pingRoleId: config.ping_role_id
      }),
      allowedMentions: config.ping_role_id ? { roles: [config.ping_role_id] } : { parse: [] }
    });

    await this.recordFetch(guildId, subreddit!, 1).catch(() => null);
    return { posted: true, subreddit: subreddit!, url: meme.url_overridden_by_dest || meme.url };
  }
}
