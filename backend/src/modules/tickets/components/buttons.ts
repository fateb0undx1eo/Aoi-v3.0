import { ButtonStyle } from 'discord.js';
import { COMPONENT_TYPES } from '../utils/constants.js';
import {
  buildResolvedCustomId,
  buildResolveConfirmCustomId,
  buildResolveCancelCustomId,
  buildAddUsersCustomId,
  buildRemoveUsersCustomId
} from '../utils/custom-id-utils.js';

export function buildResolvedButton(creatorId: string, disabled = false) {
  return {
    type: COMPONENT_TYPES.Button,
    style: ButtonStyle.Secondary,
    custom_id: buildResolvedCustomId(creatorId),
    label: 'RESOLVED',
    emoji: { name: 'Resolved', id: '1503284846980632647' },
    disabled
  };
}

export function buildResolveConfirmButton(creatorId: string) {
  return {
    type: COMPONENT_TYPES.Button,
    style: ButtonStyle.Danger,
    custom_id: buildResolveConfirmCustomId(creatorId),
    label: 'Yes, close it'
  };
}

export function buildResolveCancelButton(creatorId: string) {
  return {
    type: COMPONENT_TYPES.Button,
    style: ButtonStyle.Secondary,
    custom_id: buildResolveCancelCustomId(creatorId),
    label: 'No, keep open'
  };
}

export function buildAddUserButton(threadId: string) {
  return {
    type: COMPONENT_TYPES.Button,
    style: ButtonStyle.Secondary,
    custom_id: buildAddUsersCustomId(threadId),
    label: 'ADD USER',
    emoji: { name: 'Add', id: '1503290197079752745' }
  };
}

export function buildRemoveUserButton(threadId: string) {
  return {
    type: COMPONENT_TYPES.Button,
    style: ButtonStyle.Secondary,
    custom_id: buildRemoveUsersCustomId(threadId),
    label: 'REMOVE USER',
    emoji: { name: 'Remove', id: '1503290199281635391' }
  };
}

export function buildResolveConfirmationRow(creatorId: string) {
  return {
    type: COMPONENT_TYPES.ActionRow,
    components: [
      buildResolveConfirmButton(creatorId),
      buildResolveCancelButton(creatorId)
    ]
  };
}

export function buildUserManagementRow(threadId: string) {
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
