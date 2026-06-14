import { COMPONENT_TYPES, CUSTOM_IDS, TICKET_TAGS } from '../utils/constants.js';

export function buildTicketTagSelectMenu() {
  return {
    type: COMPONENT_TYPES.StringSelect,
    custom_id: CUSTOM_IDS.ticketTagSelect,
    placeholder: 'Select a ticket category',
    options: TICKET_TAGS.map(({ label, value, description, emoji }) => ({
      label,
      value,
      description,
      emoji
    }))
  };
}

export function buildTicketTagSelectRow() {
  return {
    type: COMPONENT_TYPES.ActionRow,
    components: [buildTicketTagSelectMenu()]
  };
}

export function buildUserSelect(customId: string, placeholder = 'Select user', required = true) {
  return {
    type: 5,
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
