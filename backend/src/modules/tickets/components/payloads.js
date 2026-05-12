/**
 * Discord interaction payload builders
 * Constructs complete message payloads for Discord interactions
 */

import { MessageFlags } from 'discord.js';
import { COMPONENT_TYPES, POINTER } from '../utils/constants.js';
import { buildTicketTagSelectRow } from './selects.js';
import { buildResolvedButton, buildResolveConfirmationRow, buildUserManagementRow } from './buttons.js';

/**
 * Builds the main ticket panel payload
 * This is the message users interact with to create tickets
 * Requires IS_COMPONENTS_V2 flag (32768)
 */
export function buildTicketPanelPayload() {
  return {
    flags: 32768, // IS_COMPONENTS_V2
    components: [
      {
        type: 17, // CONTAINER
        components: [
          {
            type: 10, // TEXT_DISPLAY
            content:
              '**Need help with something?**\nCreate a support ticket by selecting a category below and our staff team will assist you as soon as possible.'
          },
          buildTicketTagSelectRow()
        ]
      }
    ]
  };
}

/**
 * Builds the welcome message payload sent to the user in their ticket thread
 * Includes the RESOLVED button and guidelines
 * Requires IS_COMPONENTS_V2 flag (32768)
 */
export function buildTicketWelcomePayload(tag, creatorId, { resolvedDisabled = false } = {}) {
  return {
    flags: 32768, // IS_COMPONENTS_V2
    components: [
      {
        type: 17, // CONTAINER
        components: [
          {
            type: 10, // TEXT_DISPLAY
            content: `# ${tag.label}`
          },
          {
            type: 10, // TEXT_DISPLAY
            content:
              `Thank you for opening a support ticket.\n` +
              `${tag.intro}\n` +
              `A staff member will respond as soon as possible.`
          },
          {
            type: 10, // TEXT_DISPLAY
            content:
              `## General Guidelines\n` +
              `${POINTER} Explain your issue clearly and include full details.\n` +
              `${POINTER} Share screenshots, user IDs, message links, and evidence where relevant.\n` +
              `${POINTER} Keep all context in this thread so staff can help quickly.\n` +
              `${POINTER} Avoid pings and wait for a response from staff.`
          },
          {
            type: 1, // ACTION_ROW
            components: [buildResolvedButton(creatorId, resolvedDisabled)]
          }
        ]
      }
    ]
  };
}

/**
 * Builds the confirmation prompt payload for resolving a ticket
 * Shows Yes/No buttons to confirm ticket closure
 */
export function buildResolveConfirmationPayload(creatorId) {
  return {
    content:
      '**Close this ticket?**\nThis will lock the thread and remove the ticket creator. ' +
      'No one will be able to message here again.',
    components: [buildResolveConfirmationRow(creatorId)],
    ephemeral: true
  };
}

/**
 * Builds the user management controls payload
 * Shows Add/Remove user buttons for staff to manage ticket participants
 */
export function buildUserManagementPayload(threadId) {
  return {
    content: 'Ticket user controls:',
    components: [buildUserManagementRow(threadId)],
    ephemeral: false
  };
}

/**
 * Builds a success notification payload
 */
export function buildSuccessPayload(message) {
  return {
    content: `✅ ${message}`,
    ephemeral: true
  };
}

/**
 * Builds an error notification payload
 */
export function buildErrorPayload(message) {
  return {
    content: `❌ ${message}`,
    ephemeral: true
  };
}

/**
 * Builds an info notification payload
 */
export function buildInfoPayload(message) {
  return {
    content: `ℹ️ ${message}`,
    ephemeral: true
  };
}

/**
 * Builds a warning notification payload
 */
export function buildWarningPayload(message) {
  return {
    content: `⚠️ ${message}`,
    ephemeral: true
  };
}

export default {
  buildTicketPanelPayload,
  buildTicketWelcomePayload,
  buildResolveConfirmationPayload,
  buildUserManagementPayload,
  buildSuccessPayload,
  buildErrorPayload,
  buildInfoPayload,
  buildWarningPayload
};
