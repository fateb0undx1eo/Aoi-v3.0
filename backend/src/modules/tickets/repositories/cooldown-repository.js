import { supabase } from '../../../database/supabase.js';

export class CooldownRepository {
  async upsert(cooldownData) {
    const { data, error } = await supabase.from('ticket_cooldowns').upsert({
      guild_id: cooldownData.guildId,
      user_id: cooldownData.userId,
      expires_at: cooldownData.expiresAt,
      reason: cooldownData.reason || 'ticket_creation'
    }).select().single();
    if (error) throw new Error(`Failed to upsert cooldown: ${error.message}`);
    return data;
  }

  async findActiveCooldown(guildId, userId, reason = 'ticket_creation') {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('ticket_cooldowns').select('*').eq('guild_id', guildId).eq('user_id', userId).eq('reason', reason).gt('expires_at', now).single();
    if (error && error.code !== 'PGRST116') throw new Error(`Failed to find active cooldown: ${error.message}`);
    return data;
  }

  async findByUser(userId) {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('ticket_cooldowns').select('*').eq('user_id', userId).gt('expires_at', now);
    if (error) throw new Error(`Failed to fetch cooldowns for user: ${error.message}`);
    return data ||[];
  }

  async findByGuild(guildId) {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('ticket_cooldowns').select('*').eq('guild_id', guildId).gt('expires_at', now);
    if (error) throw new Error(`Failed to fetch cooldowns for guild: ${error.message}`);
    return data ||[];
  }

  async removeCooldown(guildId, userId, reason = 'ticket_creation') {
    const { error } = await supabase.from('ticket_cooldowns').delete().eq('guild_id', guildId).eq('user_id', userId).eq('reason', reason);
    if (error) throw new Error(`Failed to remove cooldown: ${error.message}`);
    return true;
  }

  async clearUserCooldowns(userId) {
    const { error } = await supabase.from('ticket_cooldowns').delete().eq('user_id', userId);
    if (error) throw new Error(`Failed to clear user cooldowns: ${error.message}`);
    return true;
  }

  async clearGuildCooldowns(guildId) {
    const { error } = await supabase.from('ticket_cooldowns').delete().eq('guild_id', guildId);
    if (error) throw new Error(`Failed to clear guild cooldowns: ${error.message}`);
    return true;
  }

  async cleanupExpired(batchSize = 1000) {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('ticket_cooldowns').delete().lt('expires_at', now).select('id').limit(batchSize);
    if (error) throw new Error(`Failed to cleanup expired cooldowns: ${error.message}`);
    return (data ||[]).length;
  }

  async getStatistics(guildId) {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('ticket_cooldowns').select('*').eq('guild_id', guildId).gt('expires_at', now);
    if (error) throw new Error(`Failed to fetch cooldown statistics: ${error.message}`);
    const cooldowns = data ||[];
    return {
      total: cooldowns.length,
      byReason: cooldowns.reduce((acc, cooldown) => { acc[cooldown.reason] = (acc[cooldown.reason] || 0) + 1; return acc; }, {}),
      averageTimeRemaining: cooldowns.length > 0 ? cooldowns.reduce((sum, c) => sum + Math.max(0, new Date(c.expires_at) - new Date()), 0) / cooldowns.length : 0
    };
  }

  async hasActiveCooldowns(guildId, userId) {
    const cooldown = await this.findActiveCooldown(guildId, userId);
    return cooldown !== null;
  }

  async findExpiringSoon(guildId, withinMinutes = 5) {
    const now = new Date();
    const threshold = new Date(now.getTime() + withinMinutes * 60 * 1000).toISOString();
    const { data, error } = await supabase.from('ticket_cooldowns').select('*').eq('guild_id', guildId).gt('expires_at', now.toISOString()).lte('expires_at', threshold);
    if (error) throw new Error(`Failed to find expiring cooldowns: ${error.message}`);
    return data ||[];
  }

  async findExpiredCooldowns() {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('ticket_cooldowns').select('*').lt('expires_at', now);
    if (error) throw new Error(error.message);
    return data ||[];
  }

  async findActiveCooldowns() {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('ticket_cooldowns').select('*').gt('expires_at', now);
    if (error) throw new Error(error.message);
    return data ||[];
  }

  async findOrphanedCooldowns() { 
    // Usually mapped against a members table, but for isolated background jobs returning empty prevents crashes.
    return[]; 
  }
}

export const cooldownRepository = new CooldownRepository();