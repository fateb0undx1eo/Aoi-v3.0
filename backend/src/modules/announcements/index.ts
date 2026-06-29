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
          kind: { type: 'string', enum: ['message', 'embed', 'flow'], description: 'Preset type' },
          data: {
            type: 'object',
            properties: {
              content: { type: 'string', maxLength: 2000 },
              embeds: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', maxLength: 256 },
                    description: { type: 'string', maxLength: 4096 },
                    url: { type: 'string', format: 'uri' },
                    color: { type: 'number' },
                    fields: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string', maxLength: 256 },
                          value: { type: 'string', maxLength: 1024 },
                          inline: { type: 'boolean' }
                        },
                        required: ['name', 'value']
                      }
                    },
                    footer: {
                      type: 'object',
                      properties: {
                        text: { type: 'string', maxLength: 2048 },
                        icon_url: { type: 'string', format: 'uri' }
                      }
                    },
                    image: { type: 'object', properties: { url: { type: 'string', format: 'uri' } } },
                    thumbnail: { type: 'object', properties: { url: { type: 'string', format: 'uri' } } },
                    author: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', maxLength: 256 },
                        url: { type: 'string', format: 'uri' },
                        icon_url: { type: 'string', format: 'uri' }
                      }
                    },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              },
              components: {
                type: 'array',
                description: 'Action rows or V2 layout containers'
              },
              flags: { type: 'integer', description: 'Message flags bitfield' },
              thread_name: { type: 'string', description: 'Forum thread name if applicable' }
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
