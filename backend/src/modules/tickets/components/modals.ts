import { CUSTOM_IDS } from '../utils/constants.js';
import { buildUserSelect } from './selects.js';

export function buildAddUserModal(threadId: string) {
  return {
    custom_id: `${CUSTOM_IDS.addUsersModal}:${threadId}`,
    title: 'Add User',
    components: [
      {
        type: 1,
        components: [
          {
            type: 4,
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

export function buildRemoveUserModal(threadId: string) {
  return {
    custom_id: `${CUSTOM_IDS.removeUsersModal}:${threadId}`,
    title: 'Remove User',
    components: [
      {
        type: 1,
        components: [
          {
            type: 4,
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

export function buildAddUserModalWithSelect(threadId: string) {
  return {
    custom_id: `${CUSTOM_IDS.addUsersModal}:${threadId}`,
    title: 'Add User',
    components: [
      {
        type: 1,
        components: [
          buildUserSelect(CUSTOM_IDS.addUserSelect, 'Select user to add')
        ]
      }
    ]
  };
}

export function buildRemoveUserModalWithSelect(threadId: string) {
  return {
    custom_id: `${CUSTOM_IDS.removeUsersModal}:${threadId}`,
    title: 'Remove User',
    components: [
      {
        type: 1,
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
