export class DynamicRateLimiter {
  constructor(rateLimitService) {
    this.rateLimitService = rateLimitService;
    this.rules = new Map();
    this.hits = new Map();
  }

  _ruleKey(guildId, commandName, scope, targetId) {
    return `${guildId}:${commandName}:${scope}:${targetId ?? '*'}`;
  }

  async warmGuild(guildId) {
    const rows = await this.rateLimitService.getGuildRules(guildId);
    for (const row of rows) {
      const key = this._ruleKey(row.guild_id, row.command_name, row.scope, row.target_id);
      this.rules.set(key, row);
    }
  }

  _hitKey(rule, interaction) {
    if (rule.scope === 'user') return `${rule.guild_id}:${rule.command_name}:user:${interaction.user.id}`;
    if (rule.scope === 'role') {
      const roleMatch = interaction.member?.roles?.cache?.find((r) => r.id === rule.target_id);
      if (!roleMatch) return null;
      return `${rule.guild_id}:${rule.command_name}:role:${rule.target_id}:${interaction.user.id}`;
    }
    if (rule.scope === 'channel') return `${rule.guild_id}:${rule.command_name}:channel:${interaction.channelId}`;
    return null;
  }

  check(interaction, commandName) {
    const guildId = interaction.guildId;
    const matchingRules = [...this.rules.values()].filter((rule) => rule.guild_id === guildId && rule.command_name === commandName);
    for (const rule of matchingRules) {
      const hitKey = this._hitKey(rule, interaction);
      if (!hitKey) continue;

      const now = Date.now();
      const windowMs = rule.window_seconds * 1000;
      const history = this.hits.get(hitKey) ?? [];
      const active = history.filter((ts) => now - ts < windowMs);
      if (active.length >= rule.max_uses) {
        return {
          allowed: false,
          retryAfter: Math.ceil((windowMs - (now - active[0])) / 1000)
        };
      }

      active.push(now);
      this.hits.set(hitKey, active);
    }

    return { allowed: true, retryAfter: 0 };
  }
}
