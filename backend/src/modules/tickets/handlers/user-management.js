import { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } from 'discord.js';
import { ticketRepository } from '../repositories/ticket-repository.js';
import { loggingService } from '../services/logging-service.js';
import { metricsService } from '../services/metrics-service.js';
import { webhookService } from '../services/webhook-service.js';
import { errorHandler } from '../utils/error-handler.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES, LOG_COLORS, TICKET_LOG_CHANNEL_ID, CUSTOM_IDS } from '../utils/constants.js';
import { buildThreadLink, canManageUsers } from '../utils/thread-utils.js';
import { isTicketStaffFromInteraction, canRemoveUser } from '../utils/permissions.js';
import { buildAddUsersModalCustomId, buildRemoveUsersModalCustomId } from '../utils/custom-id-utils.js';
import { validateInteraction, validateThreadState, validateUserList } from '../utils/validators.js';

export async function handleAddUsersButton(interaction, threadId) {
  const context = await loggingService.logInteractionStart(interaction, 'add_users_button');
  const timer = metricsService.createTimer();

  try {
    const validation = validateInteraction(interaction);
    if (!validation.isValid) throw new Error(`Invalid interaction: ${validation.errors.join(', ')}`);

    const threadValidation = validateThreadState(interaction.channel);
    if (!threadValidation.isValid) {
      await interaction.reply({ content: ERROR_MESSAGES.NOT_TICKET_THREAD, ephemeral: true });
      return;
    }

    if (!isTicketStaffFromInteraction(interaction)) {
      await interaction.reply({ content: ERROR_MESSAGES.NOT_TICKET_STAFF, ephemeral: true });
      return;
    }

    if (interaction.channelId !== threadId) {
      await interaction.reply({ content: ERROR_MESSAGES.WRONG_THREAD, ephemeral: true });
      return;
    }

    if (!canManageUsers(interaction.channel)) {
      await interaction.reply({ content: ERROR_MESSAGES.CLOSED_TICKET_OPERATIONS, ephemeral: true });
      return;
    }

    const ticket = await ticketRepository.findByThreadId(threadId);
    if (!ticket || ticket.status !== 'open') {
      await interaction.reply({ content: ERROR_MESSAGES.INVALID_TICKET_STATE, ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(buildAddUsersModalCustomId(threadId))
      .setTitle('Add User to Ticket')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(CUSTOM_IDS.addUserSelect)
            .setLabel('User IDs (comma-separated)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter Discord user IDs separated by commas...')
            .setRequired(true)
            .setMaxLength(1000)
        )
      );

    await interaction.showModal(modal);

    const duration = timer.stop();
    await metricsService.recordUserManagement('add_users', duration, true, { guildId: interaction.guildId, threadId: threadId, staffId: interaction.user.id });
    await loggingService.logInteractionComplete(context, 'add_users_button', { success: true, duration });

  } catch (error) {
    const duration = timer.stop();
    await metricsService.recordUserManagement('add_users', duration, false, { guildId: interaction.guildId, threadId: threadId, staffId: interaction.user.id, error: error.message });
    await errorHandler.handleInteractionError(context, error, 'add_users_button');
  }
}

export async function handleRemoveUsersButton(interaction, threadId) {
  const context = await loggingService.logInteractionStart(interaction, 'remove_users_button');
  const timer = metricsService.createTimer();

  try {
    const validation = validateInteraction(interaction);
    if (!validation.isValid) throw new Error(`Invalid interaction: ${validation.errors.join(', ')}`);

    const threadValidation = validateThreadState(interaction.channel);
    if (!threadValidation.isValid) {
      await interaction.reply({ content: ERROR_MESSAGES.NOT_TICKET_THREAD, ephemeral: true });
      return;
    }

    if (!isTicketStaffFromInteraction(interaction)) {
      await interaction.reply({ content: ERROR_MESSAGES.NOT_TICKET_STAFF, ephemeral: true });
      return;
    }

    if (interaction.channelId !== threadId) {
      await interaction.reply({ content: ERROR_MESSAGES.WRONG_THREAD, ephemeral: true });
      return;
    }

    if (!canManageUsers(interaction.channel)) {
      await interaction.reply({ content: ERROR_MESSAGES.CLOSED_TICKET_OPERATIONS, ephemeral: true });
      return;
    }

    const ticket = await ticketRepository.findByThreadId(threadId);
    if (!ticket || ticket.status !== 'open') {
      await interaction.reply({ content: ERROR_MESSAGES.INVALID_TICKET_STATE, ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(buildRemoveUsersModalCustomId(threadId))
      .setTitle('Remove User from Ticket')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(CUSTOM_IDS.removeUserSelect)
            .setLabel('User IDs (comma-separated)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter Discord user IDs separated by commas...')
            .setRequired(true)
            .setMaxLength(1000)
        )
      );

    await interaction.showModal(modal);

    const duration = timer.stop();
    await metricsService.recordUserManagement('remove_users', duration, true, { guildId: interaction.guildId, threadId: threadId, staffId: interaction.user.id });
    await loggingService.logInteractionComplete(context, 'remove_users_button', { success: true, duration });

  } catch (error) {
    const duration = timer.stop();
    await metricsService.recordUserManagement('remove_users', duration, false, { guildId: interaction.guildId, threadId: threadId, staffId: interaction.user.id, error: error.message });
    await errorHandler.handleInteractionError(context, error, 'remove_users_button');
  }
}

export async function handleAddUsersModalSubmit(interaction, threadId) {
  const context = await loggingService.logInteractionStart(interaction, 'add_users_modal');
  const timer = metricsService.createTimer();

  try {
    const validation = validateInteraction(interaction);
    if (!validation.isValid) throw new Error(`Invalid interaction: ${validation.errors.join(', ')}`);

    if (!isTicketStaffFromInteraction(interaction)) {
      await interaction.reply({ content: ERROR_MESSAGES.NOT_TICKET_STAFF, ephemeral: true });
      return;
    }

    const userInput = interaction.fields.getTextInputValue(CUSTOM_IDS.addUserSelect);
    const userIds = userInput.split(',').map(id => id.trim()).filter(id => id.length > 0);

    const userValidation = validateUserList(userIds, { maxUsers: 10 });
    if (!userValidation.isValid) {
      await interaction.reply({ content: `Invalid user IDs: ${userValidation.errors.join(', ')}`, ephemeral: true });
      return;
    }

    const ticket = await ticketRepository.findByThreadId(threadId);
    if (!ticket || ticket.status !== 'open') {
      await interaction.reply({ content: ERROR_MESSAGES.INVALID_TICKET_STATE, ephemeral: true });
      return;
    }

    const thread = await interaction.guild.channels.fetch(threadId);
    if (!thread?.isThread?.()) {
      await interaction.reply({ content: ERROR_MESSAGES.NOT_TICKET_THREAD, ephemeral: true });
      return;
    }

    const addedUsers = [];
    const failedUsers =[];

    for (const userId of userValidation.validIds) {
      try {
        await thread.members.add(userId);
        addedUsers.push(userId);
      } catch (error) {
        failedUsers.push(userId);
      }
    }

    let responseMessage = SUCCESS_MESSAGES.USERS_ADDED(addedUsers.length);
    if (failedUsers.length > 0) responseMessage += `\n\nFailed to add: ${failedUsers.join(', ')}`;

    await interaction.reply({ content: responseMessage, ephemeral: true });

    await sendUserManagementLog(thread, 'add_users', { staffId: interaction.user.id, targetUserIds: addedUsers, failedUserIds: failedUsers });

    const duration = timer.stop();
    await metricsService.recordUserManagement('add_users_modal', duration, true, { guildId: interaction.guildId, threadId: threadId, staffId: interaction.user.id, targetUserIds: addedUsers });
    await loggingService.logInteractionComplete(context, 'add_users_modal', { success: true, duration, addedUsers: addedUsers.length, failedUsers: failedUsers.length });

  } catch (error) {
    const duration = timer.stop();
    await metricsService.recordUserManagement('add_users_modal', duration, false, { guildId: interaction.guildId, threadId: threadId, staffId: interaction.user.id, error: error.message });
    await errorHandler.handleInteractionError(context, error, 'add_users_modal');
  }
}

export async function handleRemoveUsersModalSubmit(interaction, threadId) {
  const context = await loggingService.logInteractionStart(interaction, 'remove_users_modal');
  const timer = metricsService.createTimer();

  try {
    const validation = validateInteraction(interaction);
    if (!validation.isValid) throw new Error(`Invalid interaction: ${validation.errors.join(', ')}`);

    if (!isTicketStaffFromInteraction(interaction)) {
      await interaction.reply({ content: ERROR_MESSAGES.NOT_TICKET_STAFF, ephemeral: true });
      return;
    }

    const userInput = interaction.fields.getTextInputValue(CUSTOM_IDS.removeUserSelect);
    const userIds = userInput.split(',').map(id => id.trim()).filter(id => id.length > 0);

    const userValidation = validateUserList(userIds, { maxUsers: 10 });
    if (!userValidation.isValid) {
      await interaction.reply({ content: `Invalid user IDs: ${userValidation.errors.join(', ')}`, ephemeral: true });
      return;
    }

    const ticket = await ticketRepository.findByThreadId(threadId);
    if (!ticket || ticket.status !== 'open') {
      await interaction.reply({ content: ERROR_MESSAGES.INVALID_TICKET_STATE, ephemeral: true });
      return;
    }

    const thread = await interaction.guild.channels.fetch(threadId);
    if (!thread?.isThread?.()) {
      await interaction.reply({ content: ERROR_MESSAGES.NOT_TICKET_THREAD, ephemeral: true });
      return;
    }

    const removableUsers =[];
    const protectedUsers =[];

    for (const userId of userValidation.validIds) {
      if (canRemoveUser(userId, ticket.creator_id, interaction.user.id)) {
        removableUsers.push(userId);
      } else {
        protectedUsers.push(userId);
      }
    }

    const removedUsers = [];
    const failedUsers =[];

    for (const userId of removableUsers) {
      try {
        await thread.members.remove(userId);
        removedUsers.push(userId);
      } catch (error) {
        failedUsers.push(userId);
      }
    }

    let responseMessage = SUCCESS_MESSAGES.USERS_REMOVED(removedUsers.length);
    if (protectedUsers.length > 0) responseMessage += `\n\nCannot remove (protected): ${protectedUsers.join(', ')}`;
    if (failedUsers.length > 0) responseMessage += `\n\nFailed to remove: ${failedUsers.join(', ')}`;

    await interaction.reply({ content: responseMessage, ephemeral: true });

    await sendUserManagementLog(thread, 'remove_users', { staffId: interaction.user.id, targetUserIds: removedUsers, failedUserIds: failedUsers, protectedUserIds: protectedUsers });

    const duration = timer.stop();
    await metricsService.recordUserManagement('remove_users_modal', duration, true, { guildId: interaction.guildId, threadId: threadId, staffId: interaction.user.id, targetUserIds: removedUsers });
    await loggingService.logInteractionComplete(context, 'remove_users_modal', { success: true, duration, removedUsers: removedUsers.length, failedUsers: failedUsers.length, protectedUsers: protectedUsers.length });

  } catch (error) {
    const duration = timer.stop();
    await metricsService.recordUserManagement('remove_users_modal', duration, false, { guildId: interaction.guildId, threadId: threadId, staffId: interaction.user.id, error: error.message });
    await errorHandler.handleInteractionError(context, error, 'remove_users_modal');
  }
}

async function sendUserManagementLog(thread, operation, { staffId, targetUserIds, failedUserIds = [], protectedUserIds =[] }) {
  try {
    const { webhook } = await webhookService.getOrCreateLogWebhook(thread.guild, TICKET_LOG_CHANNEL_ID);
    if (!webhook) return;

    const threadLink = buildThreadLink(thread.guildId, thread.id);
    const now = Math.floor(Date.now() / 1000);

    const embed = {
      title: operation === 'add_users' ? 'Users Added' : 'Users Removed',
      color: operation === 'add_users' ? LOG_COLORS.USER_ADDED : LOG_COLORS.USER_REMOVED,
      description:[
        `**Staff Member:** <@${staffId}>`,
        `**At:** <t:${now}:F>`,
        `**Thread:** ${threadLink}`,
        targetUserIds.length > 0 ? `**Target Users:** ${targetUserIds.map(id => `<@${id}>`).join(', ')}` : '',
        failedUserIds.length > 0 ? `**Failed:** ${failedUserIds.map(id => `<@${id}>`).join(', ')}` : '',
        protectedUserIds.length > 0 ? `**Protected:** ${protectedUserIds.map(id => `<@${id}>`).join(', ')}` : ''
      ].filter(Boolean).join('\n')
    };

    await webhook.send({ embeds: [embed], allowedMentions: { parse:[] } });
  } catch (error) {
    await loggingService.warn({ operation: 'send_user_management_log', guildId: thread.guildId, threadId: thread.id, message: 'Failed to send user management log', metadata: { error: error.message } });
  }
}