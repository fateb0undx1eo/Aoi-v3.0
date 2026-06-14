import type { Interaction } from 'discord.js';

interface RateLimitRule {
  guild_id: string;
  command_name: string;
  scope: string;
  target_id: string | null;
  max_uses: number;
  window_seconds: number;
}

interface RateLimitService {
  getGuildRules(guildId: string): Promise<RateLimitRule[]>;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

export class DynamicRateLimiter {
  private rateLimitService: RateLimitService;
  private rules: Map<string, RateLimitRule>;
  private hits: Map<string, number[]>;
  private maxHitKeys: number;

  constructor(rateLimitService: RateLimitService) {
    this.rateLimitService = rateLimitService;
    this.rules = new Map();
    this.hits = new Map();
    this.maxHitKeys = 10000;
  }

  private _ruleKey(guildId: string, commandName: string, scope: string, targetId: string | null): string {
    return `${guildId}:${commandName}:${scope}:${targetId ?? '*'}`;
  }

  async warmGuild(guildId: string): Promise<void> {
    const rows = await this.rateLimitService.getGuildRules(guildId);
    for (const row of rows) {
      const key = this._ruleKey(row.guild_id, row.command_name, row.scope, row.target_id);
      this.rules.set(key, row);
    }
  }

  private _hitKey(rule: RateLimitRule, interaction: Interaction): string | null {
    if (rule.scope === 'user') return `${rule.guild_id}:${rule.command_name}:user:${interaction.user.id}`;
    if (rule.scope === 'role') {
      const roleMatch = (interaction.member as any)?.roles?.cache?.find((r: any) => r.id === rule.target_id);
      if (!roleMatch) return null;
      return `${rule.guild_id}:${rule.command_name}:role:${rule.target_id}:${interaction.user.id}`;
    }
    if (rule.scope === 'channel') return `${rule.guild_id}:${rule.command_name}:channel:${(interaction as any).channelId}`;
    return null;
  }

  check(interaction: Interaction, commandName: string): RateLimitResult {
    const guildId = interaction.guildId;
    const matchingRules = [...this.rules.values()].filter(
      (rule) => rule.guild_id === guildId && rule.command_name === commandName
    );
    const now = Date.now();
    for (const rule of matchingRules) {
      const hitKey = this._hitKey(rule, interaction);
      if (!hitKey) continue;

      const windowMs = rule.window_seconds * 1000;
      const history = this.hits.get(hitKey) ?? [];
      const active = history.filter((ts) => now - ts < windowMs);
      if (active.length >= rule.max_uses) {
        return {
          allowed: false,
          retryAfter: Math.ceil((windowMs - (now - active[0]!)) / 1000)
        };
      }

      active.push(now);
      this.hits.set(hitKey, active);
    }

    if (this.hits.size > this.maxHitKeys) {
      this.pruneExpiredHits(now);
    }

    return { allowed: true, retryAfter: 0 };
  }

  pruneExpiredHits(now: number = Date.now()): void {
    const longestWindowMs = Math.max(
      0,
      ...[...this.rules.values()].map((rule) => Number(rule.window_seconds || 0) * 1000)
    );

    for (const [key, history] of this.hits.entries()) {
      const active = history.filter((ts) => now - ts < longestWindowMs);
      if (active.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, active);
      }
    }
  }
}
