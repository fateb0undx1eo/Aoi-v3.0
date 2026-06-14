import type { Client, Guild } from 'discord.js';
import type { ModuleConfigRow } from '../types/index.js';
import { redisClient } from '../core/redis.js';

interface MemberCounts {
  humans: number;
  bots: number;
  total: number;
}

interface AnalyticsEntry {
  date: string;
  member_count: number;
  human_count: number;
  bot_count: number;
}

interface OverviewStats {
  roles_count: number;
  channels_count: number;
  emojis_count: number;
  stickers_count: number;
}

interface OverviewGuildInfo {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
  member_count: number;
  premium_subscription_count: number;
  premium_tier: number;
}

interface ModuleInfo {
  name: string;
  configSchema: Record<string, any>;
  enabled: boolean;
  config: Record<string, any>;
}

interface GuildOverview {
  guild: OverviewGuildInfo;
  stats: OverviewStats;
  analytics: AnalyticsEntry[];
  modules: ModuleInfo[];
  refreshed_at: string;
}

interface CacheEntry<T> {
  timestamp: number;
  value: T;
}

interface AnalyticsServiceLike {
  getLast30Days(guildId: string): Promise<any[]>;
}

interface ModuleServiceLike {
  listModules(guildId: string): ModuleInfo[];
}

interface OverviewServiceOptions {
  client?: Client | null;
  moduleService?: ModuleServiceLike;
  analyticsService?: AnalyticsServiceLike;
}

export class DashboardOverviewService {
  private client: Client | null;
  private moduleService: ModuleServiceLike | undefined;
  private analyticsService: AnalyticsServiceLike | undefined;
  private overviewCache: Map<string, CacheEntry<GuildOverview>>;
  private memberCountCache: Map<string, CacheEntry<MemberCounts>>;
  private overviewTtlMs: number;
  private memberCountTtlMs: number;

  constructor({ client, moduleService, analyticsService }: OverviewServiceOptions = {}) {
    this.client = client ?? null;
    this.moduleService = moduleService;
    this.analyticsService = analyticsService;
    this.overviewCache = new Map();
    this.memberCountCache = new Map();
    this.overviewTtlMs = 20 * 1000;
    this.memberCountTtlMs = 5 * 60 * 1000;
  }

  private _isFresh(entry: CacheEntry<any> | undefined, ttlMs: number): boolean {
    return Boolean(entry) && Date.now() - entry!.timestamp < ttlMs;
  }

  private _normalizeAnalytics(rows: any[] = []): AnalyticsEntry[] {
    return rows.map((row: any) => ({
      date: row.date_bucket,
      member_count: row.metrics?.member_count ?? 0,
      human_count: row.metrics?.human_count ?? Math.max((row.metrics?.member_count ?? 0) - (row.metrics?.bot_count ?? 0), 0),
      bot_count: row.metrics?.bot_count ?? 0,
    }));
  }

  private async _resolveGuild(guildId: string): Promise<Guild | null> {
    if (!this.client) {
      return null;
    }

    return this.client.guilds.cache.get(guildId) ?? await this.client.guilds.fetch(guildId).catch(() => null);
  }

  private async _resolveMemberCounts(guild: Guild): Promise<MemberCounts> {
    const cached = this.memberCountCache.get(guild.id);
    if (this._isFresh(cached, this.memberCountTtlMs)) {
      return cached!.value;
    }

    const total = guild.memberCount || guild.members.cache.size || 0;
    let value: MemberCounts;

    if (total > 0 && guild.members.cache.size >= total) {
      const members = guild.members.cache;
      value = {
        humans: members.filter((member) => !member.user.bot).size,
        bots: members.filter((member) => member.user.bot).size,
        total,
      };
    } else if (total > 0 && total <= 1000) {
      try {
        const members = await guild.members.fetch();
        value = {
          humans: members.filter((member) => !member.user.bot).size,
          bots: members.filter((member) => member.user.bot).size,
          total: members.size,
        };
      } catch {
        const knownBots = guild.members.cache.filter((member) => member.user.bot).size;
        value = {
          humans: Math.max(total - knownBots, 0),
          bots: knownBots,
          total,
        };
      }
    } else {
      const knownBots = guild.members.cache.filter((member) => member.user.bot).size;
      value = {
        humans: Math.max(total - knownBots, 0),
        bots: knownBots,
        total,
      };
    }

    this.memberCountCache.set(guild.id, {
      timestamp: Date.now(),
      value,
    });

    return value;
  }

  private async _buildOverview(guildId: string): Promise<GuildOverview | null> {
    const guild = await this._resolveGuild(guildId);
    if (!guild) {
      return null;
    }

    const [memberCounts, analyticsRows] = await Promise.all([
      this._resolveMemberCounts(guild),
      this.analyticsService?.getLast30Days(guildId).catch(() => []) ?? [],
    ]);

    const analytics = this._normalizeAnalytics(analyticsRows);
    const latestAnalytics = analytics[analytics.length - 1];

    if (!latestAnalytics || latestAnalytics.date !== new Date().toISOString().slice(0, 10)) {
      analytics.push({
        date: new Date().toISOString().slice(0, 10),
        member_count: memberCounts.total,
        human_count: memberCounts.humans,
        bot_count: memberCounts.bots,
      });
    }

    return {
      guild: {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        owner_id: guild.ownerId,
        member_count: guild.memberCount || memberCounts.total,
        premium_subscription_count: guild.premiumSubscriptionCount || 0,
        premium_tier: guild.premiumTier || 0,
      },
      stats: {
        roles_count: guild.roles.cache.size,
        channels_count: guild.channels.cache.size,
        emojis_count: guild.emojis.cache.size,
        stickers_count: guild.stickers?.cache?.size || 0,
      },
      analytics,
      modules: this.moduleService ? this.moduleService.listModules(guildId) : [],
      refreshed_at: new Date().toISOString(),
    };
  }

  async getOverview(guildId: string, { force = false }: { force?: boolean } = {}): Promise<GuildOverview | null> {
    const cached = this.overviewCache.get(guildId);
    if (!force && this._isFresh(cached, this.overviewTtlMs)) {
      return cached!.value;
    }

    const redisKey = `cache:dashboard:overview:${guildId}`;
    if (!force && redisClient.isReady() && !cached) {
      try {
        const raw = await redisClient.get(redisKey);
        if (raw) {
          const parsed = JSON.parse(raw) as GuildOverview;
          this.overviewCache.set(guildId, { timestamp: Date.now(), value: parsed });
          return parsed;
        }
      } catch {}
    }

    const value = await this._buildOverview(guildId);
    if (!value) {
      return null;
    }

    this.overviewCache.set(guildId, {
      timestamp: Date.now(),
      value,
    });

    if (redisClient.isReady()) {
      redisClient.setex(redisKey, Math.ceil(this.overviewTtlMs / 1000), JSON.stringify(value)).catch(() => {});
    }

    return value;
  }

  invalidateGuild(guildId: string): void {
    this.overviewCache.delete(guildId);
    if (redisClient.isReady()) {
      redisClient.del(`cache:dashboard:overview:${guildId}`).catch(() => {});
    }
  }
}
