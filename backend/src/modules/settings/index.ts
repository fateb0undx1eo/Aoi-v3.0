import type { ModuleDefinition } from '../../types/index.js';

const SETTINGS_SCHEMA = {
  type: 'object',
  properties: {
    dashboard_roles: { type: 'array', items: { type: 'string' } },
    branding: { type: 'object' },
    command_manager: { type: 'object' },
    error_logs: { type: 'object' }
  }
} as const;

export default {
  name: 'settings',
  configSchema: SETTINGS_SCHEMA,
  commands: [],
  events: []
} satisfies ModuleDefinition;
