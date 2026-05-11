import { 
  StringSelectMenuBuilder, 
  UserSelectMenuBuilder, 
  RoleSelectMenuBuilder, 
  ChannelSelectMenuBuilder, 
  MentionableSelectMenuBuilder,
  ActionRowBuilder 
} from 'discord.js';
import { CUSTOM_IDS } from '../utils/constants.js';

/**
 * Enterprise-grade select menu component utilities for ticket system
 * Provides standardized select menu creation with proper styling and IDs
 */

/**
 * Create ticket tag selection menu
 * @param {Array} tags - Array of ticket tag configurations
 * @param {string} placeholder - Select menu placeholder text
 * @returns {ActionRowBuilder} Action row with select menu
 */
export function createTicketTagSelectMenu(tags, placeholder = 'Select a ticket category...') {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_IDS.ticketTagSelect)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(1);

  // Add tag options
  for (const tag of tags) {
    selectMenu.addOptions({
      label: tag.label,
      value: tag.value,
      description: tag.description || '',
      emoji: tag.emoji
    });
  }

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create user selection menu for adding to tickets
 * @param {string} threadId - Thread ID
 * @param {Array} excludeUsers - Array of user IDs to exclude from selection
 * @returns {ActionRowBuilder} Action row with user select menu
 */
export function createAddUserSelectMenu(threadId, excludeUsers = []) {
  const selectMenu = new UserSelectMenuBuilder()
    .setCustomId(`${CUSTOM_IDS.addUserSelectPrefix}:${threadId}`)
    .setPlaceholder('Select users to add...')
    .setMinValues(1)
    .setMaxValues(10);

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create user selection menu for removing from tickets
 * @param {string} threadId - Thread ID
 * @param {Array} availableUsers - Array of user IDs that can be removed
 * @returns {ActionRowBuilder} Action row with user select menu
 */
export function createRemoveUserSelectMenu(threadId, availableUsers = []) {
  const selectMenu = new UserSelectMenuBuilder()
    .setCustomId(`${CUSTOM_IDS.removeUserSelectPrefix}:${threadId}`)
    .setPlaceholder('Select users to remove...')
    .setMinValues(1)
    .setMaxValues(10);

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create priority selection menu
 * @param {string} threadId - Thread ID
 * @param {string} currentPriority - Current priority level
 * @returns {ActionRowBuilder} Action row with priority select menu
 */
export function createPrioritySelectMenu(threadId, currentPriority = 'normal') {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CUSTOM_IDS.prioritySelectPrefix}:${threadId}`)
    .setPlaceholder('Select priority level...')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions([
      {
        label: '🟢 Low Priority',
        value: 'low',
        description: 'Low priority - will be handled when time permits',
        default: currentPriority === 'low'
      },
      {
        label: '🟡 Normal Priority',
        value: 'normal',
        description: 'Normal priority - standard handling',
        default: currentPriority === 'normal'
      },
      {
        label: '🟠 High Priority',
        value: 'high',
        description: 'High priority - expedited handling',
        default: currentPriority === 'high'
      },
      {
        label: '🔴 Urgent Priority',
        value: 'urgent',
        description: 'Urgent priority - immediate attention required',
        default: currentPriority === 'urgent'
      }
    ]);

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create staff assignment selection menu
 * @param {string} threadId - Thread ID
 * @param {Array} staffOptions - Array of staff member options
 * @param {string} currentAssignee - Current assigned staff ID
 * @returns {ActionRowBuilder} Action row with staff select menu
 */
export function createStaffAssignmentSelectMenu(threadId, staffOptions = [], currentAssignee = null) {
  const selectMenu = new UserSelectMenuBuilder()
    .setCustomId(`${CUSTOM_IDS.staffAssignPrefix}:${threadId}`)
    .setPlaceholder('Select staff member to assign...')
    .setMinValues(0)
    .setMaxValues(1);

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create category selection menu for ticket management
 * @param {string} threadId - Thread ID
 * @param {Array} categories - Array of category options
 * @param {string} currentCategory - Current category
 * @returns {ActionRowBuilder} Action row with category select menu
 */
export function createCategorySelectMenu(threadId, categories = [], currentCategory = null) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CUSTOM_IDS.categorySelectPrefix}:${threadId}`)
    .setPlaceholder('Select ticket category...')
    .setMinValues(1)
    .setMaxValues(1);

  // Add category options
  for (const category of categories) {
    selectMenu.addOptions({
      label: category.label,
      value: category.value,
      description: category.description || '',
      emoji: category.emoji,
      default: category.value === currentCategory
    });
  }

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create status selection menu
 * @param {string} threadId - Thread ID
 * @param {string} currentStatus - Current status
 * @returns {ActionRowBuilder} Action row with status select menu
 */
export function createStatusSelectMenu(threadId, currentStatus = 'open') {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CUSTOM_IDS.statusSelectPrefix}:${threadId}`)
    .setPlaceholder('Select ticket status...')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions([
      {
        label: '🟢 Open',
        value: 'open',
        description: 'Ticket is open and active',
        default: currentStatus === 'open'
      },
      {
        label: '🟡 In Progress',
        value: 'in_progress',
        description: 'Ticket is being worked on',
        default: currentStatus === 'in_progress'
      },
      {
        label: '🔵 Waiting for Response',
        value: 'waiting_response',
        description: 'Waiting for user or staff response',
        default: currentStatus === 'waiting_response'
      },
      {
        label: '✅ Resolved',
        value: 'resolved',
        description: 'Ticket has been resolved',
        default: currentStatus === 'resolved'
      },
      {
        label: '🔒 Closed',
        value: 'closed',
        description: 'Ticket has been closed',
        default: currentStatus === 'closed'
      }
    ]);

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create escalation level selection menu
 * @param {string} threadId - Thread ID
 * @param {number} currentLevel - Current escalation level
 * @returns {ActionRowBuilder} Action row with escalation select menu
 */
export function createEscalationSelectMenu(threadId, currentLevel = 1) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CUSTOM_IDS.escalationSelectPrefix}:${threadId}`)
    .setPlaceholder('Select escalation level...')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions([
      {
        label: 'Level 1 - Standard Support',
        value: '1',
        description: 'Standard support level',
        default: currentLevel === 1
      },
      {
        label: 'Level 2 - Senior Support',
        value: '2',
        description: 'Senior support staff',
        default: currentLevel === 2
      },
      {
        label: 'Level 3 - Management',
        value: '3',
        description: 'Management level escalation',
        default: currentLevel === 3
      }
    ]);

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create bulk action selection menu
 * @param {Array} threadIds - Array of thread IDs
 * @returns {ActionRowBuilder} Action row with bulk action select menu
 */
export function createBulkActionSelectMenu(threadIds = []) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CUSTOM_IDS.bulkActionSelect}:${threadIds.join(',')}`)
    .setPlaceholder('Select bulk action...')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions([
      {
        label: '✅ Resolve All',
        value: 'resolve',
        description: 'Mark all selected tickets as resolved'
      },
      {
        label: '🔒 Close All',
        value: 'close',
        description: 'Close all selected tickets'
      },
      {
        label: '📋 Assign to Staff',
        value: 'assign',
        description: 'Assign all selected tickets to a staff member'
      },
      {
        label: '⬆️ Escalate All',
        value: 'escalate',
        description: 'Escalate all selected tickets'
      },
      {
        label: '🏷️ Change Category',
        value: 'category',
        description: 'Change category for all selected tickets'
      },
      {
        label: '🔥 Set Priority',
        value: 'priority',
        description: 'Set priority for all selected tickets'
      }
    ]);

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create template selection menu
 * @param {string} threadId - Thread ID
 * @param {Array} templates - Array of response templates
 * @returns {ActionRowBuilder} Action row with template select menu
 */
export function createTemplateSelectMenu(threadId, templates = []) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CUSTOM_IDS.templateSelectPrefix}:${threadId}`)
    .setPlaceholder('Select response template...')
    .setMinValues(1)
    .setMaxValues(1);

  // Add template options
  for (const template of templates) {
    selectMenu.addOptions({
      label: template.name,
      value: template.id,
      description: template.description || '',
      emoji: template.emoji
    });
  }

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create role selection menu for permissions
 * @param {string} threadId - Thread ID
 * @param {Array} availableRoles - Array of available role IDs
 * @returns {ActionRowBuilder} Action row with role select menu
 */
export function createRoleSelectMenu(threadId, availableRoles = []) {
  const selectMenu = new RoleSelectMenuBuilder()
    .setCustomId(`${CUSTOM_IDS.roleSelectPrefix}:${threadId}`)
    .setPlaceholder('Select roles to manage permissions...')
    .setMinValues(0)
    .setMaxValues(10);

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create channel selection menu for ticket redirects
 * @param {string} threadId - Thread ID
 * @param {Array} availableChannels - Array of available channel IDs
 * @returns {ActionRowBuilder} Action row with channel select menu
 */
export function createChannelSelectMenu(threadId, availableChannels = []) {
  const selectMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`${CUSTOM_IDS.channelSelectPrefix}:${threadId}`)
    .setPlaceholder('Select channel for redirect...')
    .setMinValues(0)
    .setMaxValues(1);

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create multi-select menu with custom options
 * @param {Object} config - Configuration object
 * @param {string} config.customId - Custom ID for the select menu
 * @param {string} config.placeholder - Placeholder text
 * @param {Array} config.options - Array of option objects
 * @param {number} config.minValues - Minimum values required
 * @param {number} config.maxValues - Maximum values allowed
 * @returns {ActionRowBuilder} Action row with select menu
 */
export function createCustomStringSelectMenu(config) {
  const {
    customId,
    placeholder = 'Select options...',
    options = [],
    minValues = 1,
    maxValues = 1
  } = config;

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(minValues)
    .setMaxValues(maxValues);

  // Add options
  for (const option of options) {
    selectMenu.addOptions({
      label: option.label,
      value: option.value,
      description: option.description || '',
      emoji: option.emoji,
      default: option.default || false
    });
  }

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create mentionable select menu (users and roles)
 * @param {string} threadId - Thread ID
 * @param {string} placeholder - Placeholder text
 * @returns {ActionRowBuilder} Action row with mentionable select menu
 */
export function createMentionableSelectMenu(threadId, placeholder = 'Select users or roles...') {
  const selectMenu = new MentionableSelectMenuBuilder()
    .setCustomId(`${CUSTOM_IDS.mentionableSelectPrefix}:${threadId}`)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(10);

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create filter selection menu for ticket views
 * @param {Array} availableFilters - Array of available filters
 * @returns {ActionRowBuilder} Action row with filter select menu
 */
export function createFilterSelectMenu(availableFilters = []) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_IDS.filterSelect)
    .setPlaceholder('Select filters to apply...')
    .setMinValues(0)
    .setMaxValues(5)
    .addOptions([
      {
        label: '🟢 Open Tickets',
        value: 'status:open',
        description: 'Show only open tickets'
      },
      {
        label: '✅ Resolved Tickets',
        value: 'status:resolved',
        description: 'Show only resolved tickets'
      },
      {
        label: '🔒 Closed Tickets',
        value: 'status:closed',
        description: 'Show only closed tickets'
      },
      {
        label: '🔥 High Priority',
        value: 'priority:high',
        description: 'Show high priority tickets'
      },
      {
        label: '⬆️ Escalated',
        value: 'escalated:true',
        description: 'Show escalated tickets'
      },
      {
        label: '📋 Unassigned',
        value: 'assigned:false',
        description: 'Show unassigned tickets'
      },
      {
        label: '👤 My Tickets',
        value: 'assigned:me',
        description: 'Show tickets assigned to me'
      }
    ]);

  return new ActionRowBuilder().addComponents(selectMenu);
}
