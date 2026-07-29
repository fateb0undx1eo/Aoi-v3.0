import { TOOLS_SCHEMA } from './helpers.js';
import channelBroadcastCommand from './commands/channelBroadcast.js';
import userInfoCommand from './commands/userInfo.js';
import roleEditorCommand from './commands/roleEditorCommand.js';
import purgeCommand from './commands/purgeCommand.js';
import autoresponderEvent from './events/autoresponder.js';
import staffListRoleChangeEvent from './events/staffListRoleChange.js';
import userInfoRolesButtonEvent from './events/userInfoRolesButton.js';
import roleEditorInteractionEvent from './events/roleEditorInteraction.js';

export default {
  name: 'tools',
  display_name: 'Tools',
  configSchema: TOOLS_SCHEMA,
  commands: [channelBroadcastCommand, userInfoCommand, roleEditorCommand, purgeCommand],
  events: [autoresponderEvent, staffListRoleChangeEvent, userInfoRolesButtonEvent, roleEditorInteractionEvent]
};
