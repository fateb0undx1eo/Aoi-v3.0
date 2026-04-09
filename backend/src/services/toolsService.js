import { fetchMany, upsertRows } from '../database/repository.js';

export class ToolsService {
  async upsertAutoresponder(payload) {
    return upsertRows('autoresponders', payload, 'guild_id,trigger_pattern');
  }

  async listAutoresponders(guildId) {
    return fetchMany('autoresponders', (table) =>
      table.select('*').eq('guild_id', guildId).order('created_at', { ascending: false })
    );
  }

  async upsertSticky(payload) {
    return upsertRows('sticky_messages', payload, 'guild_id,channel_id');
  }

  async listStickies(guildId) {
    return fetchMany('sticky_messages', (table) =>
      table.select('*').eq('guild_id', guildId).order('id', { ascending: false })
    );
  }

  async upsertEmbedTemplate(payload) {
    return upsertRows('embed_templates', payload, 'guild_id,name');
  }

  async listEmbedTemplates(guildId) {
    return fetchMany('embed_templates', (table) =>
      table.select('*').eq('guild_id', guildId).order('id', { ascending: false })
    );
  }
}
