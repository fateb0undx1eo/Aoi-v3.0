import { MessageFlags, ButtonStyle } from 'discord.js';
import { ticketService } from '../services/ticket-service.js';
import { cooldownService } from '../services/cooldown-service.js';
import { lockService } from '../services/lock-service.js';
import { webhookService } from '../services/webhook-service.js';
import { 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  DEFAULT_ARCHIVE_DURATION,
  LOG_COLORS,
  TICKET_LOG_CHANNEL_ID,
  CUSTOM_IDS
} from '../utils/constants.js';
import { 
  markThreadNameClosed, 
  isThreadNameClosed,
  buildThreadLink,
  safeUpdateThreadName,
  canManageUsers
} from '../utils/thread-utils.js';
import { isTicketStaffFromInteraction } from '../utils/permissions.js';

/**
 * Handle resolved button click - show confirmation dialog
 */
export async function handleResolvedButton(interaction, creatorId) {
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

  const thread = interaction.channel;
  
  // Check if ticket is already closed
  if (isThreadNameClosed(thread.name)) {
    await interaction.reply({
      content: 'This ticket is already resolved and cannot be resolved again.',
      ephemeral: true
    });
    return;
  }

  // Show confirmation dialog
  await interaction.reply({
    content: 'Are you sure you want to resolve this ticket? This action cannot be undone.',
    ephemeral: true,
    components: [
      {
        type: 1, // ActionRow
        components: [
          {
            type: 2, // Button
            style: ButtonStyle.Danger,
            custom_id: `${CUSTOM_IDS.resolvedConfirmYes}:${creatorId}`,
            label: 'Yes, Resolve'
          },
          {
            type: 2, // Button
            style: ButtonStyle.Secondary,
            custom_id: `${CUSTOM_IDS.resolvedConfirmNo}:${creatorId}`,
            label: 'Cancel'
          }
        ]
      }
    ]
  });
}

/**
 * Handle confirmation YES - actually resolve the ticket
 */
export async function handleResolvedConfirmYes(interaction, creatorId) {
  // Defer reply since this might take time
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate().catch(() => null);
  }

  const reply = async (content) => {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content, components: [] }).catch(() => null);
      return;
    }
    await interaction.update({ content, components: [] }).catch(() => null);
  };

  // Validate interaction context
  if (!interaction.inGuild() || !interaction.channel?.isThread?.()) {
    await reply(ERROR_MESSAGES.NOT_TICKET_THREAD);
    return;
  }

  if (!isTicketStaffFromInteraction(interaction)) {
    await reply(ERROR_MESSAGES.NOT_TICKET_STAFF);
    return;
  }

  const thread = interaction.channel;
  
  // Check if ticket is already closed
  if (isThreadNameClosed(thread.name)) {
    await reply('This ticket is already resolved.');
    return;
  }

  // Acquire resolve mutex to prevent concurrent operations
  const lockValue = await lockService.acquireResolveMutex(thread.id, 30000);
  if (!lockValue) {
    await reply('Another staff member is currently resolving this ticket. Please wait a moment and try again.');
    return;
  }

  try {
    // Get ticket information
    const ticket = await ticketService.getTicketByThreadId(thread.id);
    if (!ticket) {
      await reply('Ticket not found in database. Please contact an administrator.');
      return;
    }

    // Update thread name to mark as closed
    const closedName = markThreadNameClosed(thread.name);
    await safeUpdateThreadName(thread, closedName);

    // Remove creator from thread
    await thread.members.remove(creatorId).catch(() => null);

    // Lock and archive the thread
    await thread.setLocked(true).catch(() => null);
    await thread.setArchived(true).catch(() => null);

    // Set auto-archive duration to 1 hour
    await thread.setAutoArchiveDuration(DEFAULT_ARCHIVE_DURATION).catch(() => null);

    // Update ticket status in database
    await ticketService.updateTicketStatus(thread.id, 'resolved', {
      resolvedBy: interaction.user.id,
      resolvedAt: new Date().toISOString()
    });

    // Set cooldown for creator
    await cooldownService.setCooldown(interaction.guildId, creatorId, 10 * 60 * 1000);

    // Send resolved log
    await sendResolvedLog(thread, {
      creatorId,
      resolverId: interaction.user.id,
      tagLabel: ticket.tag_label || 'Unknown'
    });

    // Update welcome message to disable resolved button
    await disableResolvedButtonInWelcome(thread, creatorId);

    await reply(SUCCESS_MESSAGES.TICKET_RESOLVED);

  } catch (error) {
    console.error('Error resolving ticket:', error);
    await reply('Failed to resolve ticket. Please try again.');
  } finally {
    // Always release the mutex
    await lockService.releaseResolveMutex(thread.id, lockValue);
  }
}

/**
 * Handle confirmation NO - cancel resolution
 */
export async function handleResolvedConfirmNo(interaction, creatorId) {
  await interaction.update({
    content: 'Ticket resolution cancelled.',
    components: [],
    ephemeral: true
  }).catch(() => null);
}

/**
 * Disable the resolved button in the welcome message
 */
async function disableResolvedButtonInWelcome(thread, creatorId) {
  try {
    // Fetch messages to find the welcome message
    const messages = await thread.messages.fetch({ limit: 10 });
    
    // Look for the welcome message (usually the second message after mentions)
    const welcomeMessage = messages.find(msg => 
      msg.components && 
      msg.components.length > 0 &&
      msg.components[0].components.some(comp => 
        comp.custom_id === `${CUSTOM_IDS.resolvedPrefix}:${creatorId}`
      )
    );

    if (welcomeMessage) {
      // Update the welcome message to disable the resolved button
      const updatedComponents = welcomeMessage.components.map(row => ({
        type: row.type,
        components: row.components.map(comp => {
          if (comp.custom_id === `${CUSTOM_IDS.resolvedPrefix}:${creatorId}`) {
            return {
              ...comp,
              disabled: true,
              label: 'RESOLVED (Already Resolved)',
              style: ButtonStyle.Secondary
            };
          }
          return comp;
        })
      }));

      await welcomeMessage.edit({
        components: updatedComponents
      });
    }
  } catch (error) {
    console.error('Failed to disable resolved button:', error);
  }
}

/**
 * Send resolved log message
 */
async function sendResolvedLog(thread, { creatorId, resolverId, tagLabel }) {
  try {
    const { webhook } = await webhookService.getOrCreateLogWebhook(
      thread.guild,
      TICKET_LOG_CHANNEL_ID
    );

    if (!webhook) return;

    const threadLink = buildThreadLink(thread.guildId, thread.id);
    const now = Math.floor(Date.now() / 1000);

    const embed = {
      title: 'Resolved',
      color: LOG_COLORS.RESOLVED,
      description: [
        `**Resolved By:** <@${resolverId}>`,
        `**Resolved At:** <t:${now}:F>`,
        `**Created By:** <@${creatorId}>`,
        `**Ticket Tag:** ${tagLabel}`,
        `**Thread Link:** ${threadLink}`
      ].join('\n')
    };

    await webhook.send({
      embeds: [embed],
      allowedMentions: { parse: [] }
    });
  } catch (error) {
    console.error('Failed to send resolved log:', error);
  }
}

// Legacy function for backward compatibility - now just shows confirmation
export async function toggleResolved(interaction, creatorId) {
  await handleResolvedButton(interaction, creatorId);
}
