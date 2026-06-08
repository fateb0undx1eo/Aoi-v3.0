/**
 * Modal component builders for Discord interactions
 */

import { CUSTOM_IDS } from '../utils/constants.js';
import { buildUserSelect } from './selects.js';

/**
 * Builds the add user modal
 */
export function buildAddUserModal(threadId) {
  return {
    custom_id: `${CUSTOM_IDS.addUsersModal}:${threadId}`,
    title: 'Add User',
    components: [
      {
        type: 1, // Action Row
        components: [
          {
            type: 4, // Text Input
            label: 'Add User',
            description: 'Pick a user to add to this ticket',
            custom_id: CUSTOM_IDS.addUserSelect,
            required: true
          }
        ]
      }
    ]
  };
}

/**
 * Builds the remove user modal
 */
export function buildRemoveUserModal(threadId) {
  return {
    custom_id: `${CUSTOM_IDS.removeUsersModal}:${threadId}`,
    title: 'Remove User',
    components: [
      {
        type: 1, // Action Row
        components: [
          {
            type: 4, // Text Input
            label: 'Remove User',
            description: 'Pick a user to remove from this ticket',
            custom_id: CUSTOM_IDS.removeUserSelect,
            required: true
          }
        ]
      }
    ]
  };
}

/**
 * Alternative: Builds add user modal using user select (more user-friendly)
 */
export function buildAddUserModalWithSelect(threadId) {
  return {
    custom_id: `${CUSTOM_IDS.addUsersModal}:${threadId}`,
    title: 'Add User',
    components: [
      {
        type: 1, // Action Row
        components: [
          buildUserSelect(CUSTOM_IDS.addUserSelect, 'Select user to add')
        ]
      }
    ]
  };
}

/**
 * Alternative: Builds remove user modal using user select
 */
export function buildRemoveUserModalWithSelect(threadId) {
  return {
    custom_id: `${CUSTOM_IDS.removeUsersModal}:${threadId}`,
    title: 'Remove User',
    components: [
      {
        type: 1, // Action Row
        components: [
          buildUserSelect(CUSTOM_IDS.removeUserSelect, 'Select user to remove')
        ]
      }
    ]
  };
}

export default {
  buildAddUserModal,
  buildRemoveUserModal,
  buildAddUserModalWithSelect,
  buildRemoveUserModalWithSelect
};
