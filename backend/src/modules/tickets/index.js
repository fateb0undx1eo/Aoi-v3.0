import { ticketCommand } from './commands/ticket-command.js';
import { handleInteraction } from './router/interaction-router.js';

/**
 * Refactored Ticket System Module
 * 
 * This module replaces the message-scanning architecture with:
 * - Database-backed ticket metadata persistence
 * - Distributed Redis locking and caching
 * - Efficient lookups instead of Discord API scans
 * - Per-guild webhook caching
 * - Collision-safe thread naming
 * - Proper error handling and logging
 * 
 * The external behavior remains identical to users and staff.
 */

export default {
  name: 'tickets',

  configSchema: {
    type: 'object',
    properties: {}
  },

  commands: [ticketCommand],

  events: [
    {
      name: 'interactionCreate',
      async execute(interaction) {
        await handleInteraction(interaction);
      }
    }
  ]
};
