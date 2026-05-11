/**
 * Enterprise-grade constants and configuration for ticket system
 * SINGLE SOURCE OF TRUTH - All constants consolidated here
 */

// ==================== TICKET CONFIGURATION ====================

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

// ==================== DISCORD CONFIGURATION ====================

export const TICKET_STAFF_ROLE_IDS = [
  '1457403601512169724'
];

export const TICKET_LOG_CHANNEL_ID = '1485668403132760243';
export const ADD_STAFF_MEMBERS_TO_THREAD = false;

export const TICKET_COMMAND_NAMES = new Set([
  'ticket'
]);

// ==================== COMPONENT TYPES ====================

export const COMPONENT_TYPES = {
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
  TextDisplay: 10,
  Container: 17
};

// ==================== CUSTOM IDs ====================

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

// ==================== UI ELEMENTS ====================

export const POINTER = '<:Pointer:1502993771317694655>';

// ==================== THREAD CONFIGURATION ====================

export const THREAD_PREFIX_CLOSED = '[CLOSED] ';
export const THREAD_NAME_MAX_LENGTH = 100;

// Auto-archive durations (in minutes)
export const AUTO_ARCHIVE_24H = 1440;
export const AUTO_ARCHIVE_1H = 60;
export const DEFAULT_ARCHIVE_DURATION = AUTO_ARCHIVE_1H;

// ==================== TIME CONSTANTS ====================

export const TICKET_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
export const TICKET_CREATION_LOCK_MS = 8000; // 8 seconds

// ==================== REDIS CONFIGURATION ====================

export const REDIS_TTL = {
  CREATION_LOCK: TICKET_CREATION_LOCK_MS,
  RESOLVE_MUTEX: 30 * 1000, // 30 seconds
  WEBHOOK_LOCK: 5 * 1000, // 5 seconds
  WEBHOOK_CACHE: 30 * 60 * 1000, // 30 minutes
  COOLDOWN: TICKET_COOLDOWN_MS,
  METRICS: 60 * 60 * 1000, // 1 hour
  LOGS: 24 * 60 * 60 * 1000 // 24 hours
};

// ==================== ERROR MESSAGES ====================

export const ERROR_MESSAGES = {
  NOT_IN_GUILD: 'This command only works in a server.',
  NOT_TICKET_THREAD: 'This command only works inside ticket threads.',
  NOT_TICKET_STAFF: 'Only support staff can use this command.',
  ALREADY_OPEN_TICKET: 'You already have an active ticket in this channel.',
  TICKET_COOLDOWN: (readyAt) => `You recently closed a ticket. You can open another <t:${readyAt}:R>.`,
  CREATION_IN_PROGRESS: 'A ticket creation is already in progress. Please wait a few seconds and try again.',
  FAILED_THREAD_CREATION: 'Failed to create ticket thread.',
  FAILED_ADD_USER: 'Ticket thread was created, but I could not add you to it.',
  INVALID_TICKET_STATE: 'Invalid ticket state.',
  WRONG_THREAD: 'This control only works in its original thread.',
  CLOSED_TICKET_OPERATIONS: 'Cannot perform operations on closed/archived tickets.',
  NO_USER_SELECTED: 'Please select a user.',
  CANNOT_REMOVE_STAFF: 'Cannot remove staff members from tickets.',
  FAILED_OPERATION: 'Operation failed. Please try again.'
};

// ==================== SUCCESS MESSAGES ====================

export const SUCCESS_MESSAGES = {
  TICKET_CREATED: (threadId) => `Ticket created: <#${threadId}>`,
  TICKET_RESOLVED: 'Ticket marked as resolved.',
  USER_ADDED: (userId) => `Added <@${userId}>`,
  USER_REMOVED: (userId) => `Removed <@${userId}>`,
  PANEL_SENT: 'Ticket panel sent in this channel.'
};

// ==================== LOG COLORS ====================

export const LOG_COLORS = {
  CREATED: 0x8b2b2b,
  RESOLVED: 0x2fa44f,
  USER_ADDED: 0x57f287,
  USER_REMOVED: 0xed4245
};

// ==================== DATABASE CONFIGURATION ====================

export const DB_CONSTRAINTS = {
  MAX_TICKETS_PER_USER: 1, // Open tickets per user
  MAX_COOLDOWN_RECORDS: 1000,
  BATCH_SIZE: 100
};

// ==================== RECONCILIATION CONFIGURATION ====================

export const RECONCILIATION = {
  INTERVAL_HOURS: 6, // Run reconciliation every 6 hours
  BATCH_SIZE: 50,
  MAX_AGE_DAYS: 30 // Don't reconcile tickets older than 30 days
};

// ==================== METRICS CONFIGURATION ====================

export const METRICS = {
  MAX_ENTRIES: 100, // Keep latest 100 metrics per operation
  RETENTION_HOURS: 24,
  OPERATIONS: [
    'ticket_created',
    'ticket_resolved',
    'user_added',
    'user_removed',
    'cooldown_check',
    'webhook_fetch'
  ]
};

// ==================== LOGGING CONFIGURATION ====================

export const LOGGING = {
  MAX_ENTRIES: 100, // Keep latest 100 log entries
  RETENTION_HOURS: 24,
  LEVELS: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
  }
};

// ==================== VALIDATION CONFIGURATION ====================

export const VALIDATION = {
  MAX_THREAD_NAME_LENGTH: 100,
  MAX_REASON_LENGTH: 1000,
  MAX_MODAL_INPUT_LENGTH: 1000,
  USER_ID_REGEX: /^\d{17,19}$/,
  THREAD_ID_REGEX: /^\d{17,19}$/,
  GUILD_ID_REGEX: /^\d{17,19}$/
};
