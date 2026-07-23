import { FUN_SCHEMA } from './helpers.js';
import waifuCommand from './commands/waifu.js';
import husbandoCommand from './commands/husbando.js';
import dropInteractionEvent from './events/dropInteraction.js';
import type { ModuleDefinition } from '../../types/index.js';

export default {
  name: 'fun',
  display_name: 'Fun',
  description: 'Anime waifu and husbando drops with claim and pass interactions.',
  category: 'fun',
  configSchema: FUN_SCHEMA,
  commands: [waifuCommand, husbandoCommand],
  events: [dropInteractionEvent]
} satisfies ModuleDefinition;
