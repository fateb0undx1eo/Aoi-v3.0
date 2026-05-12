/**
 * Select menu component builders for Discord interactions
 */

import { COMPONENT_TYPES, CUSTOM_IDS, TICKET_TAGS } from '../utils/constants.js';

/**
 * Builds the ticket tag selection menu
 */
export function buildTicketTagSelectMenu() {
  return {
    type: COMPONENT_TYPES.StringSelect,
    custom_id: CUSTOM_IDS.ticketTagSelect,
    placeholder: 'Select a ticket category',
    min_values: 1,
    max_values: 1,
    options: TICKET_TAGS.map(({ label, value, description, emoji }) => ({
      label,
      value,
      description,
      emoji
    }))
  };
}

/**
 * Builds an action row containing the ticket tag select menu
 */
export function buildTicketTagSelectRow() {
  return {
    type: COMPONENT_TYPES.ActionRow,
    components: [buildTicketTagSelectMenu()]
  };
}

/**
 * Builds a user select component for modals
 * Used in add/remove user modals
 */
export function buildUserSelect(customId, placeholder = 'Select user', required = true) {
  return {
    type: 5, // User select
    custom_id: customId,
    placeholder,
    min_values: 1,
    max_values: 1,
    required
  };
}

export default {
  buildTicketTagSelectMenu,
  buildTicketTagSelectRow,
  buildUserSelect
};
