import { MODERATION_SCHEMA } from './helpers.js';
import caseCommand from './commands/caseCommand.js';
import jailCommand from './commands/jail.js';
import jailedListCommand from './commands/jailedList.js';
import caseInteractionEvent from './events/caseInteraction.js';
import ghostPingDetectionEvent from './events/ghostPingDetection.js';
import afkAndLoaTrackingEvent from './events/afkAndLoaTracking.js';

export default {
  name: 'moderation',
  configSchema: MODERATION_SCHEMA,
  commands: [caseCommand, jailCommand, jailedListCommand],
  events: [caseInteractionEvent, ghostPingDetectionEvent, afkAndLoaTrackingEvent]
};
