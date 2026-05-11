import { ticketService } from '../services/ticket-service.js';
import { webhookService } from '../services/webhook-service.js';
import { 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  LOG_COLORS,
  COMPONENT_TYPES,
  TICKET_LOG_CHANNEL_ID
} from '../utils/constants.js';
import { 
  buildThreadLink,
  canManageUsers
} from '../utils/thread-utils.js';
import { 
  isTicketStaffFromInteraction,
  canRemoveUser
} from '../utils/permissions.js';
import {
  buildAddUsersModalCustomId,
  buildRemoveUsersModalCustomId,
  parseAddUsersModalThreadId,
  parseRemoveUsersModalThreadId,
  CUSTOM_IDS
} from '../utils/custom-id-utils.js';

/**
 * Handle add users button click
 */
export async function handleAddUsersButton(interaction, threadId) {
  // Validate interaction context
  if (!interaction.inGuild() || !interaction.channel?.isThread?.()) {
    await interaction.reply({
      content: ERROR_MESSAGES.NOT_TICKET_THREAD,
      ephemeral: true
    });
    return;
  }

  if (!isTicketStaffFromInteraction(interaction)) {
    await interaction.reply({
      content: ERROR_MESSAGES.NOT_TICKET_STAFF,
      ephemeral: true
    });
    return;
  }

  if (interaction.channelId !== threadId) {
    await interaction.reply({
      content: ERROR_MESSAGES.WRONG_THREAD,
      ephemeral: true
    });
    return;
  }

  // Check if thread is in a state that allows user management
  if (!canManageUsers(interaction.channel)) {
    await interaction.reply({
      content: ERROR_MESSAGES.CLOSED_TICKET_OPERATIONS,
      ephemeral: true
    });
    return;
  }

  // Show modal for user selection
  await interaction.showModal({
    custom_id: buildAddUsersModalCustomId(threadId),
    title: 'Add User',
    components: [
      {
        type: 18, // Modal
        label: 'Add User',
        description: 'Pick a user to add to this ticket',
        component: {
          type: 5, // User Select
          custom_id: CUSTOM_IDS.addUserSelect,
          placeholder: 'Select user to add',
          min_values: 1,
          max_values: 1,
          required: true
        }
      }
    ]
  });
}

/**
 * Handle remove users button click
 */
export async function handleRemoveUsersButton(interaction, threadId) {
  // Validate interaction context
  if (!interaction.inGuild() || !interaction.channel?.isThread?.()) {
    await interaction.reply({
      content: ERROR_MESSAGES.NOT_TICKET_THREAD,
      ephemeral: true
    });
    return;
  }

  if (!isTicketStaffFromInteraction(interaction)) {
    await interaction.reply({
      content: ERROR_MESSAGES.NOT_TICKET_STAFF,
      ephemeral: true
    });
    return;
  }

  if (interaction.channelId !== threadId) {
    await interaction.reply({
      content: ERROR_MESSAGES.WRONG_THREAD,
      ephemeral: true
    });
    return;
  }

  // Check if thread is in a state that allows user management
  if (!canManageUsers(interaction.channel)) {
    await interaction.reply({
      content: ERROR_MESSAGES.CLOSED_TICKET_OPERATIONS,
      ephemeral: true
    });
    return;
  }

  // Show modal for user selection
  await interaction.showModal({
    custom_id: buildRemoveUsersModalCustomId(threadId),
    title: 'Remove User',
    components: [
      {
        type: 18, // Modal
        label: 'Remove User',
        description: 'Pick a user to remove from this ticket',
        component: {
          type: 5, // User Select
          custom_id: CUSTOM_IDS.removeUserSelect,
          placeholder: 'Select user to remove',
          min_values: 1,
          max_values: 1,
          required: true
        }
      }
    ]
  });
}

/**
 * Handle add users modal submission
 */
export async function handleAddUsersModalSubmit(interaction, threadId) {
  if (!interaction.inGuild() || !interaction.channel?.isThread?.()) {
    return;
  }

  const thread = interaction.channel;

  if (!threadId) {
    await interaction.reply({
      content: ERROR_MESSAGES.INVALID_TICKET_STATE,
      ephemeral: true
    });
    return;
  }

  if (interaction.channelId !== threadId) {
    await interaction.reply({
      content: ERROR_MESSAGES.WRONG_THREAD,
      ephemeral: true
    });
    return;
  }

  if (!isTicketStaffFromInteraction(interaction)) {
    await interaction.reply({
      content: ERROR_MESSAGES.NOT_TICKET_STAFF,
      ephemeral: true
    });
    return;
  }

  // Check if thread is in a state that allows user management
  if (!canManageUsers(thread)) {
    await interaction.reply({
      content: ERROR_MESSAGES.CLOSED_TICKET_OPERATIONS,
      ephemeral: true
    });
    return;
  }

  const addUsers = interaction.fields.getSelectedUsers(CUSTOM_IDS.addUserSelect);
  const addUserId = addUsers.first()?.id ?? null;

  if (!addUserId) {
    await interaction.reply({
      content: ERROR_MESSAGES.NO_USER_SELECTED,
      ephemeral: true
    });
    return;
  }

  const results = [];

  try {
    const member = await interaction.guild.members.fetch(addUserId).catch(() => null);

    if (member) {
      await thread.members.add(addUserId).catch(() => null);
      results.push(SUCCESS_MESSAGES.USER_ADDED(addUserId));

      // Send log
      await sendUserManagementLog(thread, {
        action: 'User Added',
        color: LOG_COLORS.USER_ADDED,
        userId: addUserId,
        staffId: interaction.user.id
      });
    } else {
      results.push('Could not find that user.');
    }
  } catch (error) {
    console.error('Error adding user to ticket:', error);
    results.push(ERROR_MESSAGES.FAILED_OPERATION);
  }

  await interaction.reply({
    content: results.join('\n') || 'Could not add that user.',
    ephemeral: true
  });
}

/**
 * Handle remove users modal submission
 */
export async function handleRemoveUsersModalSubmit(interaction, threadId) {
  if (!interaction.inGuild() || !interaction.channel?.isThread?.()) {
    return;
  }

  const thread = interaction.channel;

  if (!threadId) {
    await interaction.reply({
      content: ERROR_MESSAGES.INVALID_TICKET_STATE,
      ephemeral: true
    });
    return;
  }

  if (interaction.channelId !== threadId) {
    await interaction.reply({
      content: ERROR_MESSAGES.WRONG_THREAD,
      ephemeral: true
    });
    return;
  }

  if (!isTicketStaffFromInteraction(interaction)) {
    await interaction.reply({
      content: ERROR_MESSAGES.NOT_TICKET_STAFF,
      ephemeral: true
    });
    return;
  }

  // Check if thread is in a state that allows user management
  if (!canManageUsers(thread)) {
    await interaction.reply({
      content: ERROR_MESSAGES.CLOSED_TICKET_OPERATIONS,
      ephemeral: true
    });
    return;
  }

  const removeUsers = interaction.fields.getSelectedUsers(CUSTOM_IDS.removeUserSelect);
  const removeUserId = removeUsers.first()?.id ?? null;

  if (!removeUserId) {
    await interaction.reply({
      content: ERROR_MESSAGES.NO_USER_SELECTED,
      ephemeral: true
    });
    return;
  }

  const results = [];

  try {
    const member = await interaction.guild.members.fetch(removeUserId).catch(() => null);

    if (member) {
      // Check if user can be removed (not staff/admin/owner)
      if (!canRemoveUser(member, interaction.guild, removeUserId)) {
        results.push('Cannot remove staff members from tickets.');
      } else {
        await thread.members.remove(removeUserId).catch(() => null);
        results.push(SUCCESS_MESSAGES.USER_REMOVED(removeUserId));

        // Send log
        await sendUserManagementLog(thread, {
          action: 'User Removed',
          color: LOG_COLORS.USER_REMOVED,
          userId: removeUserId,
          staffId: interaction.user.id
        });
      }
    } else {
      results.push('Could not find that user.');
    }
  } catch (error) {
    console.error('Error removing user from ticket:', error);
    results.push(ERROR_MESSAGES.FAILED_OPERATION);
  }

  await interaction.reply({
    content: results.join('\n') || 'Could not remove that user.',
    ephemeral: true
  });
}

/**
 * Send user management log
 */
async function sendUserManagementLog(thread, { action, color, userId, staffId }) {
  const logChannel = await thread.guild.channels.fetch(TICKET_LOG_CHANNEL_ID).catch(() => null);
  
  if (!logChannel?.isTextBased?.()) return;

  const webhook = await webhookService.getOrCreateLogWebhook(logChannel);
  if (!webhook) return;

  const { EmbedBuilder } = await import('discord.js');
  const threadLink = buildThreadLink(thread.guildId, thread.id);

  const embed = new EmbedBuilder()
    .setTitle(action)
    .setColor(color)
    .setDescription([
      `${action === 'User Added' ? 'Added By' : 'Removed By'}: <@${staffId}>`,
      `${action === 'User Added' ? 'Added User' : 'Removed User'}: <@${userId}>`,
      `Thread Link: ${threadLink}`
    ].join('\n'));

  try {
    await webhook.send({
      embeds: [embed],
      allowedMentions: { parse: [] }
    });
  } catch (error) {
    console.error(`Failed to send ${action.toLowerCase()} log:`, error);
  }
}
