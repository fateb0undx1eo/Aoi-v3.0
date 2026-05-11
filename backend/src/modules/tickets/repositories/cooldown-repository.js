import { supabase } from '../../../database/supabase.js';

/**
 * Repository layer for cooldown database operations
 * Handles all PostgreSQL queries for ticket cooldowns
 */

export class CooldownRepository {
  /**
   * Create or update a cooldown record
   * @param {Object} cooldownData - Cooldown data
   * @returns {Promise<Object>} Created/updated cooldown record
   */
  async upsert(cooldownData) {
    const { data, error } = await supabase
      .from('ticket_cooldowns')
      .upsert({
        guild_id: cooldownData.guildId,
        user_id: cooldownData.userId,
        expires_at: cooldownData.expiresAt,
        reason: cooldownData.reason || 'ticket_creation'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert cooldown: ${error.message}`);
    }

    return data;
  }

  /**
   * Find active cooldown for user in guild
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @param {string} reason - Optional cooldown reason
   * @returns {Promise<Object|null>} Cooldown record or null
   */
  async findActiveCooldown(guildId, userId, reason = 'ticket_creation') {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('ticket_cooldowns')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .eq('reason', reason)
      .gt('expires_at', now)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to find active cooldown: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all active cooldowns for a user
   * @param {string} userId - Discord user ID
   * @returns {Promise<Array>} Array of active cooldown records
   */
  async findByUser(userId) {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('ticket_cooldowns')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', now);

    if (error) {
      throw new Error(`Failed to fetch cooldowns for user: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get all active cooldowns for a guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Array>} Array of active cooldown records
   */
  async findByGuild(guildId) {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('ticket_cooldowns')
      .select('*')
      .eq('guild_id', guildId)
      .gt('expires_at', now);

    if (error) {
      throw new Error(`Failed to fetch cooldowns for guild: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Remove a specific cooldown
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @param {string} reason - Cooldown reason
   * @returns {Promise<boolean>} True if removed successfully
   */
  async removeCooldown(guildId, userId, reason = 'ticket_creation') {
    const { error } = await supabase
      .from('ticket_cooldowns')
      .delete()
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .eq('reason', reason);

    if (error) {
      throw new Error(`Failed to remove cooldown: ${error.message}`);
    }

    return true;
  }

  /**
   * Clear all cooldowns for a user
   * @param {string} userId - Discord user ID
   * @returns {Promise<boolean>} True if cleared successfully
   */
  async clearUserCooldowns(userId) {
    const { error } = await supabase
      .from('ticket_cooldowns')
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to clear user cooldowns: ${error.message}`);
    }

    return true;
  }

  /**
   * Clear all cooldowns for a guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<boolean>} True if cleared successfully
   */
  async clearGuildCooldowns(guildId) {
    const { error } = await supabase
      .from('ticket_cooldowns')
      .delete()
      .eq('guild_id', guildId);

    if (error) {
      throw new Error(`Failed to clear guild cooldowns: ${error.message}`);
    }

    return true;
  }

  /**
   * Cleanup expired cooldowns
   * @param {number} batchSize - Optional batch size for cleanup
   * @returns {Promise<number>} Number of expired cooldowns cleaned up
   */
  async cleanupExpired(batchSize = 1000) {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('ticket_cooldowns')
      .delete()
      .lt('expires_at', now)
      .select('id')
      .limit(batchSize);

    if (error) {
      throw new Error(`Failed to cleanup expired cooldowns: ${error.message}`);
    }

    return (data || []).length;
  }

  /**
   * Get cooldown statistics for a guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} Cooldown statistics
   */
  async getStatistics(guildId) {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('ticket_cooldowns')
      .select('*')
      .eq('guild_id', guildId)
      .gt('expires_at', now);

    if (error) {
      throw new Error(`Failed to fetch cooldown statistics: ${error.message}`);
    }

    const cooldowns = data || [];
    
    return {
      total: cooldowns.length,
      byReason: cooldowns.reduce((acc, cooldown) => {
        acc[cooldown.reason] = (acc[cooldown.reason] || 0) + 1;
        return acc;
      }, {}),
      averageTimeRemaining: cooldowns.length > 0 
        ? cooldowns.reduce((sum, c) => {
            const remaining = new Date(c.expires_at) - new Date();
            return sum + Math.max(0, remaining);
          }, 0) / cooldowns.length
        : 0
    };
  }

  /**
   * Check if user has any active cooldowns
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @returns {Promise<boolean>} True if user has active cooldowns
   */
  async hasActiveCooldowns(guildId, userId) {
    const cooldown = await this.findActiveCooldown(guildId, userId);
    return cooldown !== null;
  }

  /**
   * Get cooldowns expiring soon
   * @param {string} guildId - Discord guild ID
   * @param {number} withinMinutes - Minutes threshold
   * @returns {Promise<Array>} Array of cooldowns expiring soon
   */
  async findExpiringSoon(guildId, withinMinutes = 5) {
    const now = new Date();
    const threshold = new Date(now.getTime() + withinMinutes * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('ticket_cooldowns')
      .select('*')
      .eq('guild_id', guildId)
      .gt('expires_at', now.toISOString())
      .lte('expires_at', threshold);

    if (error) {
      throw new Error(`Failed to find expiring cooldowns: ${error.message}`);
    }

    return data || [];
  }
}

// Export singleton instance
export const cooldownRepository = new CooldownRepository();
