import { CUSTOM_IDS } from './constants.js';

const DISCORD_ID_REGEX = /^\d{16,20}$/;

export function buildResolvedCustomId(creatorId: string): string {
  return `${CUSTOM_IDS.resolvedPrefix}:${creatorId}`;
}

export function parseResolvedCreatorId(customId: string): string | null {
  if (!customId?.startsWith(`${CUSTOM_IDS.resolvedPrefix}:`)) return null;
  const creatorId = customId.slice(`${CUSTOM_IDS.resolvedPrefix}:`.length);
  return DISCORD_ID_REGEX.test(creatorId) ? creatorId : null;
}

export function buildResolveConfirmCustomId(creatorId: string): string {
  return `${CUSTOM_IDS.resolveConfirmPrefix}:${creatorId}`;
}

export function parseResolveConfirmCreatorId(customId: string): string | null {
  if (!customId?.startsWith(`${CUSTOM_IDS.resolveConfirmPrefix}:`)) return null;
  const creatorId = customId.slice(`${CUSTOM_IDS.resolveConfirmPrefix}:`.length);
  return DISCORD_ID_REGEX.test(creatorId) ? creatorId : null;
}

export function buildResolveCancelCustomId(creatorId: string): string {
  return `${CUSTOM_IDS.resolveCancelPrefix}:${creatorId}`;
}

export function parseResolveCancelCreatorId(customId: string): string | null {
  if (!customId?.startsWith(`${CUSTOM_IDS.resolveCancelPrefix}:`)) return null;
  const creatorId = customId.slice(`${CUSTOM_IDS.resolveCancelPrefix}:`.length);
  return DISCORD_ID_REGEX.test(creatorId) ? creatorId : null;
}

export function buildAddUsersCustomId(threadId: string): string {
  return `${CUSTOM_IDS.addUsersPrefix}:${threadId}`;
}

export function parseAddUsersThreadId(customId: string): string | null {
  if (!customId?.startsWith(`${CUSTOM_IDS.addUsersPrefix}:`)) return null;
  const threadId = customId.slice(`${CUSTOM_IDS.addUsersPrefix}:`.length);
  return DISCORD_ID_REGEX.test(threadId) ? threadId : null;
}

export function buildRemoveUsersCustomId(threadId: string): string {
  return `${CUSTOM_IDS.removeUsersPrefix}:${threadId}`;
}

export function parseRemoveUsersThreadId(customId: string): string | null {
  if (!customId?.startsWith(`${CUSTOM_IDS.removeUsersPrefix}:`)) return null;
  const threadId = customId.slice(`${CUSTOM_IDS.removeUsersPrefix}:`.length);
  return DISCORD_ID_REGEX.test(threadId) ? threadId : null;
}

export function buildAddUsersModalCustomId(threadId: string): string {
  return `${CUSTOM_IDS.addUsersModal}:${threadId}`;
}

export function parseAddUsersModalThreadId(customId: string): string | null {
  if (!customId?.startsWith(`${CUSTOM_IDS.addUsersModal}:`)) return null;
  const threadId = customId.slice(`${CUSTOM_IDS.addUsersModal}:`.length);
  return DISCORD_ID_REGEX.test(threadId) ? threadId : null;
}

export function buildRemoveUsersModalCustomId(threadId: string): string {
  return `${CUSTOM_IDS.removeUsersModal}:${threadId}`;
}

export function parseRemoveUsersModalThreadId(customId: string): string | null {
  if (!customId?.startsWith(`${CUSTOM_IDS.removeUsersModal}:`)) return null;
  const threadId = customId.slice(`${CUSTOM_IDS.removeUsersModal}:`.length);
  return DISCORD_ID_REGEX.test(threadId) ? threadId : null;
}

export function buildThreadLink(guildId: string, threadId: string): string {
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
