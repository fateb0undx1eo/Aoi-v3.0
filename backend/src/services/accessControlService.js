import { fetchMany } from '../database/repository.js';

export class AccessControlService {
  constructor({ client } = {}) {
    this.client = client ?? null;
  }

  async getMemberRoleIds(guildId, userId, memberRoleIds = []) {
    if (Array.isArray(memberRoleIds) && memberRoleIds.length > 0) {
      return memberRoleIds;
    }

    if (!this.client) {
      return [];
    }

    const guild =
      this.client.guilds.cache.get(guildId) ??
      await this.client.guilds.fetch(guildId).catch(() => null);

    if (!guild) {
      return [];
    }

    const member =
      guild.members.cache.get(userId) ??
      await guild.members.fetch(userId).catch(() => null);

    if (!member) {
      return [];
    }

    return member.roles.cache.map((role) => role.id);
  }

  async canAccessGuild(guildId, userId, memberRoleIds = []) {
    const guildRows = await fetchMany('dashboard_access', (table) =>
      table
        .select('user_id')
        .eq('guild_id', guildId)
    );

    if (guildRows.length === 0) return true;

    const rows = await fetchMany('dashboard_access', (table) =>
      table
        .select('user_id,role,allowed_role_ids')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
    );

    if (rows.length === 0) return false;
    const row = rows[0];
    if (row.role === 'owner' || row.role === 'manager') return true;
    const allowed = Array.isArray(row.allowed_role_ids) ? row.allowed_role_ids : [];
    if (allowed.length === 0) return true;
    const resolvedRoleIds = await this.getMemberRoleIds(guildId, userId, memberRoleIds);
    return resolvedRoleIds.some((roleId) => allowed.includes(roleId));
  }
}
