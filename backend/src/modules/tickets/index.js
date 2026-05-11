import { routeInteraction, handleThreadUpdate, handleThreadMemberUpdate } from './handlers/interaction-router.js';
import { ticketCommand } from './commands/ticket-command.js';
import { errorHandler } from './utils/error-handler.js';

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
        try {
          await routeInteraction(interaction);

        } catch (error) {
          await errorHandler.handleInteractionError(
            interaction,
            error,
            'interaction_create'
          );
        }
      }
    },

    {
      name: 'threadUpdate',

      async execute(oldThread, newThread) {
        try {
          await handleThreadUpdate(
            oldThread,
            newThread
          );

        } catch (error) {
          await errorHandler.handleServiceError(
            error,
            'thread_update',
            'ticket_module'
          );
        }
      }
    },

    {
      name: 'threadMemberUpdate',

      async execute(oldMember, newMember) {
        try {
          await handleThreadMemberUpdate(
            newMember.thread,
            newMember,
            'update'
          );

        } catch (error) {
          await errorHandler.handleServiceError(
            error,
            'thread_member_update',
            'ticket_module'
          );
        }
      }
    },

    {
      name: 'threadMemberAdd',

      async execute(threadMember) {
        try {
          await handleThreadMemberUpdate(
            threadMember.thread,
            threadMember,
            'add'
          );

        } catch (error) {
          await errorHandler.handleServiceError(
            error,
            'thread_member_add',
            'ticket_module'
          );
        }
      }
    },

    {
      name: 'threadMemberRemove',

      async execute(threadMember) {
        try {
          await handleThreadMemberUpdate(
            threadMember.thread,
            threadMember,
            'remove'
          );

        } catch (error) {
          await errorHandler.handleServiceError(
            error,
            'thread_member_remove',
            'ticket_module'
          );
        }
      }
    }
  ]
};