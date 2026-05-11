import { ChannelType } from 'discord.js';

/**
 * Thread utilities for ticket system
 */

export const THREAD_PREFIX_CLOSED = '[CLOSED] ';
export const AUTO_ARCHIVE_24H = 1440;
export const AUTO_ARCHIVE_1H = 60;

/**
 * Generate collision-safe thread name with UUID
 */
export function generateThreadName(prefix) {
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `${prefix}-${suffix}`;
}

/**
 * Mark thread name as closed
 */
export function markThreadNameClosed(name) {
  if (name.startsWith(THREAD_PREFIX_CLOSED)) return name;
  
  // Ensure we don't exceed Discord's 100-character limit
  const closedName = `${THREAD_PREFIX_CLOSED}${name}`;
  return closedName.length > 100 
    ? `${THREAD_PREFIX_CLOSED}${name.slice(0, 100 - THREAD_PREFIX_CLOSED.length)}`
    : closedName;
}

/**
 * Mark thread name as open
 */
export function markThreadNameOpen(name) {
  if (!name.startsWith(THREAD_PREFIX_CLOSED)) return name;
  return name.slice(THREAD_PREFIX_CLOSED.length);
}

/**
 * Check if thread name is marked as closed
 */
export function isThreadNameClosed(name) {
  return name.startsWith(THREAD_PREFIX_CLOSED);
}

/**
 * Build Discord thread link
 */
export function buildThreadLink(guildId, threadId) {
  return `https://discord.com/channels/${guildId}/${threadId}`;
}

/**
 * Validate thread is a valid ticket thread
 */
export function isValidTicketThread(thread) {
  return (
    thread?.isThread?.() &&
    thread.type === ChannelType.PrivateThread &&
    thread.parent?.isTextBased?.()
  );
}

/**
 * Check if thread is in a state that allows user management
 */
export function canManageUsers(thread) {
  return (
    !thread.archived &&
    !thread.locked &&
    isValidTicketThread(thread)
  );
}

/**
 * Safely update thread name with length validation
 */
export async function safeUpdateThreadName(thread, newName) {
  const maxLength = 100;
  const safeName = newName.length > maxLength 
    ? newName.slice(0, maxLength)
    : newName;
  
  try {
    await thread.setName(safeName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract original thread name without [CLOSED] prefix
 */
export function getOriginalThreadName(name) {
  return isThreadNameClosed(name) 
    ? markThreadNameOpen(name)
    : name;
}
