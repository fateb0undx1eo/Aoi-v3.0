import { COMMUNITY_SCHEMA } from './helpers.js';
import randomizedRoleColorCommand from './commands/randomizedRoleColor.js';
import profileCommand from './commands/profile.js';
import memesAutopostCommand from './commands/memesAutopost.js';
import guildMemberAddEvent from './events/guildMemberAdd.js';
import guildMemberRemoveEvent from './events/guildMemberRemove.js';
import guildMemberBoostEvent from './events/guildMemberBoost.js';
import messageCreateEvent from './events/messageCreate.js';
import memeAutopostButtonsEvent from './events/memeAutopostButtons.js';
import profileModalEvent from './events/profileModal.js';

export default {
  name: 'community',
  configSchema: COMMUNITY_SCHEMA,
  commands: [randomizedRoleColorCommand, profileCommand, memesAutopostCommand],
  events: [guildMemberAddEvent, guildMemberRemoveEvent, guildMemberBoostEvent, messageCreateEvent, memeAutopostButtonsEvent, profileModalEvent]
};
