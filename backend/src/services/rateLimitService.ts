import { fetchMany } from '../database/repository.js';

interface RateLimitRuleRow {
  guild_id: string;
  scope: string;
  target_id: string;
  command_name: string;
  window_seconds: number;
  max_uses: number;
}

export class RateLimitService {
  async getGuildRules(guildId: string): Promise<RateLimitRuleRow[]> {
    return fetchMany<RateLimitRuleRow>('rate_limit_rules', (table: any) =>
      table
        .select('guild_id,scope,target_id,command_name,window_seconds,max_uses')
        .eq('guild_id', guildId)
    );
  }
}
