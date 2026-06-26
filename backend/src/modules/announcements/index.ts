export default {
  name: 'announcements',
  display_name: 'Announcements',
  description: 'Compose and send one-off announcements to your server channels.',
  category: 'community',
  configSchema: {
    type: 'object',
    properties: {
      presets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            kind: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    }
  },
  commands: [],
  events: []
};
