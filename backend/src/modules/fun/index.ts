import { FUN_SCHEMA } from './helpers.js';
import dropInteractionEvent from './events/dropInteraction.js';
import type { ModuleDefinition } from '../../types/index.js';

export default {
  name: 'fun',
  display_name: 'Fun',
  description: 'Anime character drops with claim and pass interactions.',
  category: 'fun',
  configSchema: FUN_SCHEMA,
  commands: [],
  events: [dropInteractionEvent]
} satisfies ModuleDefinition;
