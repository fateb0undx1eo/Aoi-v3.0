/**
 * Button component builders for Discord interactions
 */

import { ButtonStyle } from 'discord.js';
import { COMPONENT_TYPES } from '../utils/constants.js';
import {
  buildResolvedCustomId,
  buildResolveConfirmCustomId,
  buildResolveCancelCustomId,
  buildAddUsersCustomId,
  buildRemoveUsersCustomId
} from '../utils/custom-id-utils.js';

/**
 * Builds the RESOLVED button for ticket welcome message
 */
export function buildResolvedButton(creatorId, disabled = false) {
  return {
    type: COMPONENT_TYPES.Button,
    style: ButtonStyle.Secondary,
    custom_id: buildResolvedCustomId(creatorId),
    label: 'RESOLVED',
    emoji: { name: 'Resolved', id: '1503284846980632647' },
    disabled
  };
}

/**
 * Builds the Yes button for resolve confirmation
 */
export function buildResolveConfirmButton(creatorId) {
  return {
    type: COMPONENT_TYPES.Button,
    style: ButtonStyle.Danger,
    custom_id: buildResolveConfirmCustomId(creatorId),
    label: 'Yes, close it'
  };
}

/**
 * Builds the No button for resolve confirmation
 */
export function buildResolveCancelButton(creatorId) {
  return {
    type: COMPONENT_TYPES.Button,
    style: ButtonStyle.Secondary,
    custom_id: buildResolveCancelCustomId(creatorId),
    label: 'No, keep open'
  };
}

/**
 * Builds the Add User button for ticket management
 */
export function buildAddUserButton(threadId) {
  return {
    type: COMPONENT_TYPES.Button,
    style: ButtonStyle.Secondary,
    custom_id: buildAddUsersCustomId(threadId),
    label: 'ADD USER',
    emoji: { name: 'Add', id: '1503290197079752745' }
  };
}

/**
 * Builds the Remove User button for ticket management
 */
export function buildRemoveUserButton(threadId) {
  return {
    type: COMPONENT_TYPES.Button,
    style: ButtonStyle.Secondary,
    custom_id: buildRemoveUsersCustomId(threadId),
    label: 'REMOVE USER',
    emoji: { name: 'Remove', id: '1503290199281635391' }
  };
}

/**
 * Builds an action row with resolve confirmation buttons
 */
export function buildResolveConfirmationRow(creatorId) {
  return {
    type: COMPONENT_TYPES.ActionRow,
    components: [
      buildResolveConfirmButton(creatorId),
      buildResolveCancelButton(creatorId)
    ]
  };
}

/**
 * Builds an action row with user management buttons
 */
export function buildUserManagementRow(threadId) {
  return {
    type: COMPONENT_TYPES.ActionRow,
    components: [
      buildAddUserButton(threadId),
      buildRemoveUserButton(threadId)
    ]
  };
}

export default {
  buildResolvedButton,
  buildResolveConfirmButton,
  buildResolveCancelButton,
  buildAddUserButton,
  buildRemoveUserButton,
  buildResolveConfirmationRow,
  buildUserManagementRow
};
