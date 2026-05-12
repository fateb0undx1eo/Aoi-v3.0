/**
 * Input validation utilities
 */

import { TICKET_TAGS } from './constants.js';

/**
 * Validates if a ticket tag value is valid
 */
export function isValidTicketTag(value) {
  return TICKET_TAGS.some((tag) => tag.value === value);
}

/**
 * Gets a ticket tag by value
 * Returns the tag object or null
 */
export function getTicketTagByValue(value) {
  return TICKET_TAGS.find((tag) => tag.value === value) || null;
}

/**
 * Validates if a string is a valid Discord ID
 * Discord IDs are 16-20 digits
 */
export function isValidDiscordId(id) {
  return /^\d{16,20}$/.test(String(id));
}

/**
 * Validates if a string is a valid channel ID (same as user/guild ID validation)
 */
export function isValidChannelId(id) {
  return isValidDiscordId(id);
}

/**
 * Validates if a string is a valid thread ID
 */
export function isValidThreadId(id) {
  return isValidDiscordId(id);
}

/**
 * Validates if a custom ID format is valid
 */
export function isValidCustomId(customId) {
  return typeof customId === 'string' && customId.length > 0 && customId.length <= 100;
}

/**
 * Validates a user ID from interaction fields
 */
export function validateUserIdFromFields(fields, fieldKey) {
  if (!fields) return null;
  try {
    const users = fields.getSelectedUsers?.(fieldKey);
    return users?.first()?.id || null;
  } catch {
    return null;
  }
}

export default {
  isValidTicketTag,
  getTicketTagByValue,
  isValidDiscordId,
  isValidChannelId,
  isValidThreadId,
  isValidCustomId,
  validateUserIdFromFields
};
