import { fetchMany } from '../database/repository.js';

export class RateLimitService {
  async getGuildRules(guildId) {
    return fetchMany('rate_limit_rules', (table) =>
      table
        .select('guild_id,scope,target_id,command_name,window_seconds,max_uses')
        .eq('guild_id', guildId)
    );
  }
}
