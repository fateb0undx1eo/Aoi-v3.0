/**
 * Custom ID utilities for ticket system interactions
 */

export const CUSTOM_IDS = {
  ticketTagSelect: 'tickets:tag-select',
  resolvedPrefix: 'tickets:resolved',
  resolvedConfirm: 'tickets:resolved-confirm',
  resolvedConfirmYes: 'tickets:resolved-confirm-yes',
  resolvedConfirmNo: 'tickets:resolved-confirm-no',
  addUsersPrefix: 'tickets:add-users',
  removeUsersPrefix: 'tickets:remove-users',
  addUsersModal: 'tickets:add-users-modal',
  removeUsersModal: 'tickets:remove-users-modal',
  addUserSelect: 'tickets:add-user-select-modal',
  removeUserSelect: 'tickets:remove-user-select-modal'
};

/**
 * Build custom ID for resolved button
 */
export function buildResolvedCustomId(creatorId) {
  return `${CUSTOM_IDS.resolvedPrefix}:${creatorId}`;
}

/**
 * Parse creator ID from resolved button custom ID
 */
export function parseResolvedCreatorId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.resolvedPrefix}:`)) {
    return null;
  }

  const creatorId = customId.slice(`${CUSTOM_IDS.resolvedPrefix}:`.length);
  return /^\d{16,20}$/.test(creatorId) ? creatorId : null;
}

/**
 * Parse creator ID from resolved confirmation YES custom ID
 */
export function parseResolvedConfirmYesCreatorId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.resolvedConfirmYes}:`)) {
    return null;
  }

  const creatorId = customId.slice(`${CUSTOM_IDS.resolvedConfirmYes}:`.length);
  return /^\d{16,20}$/.test(creatorId) ? creatorId : null;
}

/**
 * Parse creator ID from resolved confirmation NO custom ID
 */
export function parseResolvedConfirmNoCreatorId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.resolvedConfirmNo}:`)) {
    return null;
  }

  const creatorId = customId.slice(`${CUSTOM_IDS.resolvedConfirmNo}:`.length);
  return /^\d{16,20}$/.test(creatorId) ? creatorId : null;
}

/**
 * Build custom ID for add users button
 */
export function buildAddUsersCustomId(threadId) {
  return `${CUSTOM_IDS.addUsersPrefix}:${threadId}`;
}

/**
 * Parse thread ID from add users button custom ID
 */
export function parseAddUsersThreadId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.addUsersPrefix}:`)) {
    return null;
  }

  const threadId = customId.slice(`${CUSTOM_IDS.addUsersPrefix}:`.length);
  return /^\d{16,20}$/.test(threadId) ? threadId : null;
}

/**
 * Build custom ID for remove users button
 */
export function buildRemoveUsersCustomId(threadId) {
  return `${CUSTOM_IDS.removeUsersPrefix}:${threadId}`;
}

/**
 * Parse thread ID from remove users button custom ID
 */
export function parseRemoveUsersThreadId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.removeUsersPrefix}:`)) {
    return null;
  }

  const threadId = customId.slice(`${CUSTOM_IDS.removeUsersPrefix}:`.length);
  return /^\d{16,20}$/.test(threadId) ? threadId : null;
}

/**
 * Build custom ID for add users modal
 */
export function buildAddUsersModalCustomId(threadId) {
  return `${CUSTOM_IDS.addUsersModal}:${threadId}`;
}

/**
 * Parse thread ID from add users modal custom ID
 */
export function parseAddUsersModalThreadId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.addUsersModal}:`)) {
    return null;
  }

  const threadId = customId.slice(`${CUSTOM_IDS.addUsersModal}:`.length);
  return /^\d{16,20}$/.test(threadId) ? threadId : null;
}

/**
 * Build custom ID for remove users modal
 */
export function buildRemoveUsersModalCustomId(threadId) {
  return `${CUSTOM_IDS.removeUsersModal}:${threadId}`;
}

/**
 * Parse thread ID from remove users modal custom ID
 */
export function parseRemoveUsersModalThreadId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.removeUsersModal}:`)) {
    return null;
  }

  const threadId = customId.slice(`${CUSTOM_IDS.removeUsersModal}:`.length);
  return /^\d{16,20}$/.test(threadId) ? threadId : null;
}

/**
 * Validate Discord ID format
 */
export function isValidDiscordId(id) {
  return /^\d{16,20}$/.test(id);
}

/**
 * Parse ticket tag from custom ID
 */
export function parseTicketTagFromCustomId(customId) {
  if (!customId?.startsWith('ticket_tag:')) {
    return null;
  }

  const parts = customId.split(':');
  return parts.length > 1 ? parts[1] : null;
}

/**
 * Parse thread ID from resolved confirmation custom ID
 */
export function parseResolvedConfirmThreadId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.resolvedConfirm}:`)) {
    return null;
  }

  const threadId = customId.slice(`${CUSTOM_IDS.resolvedConfirm}:`.length);
  return /^\d{16,20}$/.test(threadId) ? threadId : null;
}

/**
 * Extract thread ID from any ticket-related custom ID
 */
export function extractThreadIdFromCustomId(customId) {
  const patterns = [
    parseAddUsersThreadId,
    parseRemoveUsersThreadId,
    parseAddUsersModalThreadId,
    parseRemoveUsersModalThreadId
  ];

  for (const parser of patterns) {
    const threadId = parser(customId);
    if (threadId) return threadId;
  }

  return null;
}
