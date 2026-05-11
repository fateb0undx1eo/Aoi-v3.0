import { ButtonStyle, ActionRowBuilder } from 'discord.js';
import { CUSTOM_IDS } from '../utils/constants.js';

/**
 * Enterprise-grade button component utilities for ticket system
 * Provides standardized button creation with proper styling and IDs
 */

/**
 * Create ticket tag selection buttons
 * @param {Array} tags - Array of ticket tag configurations
 * @returns {Array} Array of ActionRow builders with buttons
 */
export function createTicketTagButtons(tags) {
  const rows = [];
  
  // Create rows with 5 buttons max per row
  for (let i = 0; i < tags.length; i += 5) {
    const row = new ActionRowBuilder();
    const rowTags = tags.slice(i, i + 5);
    
    for (const tag of rowTags) {
      row.addComponents(
        createButton({
          customId: `${CUSTOM_IDS.ticketTagPrefix}:${tag.value}`,
          label: tag.label,
          style: ButtonStyle.Secondary,
          emoji: tag.emoji
        })
      );
    }
    
    rows.push(row);
  }
  
  return rows;
}

/**
 * Create user management buttons for a ticket
 * @param {string} threadId - Thread ID
 * @param {string} creatorId - Ticket creator ID
 * @returns {ActionRowBuilder} Action row with user management buttons
 */
export function createUserManagementButtons(threadId, creatorId) {
  return new ActionRowBuilder().addComponents(
    createButton({
      customId: `${CUSTOM_IDS.addUsersPrefix}:${threadId}`,
      label: 'Add User',
      style: ButtonStyle.Primary,
      emoji: '➕'
    }),
    createButton({
      customId: `${CUSTOM_IDS.removeUsersPrefix}:${threadId}`,
      label: 'Remove User',
      style: ButtonStyle.Secondary,
      emoji: '➖'
    })
  );
}

/**
 * Create ticket resolution buttons
 * @param {string} creatorId - Ticket creator ID
 * @returns {ActionRowBuilder} Action row with resolution buttons
 */
export function createResolutionButtons(creatorId) {
  return new ActionRowBuilder().addComponents(
    createButton({
      customId: `${CUSTOM_IDS.resolvedPrefix}:${creatorId}`,
      label: 'Mark as Resolved',
      style: ButtonStyle.Danger,
      emoji: '✅'
    })
  );
}

/**
 * Create confirmation buttons for ticket resolution
 * @param {string} creatorId - Ticket creator ID
 * @returns {ActionRowBuilder} Action row with confirmation buttons
 */
export function createResolutionConfirmationButtons(creatorId) {
  return new ActionRowBuilder().addComponents(
    createButton({
      customId: `${CUSTOM_IDS.resolvedConfirmYes}:${creatorId}`,
      label: 'Yes, Resolve',
      style: ButtonStyle.Danger,
      emoji: '✅'
    }),
    createButton({
      customId: `${CUSTOM_IDS.resolvedConfirmNo}:${creatorId}`,
      label: 'Cancel',
      style: ButtonStyle.Secondary,
      emoji: '❌'
    })
  );
}

/**
 * Create disabled resolution button (for resolved tickets)
 * @param {string} creatorId - Ticket creator ID
 * @returns {ActionRowBuilder} Action row with disabled button
 */
export function createDisabledResolutionButton(creatorId) {
  return new ActionRowBuilder().addComponents(
    createButton({
      customId: `${CUSTOM_IDS.resolvedPrefix}:${creatorId}`,
      label: 'RESOLVED (Already Resolved)',
      style: ButtonStyle.Secondary,
      emoji: '✅',
      disabled: true
    })
  );
}

/**
 * Create control buttons for ticket management
 * @param {string} threadId - Thread ID
 * @param {string} creatorId - Ticket creator ID
 * @param {boolean} isResolved - Whether ticket is resolved
 * @returns {Array} Array of ActionRow builders with control buttons
 */
export function createTicketControlButtons(threadId, creatorId, isResolved = false) {
  const rows = [];
  
  // User management row
  rows.push(createUserManagementButtons(threadId, creatorId));
  
  // Resolution row
  if (isResolved) {
    rows.push(createDisabledResolutionButton(creatorId));
  } else {
    rows.push(createResolutionButtons(creatorId));
  }
  
  return rows;
}

/**
 * Create a standardized button
 * @param {Object} options - Button options
 * @param {string} options.customId - Button custom ID
 * @param {string} options.label - Button label
 * @param {ButtonStyle} options.style - Button style
 * @param {string} [options.emoji] - Button emoji
 * @param {boolean} [options.disabled] - Whether button is disabled
 * @param {string} [options.url] - Button URL (for link buttons)
 * @returns {ButtonBuilder} Button builder instance
 */
function createButton(options) {
  const { ButtonBuilder } = require('discord.js');
  const button = new ButtonBuilder();
  
  // Set required properties
  button.setCustomId(options.customId);
  button.setLabel(options.label);
  button.setStyle(options.style);
  
  // Set optional properties
  if (options.emoji) {
    button.setEmoji(options.emoji);
  }
  
  if (options.disabled) {
    button.setDisabled(true);
  }
  
  if (options.url) {
    button.setURL(options.url);
  }
  
  return button;
}

/**
 * Create navigation buttons for multi-step processes
 * @param {string} stepId - Step identifier
 * @param {boolean} canGoBack - Whether back button should be enabled
 * @param {boolean} canGoForward - Whether forward button should be enabled
 * @param {boolean} canFinish - Whether finish button should be enabled
 * @returns {ActionRowBuilder} Action row with navigation buttons
 */
export function createNavigationButtons(stepId, canGoBack = true, canGoForward = true, canFinish = false) {
  const row = new ActionRowBuilder();
  
  if (canGoBack) {
    row.addComponents(
      createButton({
        customId: `${CUSTOM_IDS.navBackPrefix}:${stepId}`,
        label: 'Back',
        style: ButtonStyle.Secondary,
        emoji: '⬅️'
      })
    );
  }
  
  if (canFinish) {
    row.addComponents(
      createButton({
        customId: `${CUSTOM_IDS.navFinishPrefix}:${stepId}`,
        label: 'Finish',
        style: ButtonStyle.Success,
        emoji: '✅'
      })
    );
  } else if (canGoForward) {
    row.addComponents(
      createButton({
        customId: `${CUSTOM_IDS.navNextPrefix}:${stepId}`,
        label: 'Next',
        style: ButtonStyle.Primary,
        emoji: '➡️'
      })
    );
  }
  
  // Always add cancel button
  row.addComponents(
    createButton({
      customId: `${CUSTOM_IDS.navCancelPrefix}:${stepId}`,
      label: 'Cancel',
      style: ButtonStyle.Danger,
      emoji: '❌'
    })
  );
  
  return row;
}

/**
 * Create action buttons for ticket operations
 * @param {string} threadId - Thread ID
 * @param {Object} options - Button options
 * @param {boolean} [options.allowAdd] - Allow adding users
 * @param {boolean} [options.allowRemove] - Allow removing users
 * @param {boolean} [options.allowResolve] - Allow resolving ticket
 * @param {boolean} [options.allowClose] - Allow closing ticket
 * @returns {Array} Array of ActionRow builders with action buttons
 */
export function createActionButtons(threadId, options = {}) {
  const {
    allowAdd = true,
    allowRemove = true,
    allowResolve = true,
    allowClose = false
  } = options;
  
  const rows = [];
  const firstRow = new ActionRowBuilder();
  
  // Add user management buttons
  if (allowAdd) {
    firstRow.addComponents(
      createButton({
        customId: `${CUSTOM_IDS.addUsersPrefix}:${threadId}`,
        label: 'Add User',
        style: ButtonStyle.Primary,
        emoji: '➕'
      })
    );
  }
  
  if (allowRemove) {
    firstRow.addComponents(
      createButton({
        customId: `${CUSTOM_IDS.removeUsersPrefix}:${threadId}`,
        label: 'Remove User',
        style: ButtonStyle.Secondary,
        emoji: '➖'
      })
    );
  }
  
  rows.push(firstRow);
  
  // Add resolution/close buttons
  if (allowResolve || allowClose) {
    const secondRow = new ActionRowBuilder();
    
    if (allowResolve) {
      secondRow.addComponents(
        createButton({
          customId: `${CUSTOM_IDS.resolvedPrefix}:${threadId}`,
          label: 'Mark as Resolved',
          style: ButtonStyle.Danger,
          emoji: '✅'
        })
      );
    }
    
    if (allowClose) {
      secondRow.addComponents(
        createButton({
          customId: `${CUSTOM_IDS.closeTicketPrefix}:${threadId}`,
          label: 'Close Ticket',
          style: ButtonStyle.Danger,
          emoji: '🔒'
        })
      );
    }
    
    rows.push(secondRow);
  }
  
  return rows;
}

/**
 * Create status indicator buttons (read-only)
 * @param {string} status - Ticket status
 * @param {string} threadId - Thread ID
 * @returns {ActionRowBuilder} Action row with status buttons
 */
export function createStatusButtons(status, threadId) {
  const row = new ActionRowBuilder();
  
  switch (status) {
    case 'open':
      row.addComponents(
        createButton({
          customId: `status_open:${threadId}`,
          label: '🟢 Open',
          style: ButtonStyle.Success,
          disabled: true
        })
      );
      break;
    case 'resolved':
      row.addComponents(
        createButton({
          customId: `status_resolved:${threadId}`,
          label: '✅ Resolved',
          style: ButtonStyle.Success,
          disabled: true
        })
      );
      break;
    case 'closed':
      row.addComponents(
        createButton({
          customId: `status_closed:${threadId}`,
          label: '🔒 Closed',
          style: ButtonStyle.Secondary,
          disabled: true
        })
      );
      break;
    default:
      row.addComponents(
        createButton({
          customId: `status_unknown:${threadId}`,
          label: '❓ Unknown',
          style: ButtonStyle.Secondary,
          disabled: true
        })
      );
  }
  
  return row;
}

// Export button creation utilities for external use
export { createButton };
