import type { InteractionResult } from '../../types/index.js';

export const TOOLS_SCHEMA = {
  type: 'object',
  properties: {
    autoresponder_enabled: { type: 'boolean' },
    embed_creator_enabled: { type: 'boolean' },
    sticky_enabled: { type: 'boolean' },
    staff_list: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        channel_id: { type: 'string' },
        update_mode: { type: 'string' },
        existing_message_link: { type: 'string' },
        intro_text: { type: 'string' },
        auto_update_on_role_change: { type: 'boolean' },
        show_join_date: { type: 'boolean' },
        interval_value: { type: 'number' },
        interval_unit: { type: 'string' },
        staff_role_ids: { type: 'array', items: { type: 'string' } },
        rank_tier_role_ids: { type: 'array', items: { type: 'string' } }
      }
    },
    channels_activity: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        default_delete_seconds: { type: 'number' }
      }
    }
  }
} as const;

export const R = {
  ignore:      (): InteractionResult                             => ({ type: 'IGNORE' }),
  error:       (message: string): InteractionResult               => ({ type: 'ERROR', message }),
  editReply:   (content: string, opts: any = {})                  => ({ type: 'EDIT_REPLY' as const, content, components: opts.components, files: opts.files }),
  update:      (opts: any = {})                                   => ({ type: 'UPDATE' as const, content: opts.content, components: opts.components, files: opts.files, allowedMentions: opts.allowedMentions }),
  modal:       (builder: any): InteractionResult         => ({ type: 'MODAL', modal: builder }),
};
