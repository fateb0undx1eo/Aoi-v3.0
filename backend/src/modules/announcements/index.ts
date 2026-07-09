import type { ApplicationCommandData } from 'discord.js';

const configSchema = {
  type: 'object',
  properties: {
    presets: {
      type: 'array',
      description: 'Saved announcement templates',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique preset identifier' },
          name: { type: 'string', description: 'Display name for the preset' },
          kind: { type: 'string', enum: ['draft', 'template'], description: 'Preset type' },
          data: {
            type: 'object',
            description: 'Full QueryData payload (version, messages[], targets[])',
            properties: {
              version: { type: 'string', description: 'Query data format version' },
              messages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    _id: { type: 'string' },
                    name: { type: 'string', maxLength: 100 },
                    data: {
                      type: 'object',
                      properties: {
                        content: { type: 'string', maxLength: 2000 },
                        embeds: { type: 'array', items: { type: 'object' } },
                        components: { type: 'array', items: { type: 'object' } },
                        flags: { type: 'integer' },
                        thread_name: { type: 'string', maxLength: 100 },
                        allowed_mentions: { type: 'object' }
                      }
                    }
                  }
                }
              },
              targets: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'integer' },
                    url: { type: 'string' },
                    application_id: { type: 'string' },
                    bot_id: { type: 'string' },
                    channel_id: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        required: ['id', 'name', 'data']
      }
    },
    default_channel_ids: {
      type: 'array',
      description: 'Default target channel IDs for the send flow',
      items: { type: 'string', pattern: '^\\d{17,20}$' }
    },
    suppress_mentions: {
      type: 'boolean',
      description: 'Strip @everyone/@here/@role by default',
      default: false
    },
    send_method: {
      type: 'string',
      enum: ['bot', 'webhook'],
      default: 'bot',
      description: 'Preferred sending method'
    },
    flow_actions_enabled: {
      type: 'boolean',
      default: true,
      description: 'Allow button/select flow actions (role grant, message reply, modal)'
    }
  }
};

export default {
  name: 'announcements',
  display_name: 'Announcements',
  description: 'Compose and send one-off announcements to your server channels.',
  category: 'community',
  configSchema,
  commands: [
    {
      name: 'announcement',
      description: 'Manage announcements',
      options: [
        {
          type: 1,
          name: 'send',
          description: 'Send an announcement to one or more channels',
          options: [
            {
              type: 3,
              name: 'channel',
              description: 'Target channel(s) — comma-separated IDs',
              required: true
            },
            {
              type: 3,
              name: 'message',
              description: 'Message content or JSON payload',
              required: true
            }
          ]
        },
        {
          type: 1,
          name: 'preview',
          description: 'Preview an announcement without sending',
          options: [
            {
              type: 3,
              name: 'message',
              description: 'Message content or JSON payload',
              required: true
            }
          ]
        }
      ]
    }
  ] satisfies ApplicationCommandData[],
  events: []
};
