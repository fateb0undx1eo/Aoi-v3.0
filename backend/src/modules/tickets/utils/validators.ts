import { TICKET_TAGS } from './constants.js';
import type { TicketTag } from './constants.js';

export function isValidTicketTag(value: string): boolean {
  return TICKET_TAGS.some((tag) => tag.value === value);
}

export function getTicketTagByValue(value: string): TicketTag | null {
  return TICKET_TAGS.find((tag) => tag.value === value) || null;
}

export function isValidDiscordId(id: string): boolean {
  return /^\d{15,22}$/.test(String(id));
}

export function isValidChannelId(id: string): boolean {
  return isValidDiscordId(id);
}

export function isValidThreadId(id: string): boolean {
  return isValidDiscordId(id);
}

export function isValidCustomId(customId: string): boolean {
  return typeof customId === 'string' && customId.length > 0 && customId.length <= 100;
}

export function validateUserIdFromModal(interaction: any, customId: string): string | null {
  if (!interaction?.components) return null;
  try {
    for (const row of interaction.components) {
      for (const component of row.components || []) {
        if (component.custom_id === customId || component.customId === customId) {
          return component.values?.[0] || null;
        }
      }
    }
    return null;
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
  validateUserIdFromModal
};
