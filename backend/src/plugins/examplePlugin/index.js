export default {
  name: 'example-plugin',
  configSchema: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean' }
    }
  },
  commands: [],
  events: []
};
