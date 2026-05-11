import { VALIDATION } from './constants.js';

/**
 * Enterprise-grade validation utilities for ticket system
 * Provides comprehensive input validation and sanitization
 */

export class Validators {
  /**
   * Validate Discord user ID
   * @param {string} userId - User ID to validate
   * @returns {boolean} True if valid
   */
  static isValidUserId(userId) {
    return VALIDATION.USER_ID_REGEX.test(userId);
  }

  /**
   * Validate Discord thread ID
   * @param {string} threadId - Thread ID to validate
   * @returns {boolean} True if valid
   */
  static isValidThreadId(threadId) {
    return VALIDATION.THREAD_ID_REGEX.test(threadId);
  }

  /**
   * Validate Discord guild ID
   * @param {string} guildId - Guild ID to validate
   * @returns {boolean} True if valid
   */
  static isValidGuildId(guildId) {
    return VALIDATION.GUILD_ID_REGEX.test(guildId);
  }

  /**
   * Validate thread name
   * @param {string} name - Thread name to validate
   * @returns {Object} Validation result
   */
  static validateThreadName(name) {
    const result = {
      isValid: true,
      errors: []
    };

    if (!name || typeof name !== 'string') {
      result.isValid = false;
      result.errors.push('Thread name must be a non-empty string');
      return result;
    }

    if (name.length > VALIDATION.MAX_THREAD_NAME_LENGTH) {
      result.isValid = false;
      result.errors.push(`Thread name cannot exceed ${VALIDATION.MAX_THREAD_NAME_LENGTH} characters`);
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1F\x7F]/;
    if (invalidChars.test(name)) {
      result.isValid = false;
      result.errors.push('Thread name contains invalid characters');
    }

    // Check for control characters
    if (/[\x00-\x1F\x7F]/.test(name)) {
      result.isValid = false;
      result.errors.push('Thread name contains control characters');
    }

    return result;
  }

  /**
   * Validate modal input
   * @param {string} input - Modal input to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validateModalInput(input, options = {}) {
    const {
      maxLength = VALIDATION.MAX_MODAL_INPUT_LENGTH,
      required = false,
      allowEmpty = false
    } = options;

    const result = {
      isValid: true,
      errors: [],
      sanitized: input
    };

    // Check if required
    if (required && (!input || input.trim().length === 0)) {
      result.isValid = false;
      result.errors.push('This field is required');
      return result;
    }

    // Allow empty if permitted
    if (!required && allowEmpty && (!input || input.trim().length === 0)) {
      return result;
    }

    // Type check
    if (typeof input !== 'string') {
      result.isValid = false;
      result.errors.push('Input must be a string');
      return result;
    }

    // Length check
    if (input.length > maxLength) {
      result.isValid = false;
      result.errors.push(`Input cannot exceed ${maxLength} characters`);
      return result;
    }

    // Sanitize input
    result.sanitized = this.sanitizeInput(input);

    return result;
  }

  /**
   * Validate ticket tag
   * @param {string} tag - Ticket tag to validate
   * @returns {Object} Validation result
   */
  static validateTicketTag(tag) {
    const result = {
      isValid: true,
      errors: []
    };

    if (!tag || typeof tag !== 'string') {
      result.isValid = false;
      result.errors.push('Ticket tag must be a non-empty string');
      return result;
    }

    // Check against allowed tags
    const allowedTags = ['general_support', 'report_user', 'partnership_requests', 'booster_perk_claims'];
    if (!allowedTags.includes(tag)) {
      result.isValid = false;
      result.errors.push('Invalid ticket tag');
      return result;
    }

    return result;
  }

  /**
   * Validate user list for user management
   * @param {Array} userIds - Array of user IDs
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validateUserList(userIds, options = {}) {
    const { maxUsers = 10, minUsers = 0 } = options;
    const result = {
      isValid: true,
      errors: [],
      validIds: [],
      invalidIds: []
    };

    if (!Array.isArray(userIds)) {
      result.isValid = false;
      result.errors.push('User list must be an array');
      return result;
    }

    // Check array length
    if (userIds.length < minUsers) {
      result.isValid = false;
      result.errors.push(`Must select at least ${minUsers} users`);
    }

    if (userIds.length > maxUsers) {
      result.isValid = false;
      result.errors.push(`Cannot select more than ${maxUsers} users`);
    }

    // Validate each user ID
    for (const userId of userIds) {
      if (this.isValidUserId(userId)) {
        result.validIds.push(userId);
      } else {
        result.invalidIds.push(userId);
      }
    }

    if (result.invalidIds.length > 0) {
      result.isValid = false;
      result.errors.push(`Invalid user IDs: ${result.invalidIds.join(', ')}`);
    }

    return result;
  }

  /**
   * Validate Discord interaction
   * @param {Object} interaction - Discord interaction
   * @returns {Object} Validation result
   */
  static validateInteraction(interaction) {
    const result = {
      isValid: true,
      errors: []
    };

    if (!interaction) {
      result.isValid = false;
      result.errors.push('Interaction is required');
      return result;
    }

    // Check required properties
    const requiredProps = ['id', 'user', 'guildId'];
    for (const prop of requiredProps) {
      if (!interaction[prop]) {
        result.isValid = false;
        result.errors.push(`Missing required property: ${prop}`);
      }
    }

    // Validate user ID
    if (interaction.user && !this.isValidUserId(interaction.user.id)) {
      result.isValid = false;
      result.errors.push('Invalid user ID in interaction');
    }

    // Validate guild ID
    if (interaction.guildId && !this.isValidGuildId(interaction.guildId)) {
      result.isValid = false;
      result.errors.push('Invalid guild ID in interaction');
    }

    return result;
  }

  /**
   * Validate thread state
   * @param {Object} thread - Discord thread
   * @returns {Object} Validation result
   */
  static validateThreadState(thread) {
    const result = {
      isValid: true,
      errors: []
    };

    if (!thread) {
      result.isValid = false;
      result.errors.push('Thread is required');
      return result;
    }

    // Check if it's actually a thread
    if (!thread.isThread?.()) {
      result.isValid = false;
      result.errors.push('Provided channel is not a thread');
      return result;
    }

    // Check thread ID
    if (!this.isValidThreadId(thread.id)) {
      result.isValid = false;
      result.errors.push('Invalid thread ID');
    }

    // Check guild ID
    if (!this.isValidGuildId(thread.guildId)) {
      result.isValid = false;
      result.errors.push('Invalid guild ID in thread');
    }

    // Check if thread is archived
    if (thread.archived) {
      result.isValid = false;
      result.errors.push('Cannot operate on archived thread');
    }

    // Check if thread is locked
    if (thread.locked) {
      result.isValid = false;
      result.errors.push('Cannot operate on locked thread');
    }

    return result;
  }

  /**
   * Sanitize input string
   * @param {string} input - Input to sanitize
   * @returns {string} Sanitized input
   */
  static sanitizeInput(input) {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .trim()
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
      .substring(0, VALIDATION.MAX_MODAL_INPUT_LENGTH);
  }

  /**
   * Validate permission check
   * @param {Object} member - Discord guild member
   * @param {Array} requiredRoles - Array of required role IDs
   * @returns {Object} Validation result
   */
  static validatePermissions(member, requiredRoles) {
    const result = {
      isValid: false,
      errors: [],
      hasPermission: false
    };

    if (!member) {
      result.errors.push('Member object is required');
      return result;
    }

    if (!Array.isArray(requiredRoles) || requiredRoles.length === 0) {
      result.errors.push('Required roles must be a non-empty array');
      return result;
    }

    // Check if member has any required role
    result.hasPermission = requiredRoles.some(roleId => member.roles?.cache?.has(roleId));
    result.isValid = result.hasPermission;

    if (!result.hasPermission) {
      result.errors.push('Insufficient permissions');
    }

    return result;
  }

  /**
   * Validate cooldown parameters
   * @param {Object} params - Cooldown parameters
   * @returns {Object} Validation result
   */
  static validateCooldownParams(params) {
    const result = {
      isValid: true,
      errors: []
    };

    const { guildId, userId, durationMs, reason } = params;

    // Validate guild ID
    if (!this.isValidGuildId(guildId)) {
      result.isValid = false;
      result.errors.push('Invalid guild ID');
    }

    // Validate user ID
    if (!this.isValidUserId(userId)) {
      result.isValid = false;
      result.errors.push('Invalid user ID');
    }

    // Validate duration
    if (typeof durationMs !== 'number' || durationMs < 0) {
      result.isValid = false;
      result.errors.push('Duration must be a positive number');
    }

    // Validate reason
    if (reason && (typeof reason !== 'string' || reason.length > 50)) {
      result.isValid = false;
      result.errors.push('Reason must be a string under 50 characters');
    }

    return result;
  }

  /**
   * Validate webhook configuration
   * @param {Object} webhook - Webhook object
   * @returns {Object} Validation result
   */
  static validateWebhook(webhook) {
    const result = {
      isValid: true,
      errors: []
    };

    if (!webhook) {
      result.isValid = false;
      result.errors.push('Webhook object is required');
      return result;
    }

    // Check required properties
    const requiredProps = ['id', 'token', 'guildId', 'channelId'];
    for (const prop of requiredProps) {
      if (!webhook[prop]) {
        result.isValid = false;
        result.errors.push(`Missing required webhook property: ${prop}`);
      }
    }

    return result;
  }

  /**
   * Validate database record
   * @param {Object} record - Database record
   * @param {Array} requiredFields - Array of required field names
   * @returns {Object} Validation result
   */
  static validateDatabaseRecord(record, requiredFields) {
    const result = {
      isValid: true,
      errors: []
    };

    if (!record || typeof record !== 'object') {
      result.isValid = false;
      result.errors.push('Record must be an object');
      return result;
    }

    for (const field of requiredFields) {
      if (!record[field]) {
        result.isValid = false;
        result.errors.push(`Missing required field: ${field}`);
      }
    }

    return result;
  }

  /**
   * Create validation middleware
   * @param {Function} validator - Validation function
   * @param {Function} handler - Handler function
   * @returns {Function} Middleware function
   */
  static createValidationMiddleware(validator, handler) {
    return async (...args) => {
      const validation = validator(...args);
      
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      return await handler(...args);
    };
  }
}

// Export validation functions for convenience
export const {
  isValidUserId,
  isValidThreadId,
  isValidGuildId,
  validateThreadName,
  validateModalInput,
  validateTicketTag,
  validateUserList,
  validateInteraction,
  validateThreadState,
  sanitizeInput,
  validatePermissions,
  validateCooldownParams,
  validateWebhook,
  validateDatabaseRecord,
  createValidationMiddleware
} = Validators;
