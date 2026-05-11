import { ChannelType, MessageFlags } from 'discord.js';
import { ticketService } from '../services/ticket-service.js';
import { cooldownService } from '../services/cooldown-service.js';
import { lockService } from '../services/lock-service.js';
import { webhookService } from '../services/webhook-service.js';
import { 
  TICKET_TAGS, 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  AUTO_ARCHIVE_24H,
  ADD_STAFF_MEMBERS_TO_THREAD,
  TICKET_STAFF_ROLE_IDS
} from '../utils/constants.js';
import { 
  generateThreadName, 
  buildThreadLink,
  isValidTicketThread,
  safeUpdateThreadName
} from '../utils/thread-utils.js';
import { buildTicketMentions } from '../utils/permissions.js';
import { buildTicketWelcomePayload } from '../components/payloads.js';

/**
 * Handle ticket creation from tag selection
 */
export async function createTicketFromTag(interaction, tag) {
  const parentChannel = interaction.channel;

  if (!parentChannel?.threads?.create) {
    await interaction.editReply({
      content: ERROR_MESSAGES.FAILED_THREAD_CREATION
    });
    return;
  }

  // Check cooldown using new service
  const remaining = await cooldownService.getRemainingCooldown(
    interaction.guildId,
    interaction.user.id
  );

  if (remaining > 0) {
    const readyAt = Math.floor((Date.now() + remaining) / 1000);
    await interaction.editReply({
      content: ERROR_MESSAGES.TICKET_COOLDOWN(readyAt)
    });
    return;
  }

  // Check for existing open ticket using database lookup
  const existingTicket = await ticketService.getOpenTicket(
    interaction.guildId,
    interaction.user.id
  );

  if (existingTicket) {
    await interaction.editReply({
      content: ERROR_MESSAGES.ALREADY_OPEN_TICKET
    });
    return;
  }

  // Generate collision-safe thread name
  const threadName = generateThreadName(tag.namePrefix);

  let thread;
  try {
    thread = await parentChannel.threads.create({
      name: threadName,
      type: ChannelType.PrivateThread,
      invitable: false,
      autoArchiveDuration: AUTO_ARCHIVE_24H,
      reason: `Ticket created by ${interaction.user.id} (${tag.value})`
    });
  } catch {
    await interaction.editReply({
      content: ERROR_MESSAGES.FAILED_THREAD_CREATION
    });
    return;
  }

  try {
    await thread.members.add(interaction.user.id);
  } catch {
    await interaction.editReply({
      content: ERROR_MESSAGES.FAILED_ADD_USER
    });
    return;
  }

  // Create ticket record in database
  try {
    await ticketService.createTicket({
      guildId: interaction.guildId,
      threadId: thread.id,
      creatorId: interaction.user.id,
      tag: tag.value,
      tagLabel: tag.label,
      threadName: threadName,
      autoArchiveDuration: AUTO_ARCHIVE_24H
    });
  } catch (error) {
    console.error('Failed to create ticket record:', error);
    // Continue with creation but log the error
  }

  await interaction.editReply({
    content: SUCCESS_MESSAGES.TICKET_CREATED(thread.id)
  });

  // Handle post-creation tasks asynchronously
  queueMicrotask(async () => {
    try {
      // Send mention message
      await thread.send({
        content: buildTicketMentions(interaction.user.id),
        allowedMentions: {
          users: [interaction.user.id],
          roles: TICKET_TAGS.flatMap(t => t.emoji?.id ? [] : []) // Will be updated with actual role IDs
        }
      });
    } catch (error) {
      console.error('Failed to send mention message:', error);
    }

    let welcomeMessageId = null;
    try {
      // Send welcome message with Components V2
      const welcomeMessage = await thread.send(
        buildTicketWelcomePayload(tag, interaction.user.id)
      );
      welcomeMessageId = welcomeMessage.id;
      
      // Update ticket record with welcome message ID
      await ticketService.updateWelcomeMessageId(thread.id, welcomeMessageId);
    } catch (error) {
      console.error('Failed to send welcome message:', error);
    }

    try {
      // Send log message
      await sendTicketLog(thread, {
        creatorId: interaction.user.id,
        tagLabel: tag.label,
        welcomeMessageId
      });
    } catch (error) {
      console.error('Failed to send ticket log:', error);
    }

    // Add staff members if enabled
    if (ADD_STAFF_MEMBERS_TO_THREAD) {
      try {
        await addStaffMembersToThread(thread);
      } catch (error) {
        console.error('Failed to add staff members to thread:', error);
      }
    }
  });
}

/**
 * Add staff members to thread (optimized version)
 */
async function addStaffMembersToThread(thread) {
  const guild = thread.guild;
  const staffRoleIds = TICKET_STAFF_ROLE_IDS;

  // Use targeted fetch instead of fetching all members
  for (const roleId of staffRoleIds) {
    try {
      const role = guild.roles.cache.get(roleId);
      if (!role) continue;

      // Get role members without fetching entire guild
      const members = await role.members.fetch();
      for (const member of members.values()) {
        await thread.members.add(member.id).catch(() => null);
      }
    } catch (error) {
      console.error(`Failed to add members from role ${roleId}:`, error);
    }
  }
}

/**
 * Send ticket creation log
 */
async function sendTicketLog(thread, { creatorId, tagLabel, welcomeMessageId }) {
  const logChannel = await thread.guild.channels.fetch(TICKET_LOG_CHANNEL_ID).catch(() => null);
  
  if (!logChannel?.isTextBased?.()) return;

  const webhook = await webhookService.getOrCreateLogWebhook(logChannel);
  if (!webhook) return;

  const { EmbedBuilder } = await import('discord.js');
  const threadLink = buildThreadLink(thread.guildId, thread.id);
  const now = Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setTitle('Created')
    .setColor(0x8b2b2b)
    .setDescription([
      `<:Pointer:1502993771317694655> Created By: <@${creatorId}>`,
      `<:Pointer:1502993771317694655> Created At: <t:${now}:F>`,
      `<:Pointer:1502993771317694655> Resolved At: -`,
      `<:Pointer:1502993771317694655> Resolved By: -`,
      `<:Pointer:1502993771317694655> Ticket Tag: ${tagLabel}`,
      `<:Pointer:1502993771317694655> Thread Link: ${threadLink}`
    ].join('\n'));

  try {
    const logMessage = await webhook.send({
      embeds: [embed],
      allowedMentions: { parse: [] }
    });

    // Update ticket record with log message ID
    await ticketService.updateLogMessageIds(thread.id, logMessage.id);
  } catch (error) {
    console.error('Failed to send ticket log:', error);
  }
}
