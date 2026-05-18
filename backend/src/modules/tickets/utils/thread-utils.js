/**
 * Discord thread utilities
 */

import { ChannelType } from 'discord.js';
import { THREAD_PREFIX_CLOSED, TICKET_STAFF_ROLE_IDS, ADD_STAFF_MEMBERS_TO_THREAD } from './constants.js';
import { parseResolvedCreatorId } from './custom-id-utils.js';
import { COMPONENT_TYPES } from './constants.js';

/**
 * Generates a random thread name with prefix
 * Example: "support-A3F2"
 */
export function generateThreadName(prefix) {
  const suffix = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

/**
 * Marks a thread name as closed by adding the closed prefix
 */
export function markThreadNameClosed(name) {
  if (name.startsWith(THREAD_PREFIX_CLOSED)) return name;
  return `${THREAD_PREFIX_CLOSED}${name}`;
}

/**
 * Checks if a thread name indicates a closed ticket
 */
export function isThreadNameClosed(name) {
  return name.startsWith(THREAD_PREFIX_CLOSED);
}

/**
 * Adds staff members to a thread
 * Fetches all members with staff roles and adds them to the thread
 */
export async function addStaffMembersToThread(thread) {
  if (!ADD_STAFF_MEMBERS_TO_THREAD) return;

  const guild = thread.guild;
  await guild.members.fetch().catch(() => null);

  const staffUserIds = new Set();
  for (const roleId of TICKET_STAFF_ROLE_IDS) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;
    for (const member of role.members.values()) {
      staffUserIds.add(member.id);
    }
  }

  await Promise.all(
    [...staffUserIds].map((userId) => thread.members.add(userId).catch(() => null))
  );
}

/**
 * Extracts the ticket creator ID from a thread by reading the welcome message
 * Looks for the RESOLVED button custom ID in the message components
 */
export async function getCreatorIdFromThread(thread) {
  const messages = await thread.messages.fetch({ limit: 30 }).catch(() => null);
  if (!messages) return null;

  for (const message of messages.values()) {
    for (const row of message.components ?? []) {
      for (const component of row.components ?? []) {
        const id = component.customId ?? component.custom_id ?? null;
        const creatorId = parseResolvedCreatorId(id);
        if (creatorId) return creatorId;
      }
    }
  }

  return null;
}

/**
 * Checks if a user has an open ticket in a channel
 * Returns true if found, false otherwise
 */
export async function hasOpenTicketInChannel(parentChannel, userId, botUserId) {
  const active = await parentChannel.threads.fetchActive().catch(() => null);
  if (!active) return false;

  for (const thread of active.threads.values()) {
    // Must be a private thread owned by the bot and not closed
    if (thread.type !== ChannelType.PrivateThread) continue;
    if (thread.ownerId !== botUserId) continue;
    if (isThreadNameClosed(thread.name)) continue;
    if (thread.locked || thread.archived) continue;

    // Check if this thread was created by the user
    const creatorId = await getCreatorIdFromThread(thread);
    if (creatorId === userId) return true;
  }

  return false;
}

/**
 * Builds mention string for ticket notification
 * Mentions the creator and all staff roles
 */
export function buildTicketMentions(creatorId) {
  const roleMentions = TICKET_STAFF_ROLE_IDS.map((roleId) => `<@&${roleId}>`).join(' ');
  return `<@${creatorId}> ${roleMentions}`.trim();
}

/**
 * Finds and disables the RESOLVED button in a thread's welcome message
 * Prevents further interaction after ticket is closed
 */
export async function findWelcomeMessageInThread(thread) {
  const messages = await thread.messages.fetch({ limit: 30 }).catch(() => null);
  if (!messages) return null;

  for (const message of messages.values()) {
    // Check if this message has the RESOLVED button
    let hasResolvedButton = false;
    for (const row of message.components ?? []) {
      for (const component of row.components ?? []) {
        const id = component.customId ?? component.custom_id ?? null;
        if (parseResolvedCreatorId(id)) {
          hasResolvedButton = true;
          break;
        }
      }
      if (hasResolvedButton) break;
    }

    if (hasResolvedButton) {
      return message;
    }
  }

  return null;
}

/**
 * Extracts the tag label from a welcome message
 * Looks for the first TextDisplay component with a markdown header
 */
export function extractTagLabelFromMessage(message) {
  if (!message) return null;
  for (const topLevel of message.components ?? []) {
    // Container → children
    for (const child of topLevel.components ?? []) {
      if (child.type === COMPONENT_TYPES.TextDisplay) {
        const text = child.content ?? child.data?.content ?? '';
        if (text.startsWith('# ')) {
          return text.slice(2).trim();
        }
      }
    }
  }
  return null;
}

export default {
  generateThreadName,
  markThreadNameClosed,
  isThreadNameClosed,
  addStaffMembersToThread,
  getCreatorIdFromThread,
  hasOpenTicketInChannel,
  buildTicketMentions,
  findWelcomeMessageInThread,
  extractTagLabelFromMessage
};
