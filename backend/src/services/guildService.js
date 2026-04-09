import { fetchMany, fetchOne, upsertRows } from '../database/repository.js';

export class GuildService {
  async upsertGuildSnapshot(guild) {
    return upsertRows(
      'guilds',
      {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL(),
        owner_id: guild.ownerId,
        stats: {
          member_count: guild.memberCount,
          boost_level: guild.premiumTier,
          roles_count: guild.roles.cache.size,
          emojis_count: guild.emojis.cache.size,
          channels_count: guild.channels.cache.size
        }
      },
      'id'
    );
  }

  async getOverview(guildId) {
    return fetchOne('guilds', (table) =>
      table
        .select('id,name,icon,owner_id,stats,updated_at')
        .eq('id', guildId)
    );
  }

  async listGuilds() {
    return fetchMany('guilds', (table) => table.select('id,name,icon,stats,updated_at').order('updated_at', { ascending: false }));
  }

  async getGuildSnapshots(guildIds = []) {
    if (!Array.isArray(guildIds) || guildIds.length === 0) return [];

    return fetchMany('guilds', (table) =>
      table
        .select('id,name,icon,stats,updated_at')
        .in('id', guildIds)
    );
  }
}
