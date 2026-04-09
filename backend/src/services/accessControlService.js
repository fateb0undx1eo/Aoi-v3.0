import { fetchMany } from '../database/repository.js';

export class AccessControlService {
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
    return memberRoleIds.some((roleId) => allowed.includes(roleId));
  }
}
