import { deleteWhere, fetchMany, fetchOne, updateWhere, upsertRows } from '../database/repository.js';

export class ModerationService {
  constructor(configService) {
    this.configService = configService;
  }

  // AFK System
  async setAfk(guildId, userId, reason) {
    return upsertRows('afk_states', {
      guild_id: guildId,
      user_id: userId,
      reason,
      since_at: new Date().toISOString()
    }, 'guild_id,user_id');
  }

  async clearAfk(guildId, userId) {
    return deleteWhere('afk_states', (table) => table.eq('guild_id', guildId).eq('user_id', userId));
  }

  async getAfk(guildId, userId) {
    const rows = await fetchMany('afk_states', (table) =>
      table.select('*').eq('guild_id', guildId).eq('user_id', userId)
    );
    return rows[0] ?? null;
  }

  // Ghost Ping Detection
  async recordGhostPing(payload) {
    return upsertRows('ghost_ping_events', payload);
  }

  // Mod Config
  async getModConfig(guildId) {
    try {
      const config = await fetchOne('mod_config', (table) =>
        table.select('*').eq('guild_id', guildId)
      );
      return config || this.getDefaultModConfig(guildId);
    } catch (error) {
      // Table is empty or no config for this guild, return defaults
      return this.getDefaultModConfig(guildId);
    }
  }

  async updateModConfig(guildId, updates) {
    return upsertRows('mod_config', {
      guild_id: guildId,
      ...updates,
      updated_at: new Date().toISOString()
    }, 'guild_id');
  }

  getDefaultModConfig(guildId) {
    return {
      guild_id: guildId,
      modlog_channel_id: null,
      mute_role_id: null,
      warn_auto_punish_enabled: false,
      warn_threshold_1: 3,
      warn_action_1: 'MUTE',
      warn_duration_1: 3600,
      warn_threshold_2: 5,
      warn_action_2: 'KICK',
      warn_duration_2: null,
      warn_threshold_3: 7,
      warn_action_3: 'BAN',
      warn_duration_3: null,
      dm_on_punish: true,
      show_mod_in_dm: false
    };
  }

  // Case Management
  async getNextCaseNumber(guildId) {
    try {
      const result = await fetchOne('mod_cases', (table) =>
        table.select('case_number')
          .eq('guild_id', guildId)
          .order('case_number', { ascending: false })
          .limit(1)
      );
      return (result?.case_number || 0) + 1;
    } catch (error) {
      // If table is empty or no cases for this guild, start at 1
      return 1;
    }
  }

  async createCase({ guildId, targetUserId, targetUsername, moderatorUserId, moderatorUsername, type, reason, durationSeconds }) {
    const caseNumber = await this.getNextCaseNumber(guildId);
    
    let expiresAt = null;
    if (durationSeconds && ['TEMPBAN', 'MUTE', 'TIMEOUT'].includes(type)) {
      expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    }

    const caseData = {
      guild_id: guildId,
      case_number: caseNumber,
      target_user_id: targetUserId,
      target_username: targetUsername || 'Unknown',
      moderator_user_id: moderatorUserId,
      moderator_username: moderatorUsername || 'Unknown',
      type,
      reason: reason || 'No reason provided',
      duration_seconds: durationSeconds || null,
      expires_at: expiresAt,
      active: ['TEMPBAN', 'MUTE', 'TIMEOUT', 'BAN'].includes(type),
      created_at: new Date().toISOString()
    };

    await upsertRows('mod_cases', caseData);

    // Check for auto-punish on warnings
    if (type === 'WARN') {
      await this.checkAutoPunish(guildId, targetUserId, moderatorUserId);
    }

    return { ...caseData, id: caseNumber };
  }

  async listCases(guildId, { userId, type, active, limit = 50, offset = 0 }) {
    return fetchMany('mod_cases', (table) => {
      let q = table.select('*').eq('guild_id', guildId);
      if (userId) q = q.eq('target_user_id', userId);
      if (type) q = q.eq('type', type);
      if (active !== undefined) q = q.eq('active', active);
      return q.order('created_at', { ascending: false }).limit(limit).range(offset, offset + limit - 1);
    });
  }

  async updateCase(guildId, caseId, updates) {
    return updateWhere(
      'mod_cases',
      {
        ...updates,
        updated_at: new Date().toISOString()
      },
      (table) => table.eq('guild_id', guildId).eq('id', caseId)
    );
  }

  async deleteCase(guildId, caseId) {
    return deleteWhere('mod_cases', (table) => 
      table.eq('guild_id', guildId).eq('id', caseId)
    );
  }

  async getActivePunishments(guildId) {
    return fetchMany('mod_cases', (table) =>
      table.select('*')
        .eq('guild_id', guildId)
        .eq('active', true)
        .in('type', ['BAN', 'TEMPBAN', 'MUTE', 'TIMEOUT'])
        .order('created_at', { ascending: false })
    );
  }

  async revokePunishment({ guildId, caseId, moderatorUserId, reason }) {
    const existingCase = await fetchOne('mod_cases', (table) =>
      table.select('*').eq('guild_id', guildId).eq('id', caseId)
    );

    if (!existingCase) throw new Error('Case not found');

    const unType = existingCase.type === 'BAN' || existingCase.type === 'TEMPBAN' ? 'UNBAN' : 'UNMUTE';
    await this.createCase({
      guildId,
      targetUserId: existingCase.target_user_id,
      moderatorUserId,
      type: unType,
      reason: reason || `Revoked case #${existingCase.case_number}`
    });

    await this.updateCase(guildId, caseId, { active: false });
    return { ok: true };
  }

  // Warning System
  async getWarnCount(guildId, userId) {
    const rows = await fetchMany('mod_cases', (table) =>
      table.select('id')
        .eq('guild_id', guildId)
        .eq('target_user_id', userId)
        .eq('type', 'WARN')
    );
    return rows.length || 0;
  }

  async clearWarns(guildId, userId, moderatorUserId) {
    const warns = await fetchMany('mod_cases', (table) =>
      table.select('id')
        .eq('guild_id', guildId)
        .eq('target_user_id', userId)
        .eq('type', 'WARN')
    );

    for (const warn of warns) {
      await this.updateCase(guildId, warn.id, { active: false });
    }

    await this.createCase({
      guildId,
      targetUserId: userId,
      moderatorUserId,
      type: 'NOTE',
      reason: `Cleared ${warns.length} warning(s)`
    });

    return { cleared: warns.length };
  }

  // Auto Punish Logic
  async checkAutoPunish(guildId, userId, moderatorUserId) {
    const config = await this.getModConfig(guildId);
    if (!config.warn_auto_punish_enabled) return;

    const warnCount = await this.getWarnCount(guildId, userId);

    const thresholds = [
      { threshold: config.warn_threshold_3, action: config.warn_action_3, duration: config.warn_duration_3 },
      { threshold: config.warn_threshold_2, action: config.warn_action_2, duration: config.warn_duration_2 },
      { threshold: config.warn_threshold_1, action: config.warn_action_1, duration: config.warn_duration_1 }
    ];

    for (const { threshold, action, duration } of thresholds) {
      if (warnCount >= threshold && action) {
        await this.createCase({
          guildId,
          targetUserId: userId,
          moderatorUserId,
          type: action,
          reason: `Auto-punish: Reached ${warnCount} warnings`,
          durationSeconds: duration
        });
        break;
      }
    }
  }

  // Legacy methods for backward compatibility
  async setGhostPingWindow(guildId, seconds) {
    const row = await this.configService.getModuleConfig(guildId, 'moderation').catch(() => null);
    const config = row?.config ?? {};
    config.ghost_ping_window_seconds = seconds;
    await this.configService.upsertModuleConfig({
      guild_id: guildId,
      module_name: 'moderation',
      enabled: row?.enabled ?? true,
      config
    });
  }

  async setPingProtectionRoles(guildId, roleIds) {
    const row = await this.configService.getModuleConfig(guildId, 'moderation').catch(() => null);
    const config = row?.config ?? {};
    config.ping_protection_roles = roleIds;
    await this.configService.upsertModuleConfig({
      guild_id: guildId,
      module_name: 'moderation',
      enabled: row?.enabled ?? true,
      config
    });
  }

  async setLoa(guildId, userId, payload) {
    return upsertRows('loa_states', {
      guild_id: guildId,
      user_id: userId,
      reason: payload.reason,
      role_priority: payload.rolePriority ?? 0,
      last_seen_at: payload.lastSeenAt ?? new Date().toISOString(),
      active: payload.active ?? true
    }, 'guild_id,user_id');
  }

  async listLoa(guildId) {
    return fetchMany('loa_states', (table) =>
      table
        .select('*')
        .eq('guild_id', guildId)
        .eq('active', true)
        .order('role_priority', { ascending: false })
        .order('updated_at', { ascending: false })
    );
  }

  async touchLoaLastSeen(guildId, userId) {
    return updateWhere('loa_states', {
      last_seen_at: new Date().toISOString()
    }, (table) => table.eq('guild_id', guildId).eq('user_id', userId));
  }
}
