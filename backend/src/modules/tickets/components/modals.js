import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { CUSTOM_IDS, VALIDATION } from '../utils/constants.js';

/**
 * Enterprise-grade modal component utilities for ticket system
 * Provides standardized modal creation with proper validation and styling
 */

/**
 * Create add users modal
 * @param {string} threadId - Thread ID
 * @returns {ModalBuilder} Modal builder instance
 */
export function createAddUsersModal(threadId) {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_IDS.addUsersModalPrefix}:${threadId}`)
    .setTitle('Add User to Ticket')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CUSTOM_IDS.addUserSelect)
          .setLabel('User IDs (comma-separated)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Enter Discord user IDs separated by commas...\nExample: 123456789012345678, 987654321098765432')
          .setRequired(true)
          .setMaxLength(VALIDATION.MAX_MODAL_INPUT_LENGTH)
      )
    );
}

/**
 * Create remove users modal
 * @param {string} threadId - Thread ID
 * @returns {ModalBuilder} Modal builder instance
 */
export function createRemoveUsersModal(threadId) {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_IDS.removeUsersModalPrefix}:${threadId}`)
    .setTitle('Remove User from Ticket')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CUSTOM_IDS.removeUserSelect)
          .setLabel('User IDs (comma-separated)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Enter Discord user IDs separated by commas...\nExample: 123456789012345678, 987654321098765432')
          .setRequired(true)
          .setMaxLength(VALIDATION.MAX_MODAL_INPUT_LENGTH)
      )
    );
}

/**
 * Create ticket resolution modal
 * @param {string} threadId - Thread ID
 * @returns {ModalBuilder} Modal builder instance
 */
export function createTicketResolutionModal(threadId) {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_IDS.resolvedConfirm}:${threadId}`)
    .setTitle('Resolve Ticket')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Resolution reason (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Enter the reason for resolving this ticket...')
          .setRequired(false)
          .setMaxLength(1000)
      )
    );
}

/**
 * Create ticket creation modal (for additional information)
 * @param {string} tag - Selected ticket tag
 * @returns {ModalBuilder} Modal builder instance
 */
export function createTicketCreationModal(tag) {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_IDS.ticketCreatePrefix}:${tag}`)
    .setTitle(`Create ${tag} Ticket`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Ticket Description')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Please describe your issue in detail...')
          .setRequired(true)
          .setMaxLength(2000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('additional_info')
          .setLabel('Additional Information (optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Any additional context or links...')
          .setRequired(false)
          .setMaxLength(500)
      )
    );
}

/**
 * Create ticket edit modal
 * @param {string} threadId - Thread ID
 * @param {Object} currentData - Current ticket data
 * @returns {ModalBuilder} Modal builder instance
 */
export function createTicketEditModal(threadId, currentData = {}) {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_IDS.ticketEditPrefix}:${threadId}`)
    .setTitle('Edit Ticket')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tag')
          .setLabel('Ticket Tag')
          .setStyle(TextInputStyle.Short)
          .setValue(currentData.tag || '')
          .setPlaceholder('Ticket tag (e.g., general_support)')
          .setRequired(false)
          .setMaxLength(50)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('priority')
          .setLabel('Priority')
          .setStyle(TextInputStyle.Short)
          .setValue(currentData.priority || 'normal')
          .setPlaceholder('Priority level (low, normal, high, urgent)')
          .setRequired(false)
          .setMaxLength(20)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('notes')
          .setLabel('Staff Notes')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(currentData.notes || '')
          .setPlaceholder('Internal staff notes...')
          .setRequired(false)
          .setMaxLength(1000)
      )
    );
}

/**
 * Create ticket transfer modal
 * @param {string} threadId - Thread ID
 * @returns {ModalBuilder} Modal builder instance
 */
export function createTicketTransferModal(threadId) {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_IDS.ticketTransferPrefix}:${threadId}`)
    .setTitle('Transfer Ticket')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('target_staff_id')
          .setLabel('Target Staff User ID')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Enter Discord user ID of target staff member')
          .setRequired(true)
          .setMaxLength(20)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('transfer_reason')
          .setLabel('Transfer Reason')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Reason for transferring this ticket...')
          .setRequired(true)
          .setMaxLength(500)
      )
    );
}

/**
 * Create ticket escalation modal
 * @param {string} threadId - Thread ID
 * @returns {ModalBuilder} Modal builder instance
 */
export function createTicketEscalationModal(threadId) {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_IDS.ticketEscalatePrefix}:${threadId}`)
    .setTitle('Escalate Ticket')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('escalation_reason')
          .setLabel('Escalation Reason')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Reason for escalating this ticket...')
          .setRequired(true)
          .setMaxLength(1000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('escalation_level')
          .setLabel('Escalation Level')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Level (1, 2, or 3)')
          .setRequired(true)
          .setMaxLength(5)
      )
    );
}

/**
 * Create ticket note modal
 * @param {string} threadId - Thread ID
 * @returns {ModalBuilder} Modal builder instance
 */
export function createTicketNoteModal(threadId) {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_IDS.ticketNotePrefix}:${threadId}`)
    .setTitle('Add Staff Note')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('note_content')
          .setLabel('Note Content')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Enter your staff note...')
          .setRequired(true)
          .setMaxLength(2000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('note_type')
          .setLabel('Note Type')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('internal, external, follow_up, etc.')
          .setRequired(false)
          .setMaxLength(50)
      )
    );
}

/**
 * Create bulk action modal
 * @param {string} action - Action type
 * @param {Array} threadIds - Array of thread IDs
 * @returns {ModalBuilder} Modal builder instance
 */
export function createBulkActionModal(action, threadIds) {
  const actionLabels = {
    'resolve': 'Bulk Resolve Tickets',
    'close': 'Bulk Close Tickets',
    'assign': 'Bulk Assign Tickets',
    'escalate': 'Bulk Escalate Tickets'
  };

  return new ModalBuilder()
    .setCustomId(`${CUSTOM_IDS.bulkActionPrefix}:${action}:${threadIds.join(',')}`)
    .setTitle(actionLabels[action] || 'Bulk Action')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Action Reason')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder(`Reason for ${action} action...`)
          .setRequired(true)
          .setMaxLength(1000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('additional_notes')
          .setLabel('Additional Notes (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Any additional context...')
          .setRequired(false)
          .setMaxLength(1000)
      )
    );
}

/**
 * Create custom modal with flexible configuration
 * @param {Object} config - Modal configuration
 * @param {string} config.customId - Modal custom ID
 * @param {string} config.title - Modal title
 * @param {Array} config.fields - Array of field configurations
 * @returns {ModalBuilder} Modal builder instance
 */
export function createCustomModal(config) {
  const { customId, title, fields } = config;
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title);

  // Add fields as action rows
  for (const field of fields) {
    const textInput = new TextInputBuilder()
      .setCustomId(field.customId)
      .setLabel(field.label)
      .setStyle(field.style || TextInputStyle.Short)
      .setPlaceholder(field.placeholder || '')
      .setRequired(field.required || false)
      .setMaxLength(field.maxLength || 1000)
      .setValue(field.value || '');

    if (field.minLength) {
      textInput.setMinLength(field.minLength);
    }

    modal.addComponents(
      new ActionRowBuilder().addComponents(textInput)
    );
  }

  return modal;
}

/**
 * Create feedback modal
 * @param {string} threadId - Thread ID
 * @param {string} feedbackType - Type of feedback (ticket_resolution, service_quality, etc.)
 * @returns {ModalBuilder} Modal builder instance
 */
export function createFeedbackModal(threadId, feedbackType = 'ticket_resolution') {
  const titles = {
    'ticket_resolution': 'Ticket Resolution Feedback',
    'service_quality': 'Service Quality Feedback',
    'general': 'General Feedback'
  };

  return new ModalBuilder()
    .setCustomId(`${CUSTOM_IDS.feedbackPrefix}:${feedbackType}:${threadId}`)
    .setTitle(titles[feedbackType] || 'Feedback')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('rating')
          .setLabel('Rating (1-5)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Rate your experience from 1 (poor) to 5 (excellent)')
          .setRequired(true)
          .setMaxLength(5)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('feedback')
          .setLabel('Your Feedback')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Please share your thoughts and suggestions...')
          .setRequired(true)
          .setMaxLength(2000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('contact_info')
          .setLabel('Contact Info (optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Email or Discord tag if you want us to follow up')
          .setRequired(false)
          .setMaxLength(100)
      )
    );
}
