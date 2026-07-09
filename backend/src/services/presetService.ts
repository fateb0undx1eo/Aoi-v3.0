import { fetchMany, fetchOne, deleteWhere } from '../database/repository.js';
import { supabase } from '../database/supabase.js';
import { logger } from '../utils/logger.js';

export interface AnnouncementPreset {
  id: string;
  guild_id: string;
  name: string;
  kind: 'draft' | 'template';
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export class PresetService {
  async listPresets(guildId: string): Promise<AnnouncementPreset[]> {
    return fetchMany<AnnouncementPreset>('announcement_presets', (table) =>
      table
        .select('id,guild_id,name,kind,data,created_at,updated_at')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
    );
  }

  async getPreset(presetId: string): Promise<AnnouncementPreset | null> {
    return fetchOne<AnnouncementPreset>('announcement_presets', (table) =>
      table
        .select('id,guild_id,name,kind,data,created_at,updated_at')
        .eq('id', presetId)
    );
  }

  async createPreset(guildId: string, payload: { name: string; kind: 'draft' | 'template'; data: Record<string, any> }): Promise<AnnouncementPreset> {
    const { data, error } = await supabase
      .from('announcement_presets')
      .insert({ guild_id: guildId, ...payload })
      .select('id,guild_id,name,kind,data,created_at,updated_at')
      .single();

    if (error) {
      logger.error({ err: error, guildId }, 'Failed to create preset');
      throw new Error('Failed to create preset');
    }

    return data as AnnouncementPreset;
  }

  async updatePreset(presetId: string, payload: { name?: string; kind?: 'draft' | 'template'; data?: Record<string, any> }): Promise<void> {
    const { error } = await supabase
      .from('announcement_presets')
      .update(payload)
      .eq('id', presetId);

    if (error) {
      logger.error({ err: error, presetId }, 'Failed to update preset');
      throw new Error('Failed to update preset');
    }
  }

  async deletePreset(presetId: string): Promise<void> {
    await deleteWhere('announcement_presets', (table) =>
      table.eq('id', presetId)
    );
  }

  async migrateLegacyPresets(guildId: string, presets: { id: string; name: string; kind: string; data: Record<string, any> }[]): Promise<void> {
    if (!presets?.length) return;

    const existing = await this.listPresets(guildId);
    if (existing.length > 0) return;

    const rows = presets.map((p) => ({
      id: p.id,
      guild_id: guildId,
      name: p.name,
      kind: p.kind === 'template' ? 'template' : 'draft',
      data: p.data,
    }));

    const { error } = await supabase.from('announcement_presets').insert(rows);
    if (error) {
      logger.error({ err: error, guildId }, 'Failed to migrate legacy presets');
    }
  }
}
