/**
 * Utilities for building and parsing custom Discord component IDs
 */

import { CUSTOM_IDS } from './constants.js';

// Validation regex for Discord IDs (16-20 digits)
const DISCORD_ID_REGEX = /^\d{16,20}$/;

/**
 * Builds a custom ID for the resolved button
 * Format: tickets:resolved:<creatorId>
 */
export function buildResolvedCustomId(creatorId) {
  return `${CUSTOM_IDS.resolvedPrefix}:${creatorId}`;
}

/**
 * Parses creator ID from a resolved custom ID
 * Returns null if invalid
 */
export function parseResolvedCreatorId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.resolvedPrefix}:`)) return null;
  const creatorId = customId.slice(`${CUSTOM_IDS.resolvedPrefix}:`.length);
  return DISCORD_ID_REGEX.test(creatorId) ? creatorId : null;
}

/**
 * Builds a custom ID for the resolve confirmation button (Yes)
 * Format: tickets:resolve-confirm:<creatorId>
 */
export function buildResolveConfirmCustomId(creatorId) {
  return `${CUSTOM_IDS.resolveConfirmPrefix}:${creatorId}`;
}

/**
 * Parses creator ID from a resolve confirmation custom ID
 */
export function parseResolveConfirmCreatorId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.resolveConfirmPrefix}:`)) return null;
  const creatorId = customId.slice(`${CUSTOM_IDS.resolveConfirmPrefix}:`.length);
  return DISCORD_ID_REGEX.test(creatorId) ? creatorId : null;
}

/**
 * Builds a custom ID for the resolve cancel button (No)
 * Format: tickets:resolve-cancel:<creatorId>
 */
export function buildResolveCancelCustomId(creatorId) {
  return `${CUSTOM_IDS.resolveCancelPrefix}:${creatorId}`;
}

/**
 * Parses creator ID from a resolve cancel custom ID
 */
export function parseResolveCancelCreatorId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.resolveCancelPrefix}:`)) return null;
  const creatorId = customId.slice(`${CUSTOM_IDS.resolveCancelPrefix}:`.length);
  return DISCORD_ID_REGEX.test(creatorId) ? creatorId : null;
}

/**
 * Builds a custom ID for the add users button
 * Format: tickets:add-users:<threadId>
 */
export function buildAddUsersCustomId(threadId) {
  return `${CUSTOM_IDS.addUsersPrefix}:${threadId}`;
}

/**
 * Parses thread ID from an add users custom ID
 */
export function parseAddUsersThreadId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.addUsersPrefix}:`)) return null;
  const threadId = customId.slice(`${CUSTOM_IDS.addUsersPrefix}:`.length);
  return DISCORD_ID_REGEX.test(threadId) ? threadId : null;
}

/**
 * Builds a custom ID for the remove users button
 * Format: tickets:remove-users:<threadId>
 */
export function buildRemoveUsersCustomId(threadId) {
  return `${CUSTOM_IDS.removeUsersPrefix}:${threadId}`;
}

/**
 * Parses thread ID from a remove users custom ID
 */
export function parseRemoveUsersThreadId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.removeUsersPrefix}:`)) return null;
  const threadId = customId.slice(`${CUSTOM_IDS.removeUsersPrefix}:`.length);
  return DISCORD_ID_REGEX.test(threadId) ? threadId : null;
}

/**
 * Builds a custom ID for the add users modal
 * Format: tickets:add-users-modal:<threadId>
 */
export function buildAddUsersModalCustomId(threadId) {
  return `${CUSTOM_IDS.addUsersModal}:${threadId}`;
}

/**
 * Parses thread ID from an add users modal custom ID
 */
export function parseAddUsersModalThreadId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.addUsersModal}:`)) return null;
  const threadId = customId.slice(`${CUSTOM_IDS.addUsersModal}:`.length);
  return DISCORD_ID_REGEX.test(threadId) ? threadId : null;
}

/**
 * Builds a custom ID for the remove users modal
 * Format: tickets:remove-users-modal:<threadId>
 */
export function buildRemoveUsersModalCustomId(threadId) {
  return `${CUSTOM_IDS.removeUsersModal}:${threadId}`;
}

/**
 * Parses thread ID from a remove users modal custom ID
 */
export function parseRemoveUsersModalThreadId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.removeUsersModal}:`)) return null;
  const threadId = customId.slice(`${CUSTOM_IDS.removeUsersModal}:`.length);
  return DISCORD_ID_REGEX.test(threadId) ? threadId : null;
}

/**
 * Builds a Discord channel link
 */
export function buildThreadLink(guildId, threadId) {
  return `https://discord.com/channels/${guildId}/${threadId}`;
}

export default {
  buildResolvedCustomId,
  parseResolvedCreatorId,
  buildResolveConfirmCustomId,
  parseResolveConfirmCreatorId,
  buildResolveCancelCustomId,
  parseResolveCancelCreatorId,
  buildAddUsersCustomId,
  parseAddUsersThreadId,
  buildRemoveUsersCustomId,
  parseRemoveUsersThreadId,
  buildAddUsersModalCustomId,
  parseAddUsersModalThreadId,
  buildRemoveUsersModalCustomId,
  parseRemoveUsersModalThreadId,
  buildThreadLink
};
