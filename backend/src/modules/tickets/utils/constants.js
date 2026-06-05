/**
 * Centralized constants and configuration for the tickets module
 */

// Discord emojis and UI constants
export const POINTER = '<:Pointer:1502993771317694655>';
export const AUTO_ARCHIVE_24H = 1440;
export const AUTO_ARCHIVE_1H = 60;

// Timing constraints
export const TICKET_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
export const TICKET_CREATION_LOCK_MS = 8000; // 8 seconds

// Configuration
export const TICKET_STAFF_ROLE_IDS = ['1503719057130782810'];
export const TICKET_LOG_CHANNEL_ID = '1485668403132760243';
export const ADD_STAFF_MEMBERS_TO_THREAD = false;
export const THREAD_PREFIX_CLOSED = '[CLOSED] ';

// Custom component IDs
export const CUSTOM_IDS = {
  ticketTagSelect: 'tickets:tag-select',
  resolvedPrefix: 'tickets:resolved',
  resolveConfirmPrefix: 'tickets:resolve-confirm',
  resolveCancelPrefix: 'tickets:resolve-cancel',
  addUsersPrefix: 'tickets:add-users',
  removeUsersPrefix: 'tickets:remove-users',
  addUsersModal: 'tickets:add-users-modal',
  removeUsersModal: 'tickets:remove-users-modal',
  addUserSelect: 'tickets:add-user-select-modal',
  removeUserSelect: 'tickets:remove-user-select-modal'
};

// Discord component type constants
export const COMPONENT_TYPES = {
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
  TextDisplay: 10,
  Container: 17
};

// Ticket tags/categories
export const TICKET_TAGS = [
  {
    label: 'General Support',
    value: 'general_support',
    description: 'Help with server-related questions',
    emoji: { name: 'Wump', id: '1503037895382929580' },
    namePrefix: 'support',
    intro: 'You opened this ticket for general server support.'
  },
  {
    label: 'Report a User',
    value: 'report_user',
    description: 'Report rule-breaking members',
    emoji: { name: 'Exclamation', id: '1503038935645945876' },
    namePrefix: 'report',
    intro: 'You opened this ticket to report a member.'
  },
  {
    label: 'Partnership Requests',
    value: 'partnership_requests',
    description: 'Inquiries regarding collaborations',
    emoji: { name: 'Fistbump', id: '1503043689281355896' },
    namePrefix: 'partner',
    intro: 'You opened this ticket for partnership or collaboration inquiries.'
  },
  {
    label: 'Booster Perk Claims',
    value: 'booster_perk_claims',
    description: 'Claim your booster rewards',
    emoji: { name: 'Heart', id: '1503038224044527739' },
    namePrefix: 'perk',
    intro: 'You opened this ticket to claim your booster perks.'
  }
];

export const TICKET_COMMAND_NAMES = new Set(['ticket']);

// Logging colors (for embeds)
export const LOG_COLORS = {
  CREATED: 0x8b2b2b,   // Dark red
  RESOLVED: 0x2fa44f,  // Green
  USER_ADDED: 0x57f287, // Light green
  USER_REMOVED: 0xed4245 // Red
};

// Generate a deterministic accent color from a thread ID
// Same thread ID always produces the same color, different threads get different hues
export function getTicketColor(threadId) {
  let hash = 0;
  const str = String(threadId);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return hslToInt(hue, 70, 35);
}

function hslToInt(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  const r = Math.round(f(0) * 255);
  const g = Math.round(f(8) * 255);
  const b = Math.round(f(4) * 255);
  return (r << 16) | (g << 8) | b;
}

// Error messages
export const ERROR_MESSAGES = {
  NO_PANEL_CHANNEL: 'Tickets can only be created from a text channel panel.',
  ON_COOLDOWN: (readyAt) => `You recently closed a ticket. You can open another <t:${readyAt}:R>.`,
  ALREADY_OPEN: 'You already have an active ticket in this channel.',
  THREAD_CREATE_FAILED: 'Failed to create ticket thread.',
  ADD_USER_FAILED: 'Ticket thread was created, but I could not add you to it.',
  NOT_STAFF: 'Only support staff can perform this action.',
  NOT_IN_THREAD: 'This action only works inside ticket threads.',
  INVALID_THREAD: 'This control only works in its original thread.',
  ALREADY_CLOSED: 'This ticket is already closed.',
  NOT_FOUND: 'Could not find that user.',
  NO_USER_SELECTED: 'Please select a user.',
  CANNOT_REMOVE_STAFF: (userId) => `Cannot remove <@${userId}> — they are support staff, an admin, or the server owner.`,
  ADMIN_ONLY: 'Only server owner or admins can use this command.',
  LOCKED_IN_CREATION: 'A ticket creation is already in progress. Please wait a few seconds and try again.',
  UNKNOWN_CATEGORY: 'Unknown ticket category selected.',
  INVALID_STATE: 'Invalid ticket state.'
};

export default {
  POINTER,
  AUTO_ARCHIVE_24H,
  AUTO_ARCHIVE_1H,
  TICKET_COOLDOWN_MS,
  TICKET_CREATION_LOCK_MS,
  TICKET_STAFF_ROLE_IDS,
  TICKET_LOG_CHANNEL_ID,
  ADD_STAFF_MEMBERS_TO_THREAD,
  THREAD_PREFIX_CLOSED,
  CUSTOM_IDS,
  COMPONENT_TYPES,
  TICKET_TAGS,
  TICKET_COMMAND_NAMES,
  LOG_COLORS,
  getTicketColor,
  ERROR_MESSAGES
};
