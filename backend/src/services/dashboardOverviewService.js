export class DashboardOverviewService {
  constructor({ client, moduleService, analyticsService } = {}) {
    this.client = client ?? null;
    this.moduleService = moduleService;
    this.analyticsService = analyticsService;
    this.overviewCache = new Map();
    this.memberCountCache = new Map();
    this.overviewTtlMs = 20 * 1000;
    this.memberCountTtlMs = 5 * 60 * 1000;
  }

  _isFresh(entry, ttlMs) {
    return Boolean(entry) && Date.now() - entry.timestamp < ttlMs;
  }

  _normalizeAnalytics(rows = []) {
    return rows.map((row) => ({
      date: row.date_bucket,
      member_count: row.metrics?.member_count ?? 0,
      human_count: row.metrics?.human_count ?? Math.max((row.metrics?.member_count ?? 0) - (row.metrics?.bot_count ?? 0), 0),
      bot_count: row.metrics?.bot_count ?? 0,
    }));
  }

  async _resolveGuild(guildId) {
    if (!this.client) {
      return null;
    }

    return this.client.guilds.cache.get(guildId) ?? await this.client.guilds.fetch(guildId).catch(() => null);
  }

  async _resolveMemberCounts(guild) {
    const cached = this.memberCountCache.get(guild.id);
    if (this._isFresh(cached, this.memberCountTtlMs)) {
      return cached.value;
    }

    const total = guild.memberCount || guild.members.cache.size || 0;
    let value;

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

  async _buildOverview(guildId) {
    const guild = await this._resolveGuild(guildId);
    if (!guild) {
      return null;
    }

    const [memberCounts, analyticsRows] = await Promise.all([
      this._resolveMemberCounts(guild),
      this.analyticsService.getLast30Days(guildId).catch(() => []),
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
      modules: this.moduleService.listModules(guildId),
      refreshed_at: new Date().toISOString(),
    };
  }

  async getOverview(guildId, { force = false } = {}) {
    const cached = this.overviewCache.get(guildId);
    if (!force && this._isFresh(cached, this.overviewTtlMs)) {
      return cached.value;
    }

    const value = await this._buildOverview(guildId);
    if (!value) {
      return null;
    }

    this.overviewCache.set(guildId, {
      timestamp: Date.now(),
      value,
    });

    return value;
  }
}
