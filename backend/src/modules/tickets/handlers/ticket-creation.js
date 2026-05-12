import { ChannelType } from 'discord.js';
import { ticketRepository } from '../repositories/ticket-repository.js';
import { cooldownService } from '../services/cooldown-service.js';
import { loggingService } from '../services/logging-service.js';
import { metricsService } from '../services/metrics-service.js';
import { errorHandler } from '../utils/error-handler.js';
import { 
  TICKET_TAGS, ERROR_MESSAGES, SUCCESS_MESSAGES,
  DEFAULT_ARCHIVE_DURATION, ADD_STAFF_MEMBERS_TO_THREAD,
  TICKET_STAFF_ROLE_IDS, TICKET_CREATION_LOCK_MS
} from '../utils/constants.js';
import { generateThreadName } from '../utils/thread-utils.js';
import { buildTicketMentions } from '../utils/permissions.js';
import { buildTicketWelcomePayload } from '../components/payloads.js';
import { validateInteraction, validateTicketTag } from '../utils/validators.js';
import { generateRedisKey } from '../utils/redis-keys.js';
import { redisClient } from '../../../core/redis.js';

export async function createTicketFromTag(interaction, tag) {
  const context = await loggingService.logInteractionStart(interaction, 'create_ticket');
  const timer = metricsService.createTimer();

  try {
    const validation = validateInteraction(interaction);
    if (!validation.isValid) throw new Error(`Invalid interaction: ${validation.errors.join(', ')}`);

    const tagValidation = validateTicketTag(tag);
    if (!tagValidation.isValid) throw new Error(`Invalid tag: ${tagValidation.errors.join(', ')}`);

    const parentChannel = interaction.channel;
    if (!parentChannel?.threads?.create) throw new Error(ERROR_MESSAGES.FAILED_THREAD_CREATION);

    await interaction.deferReply({ ephemeral: true });

    const lockKey = generateRedisKey('lock', 'create', interaction.guildId, interaction.user.id);
    const lockValue = await redisClient.acquireLock(lockKey, TICKET_CREATION_LOCK_MS);
    
    if (!lockValue) {
      await interaction.editReply({ content: ERROR_MESSAGES.CREATION_IN_PROGRESS });
      return;
    }

    try {
      const[remaining, existingTicket] = await Promise.all([
        cooldownService.getRemainingCooldown(interaction.guildId, interaction.user.id),
        ticketRepository.findOpenTicket(interaction.guildId, interaction.user.id)
      ]);

      if (remaining > 0) {
        const readyAt = Math.floor((Date.now() + remaining) / 1000);
        await interaction.editReply({ content: ERROR_MESSAGES.TICKET_COOLDOWN(readyAt) });
        return;
      }

      if (existingTicket) {
        await interaction.editReply({ content: ERROR_MESSAGES.ALREADY_OPEN_TICKET });
        return;
      }

      const tagConfig = TICKET_TAGS.find(t => t.value === tag);
      if (!tagConfig) throw new Error(`Unknown ticket tag: ${tag}`);

      const threadName = generateThreadName(tagConfig.namePrefix);
      let thread;
      
      try {
        thread = await parentChannel.threads.create({
          name: threadName,
          type: ChannelType.PrivateThread,
          invitable: false,
          autoArchiveDuration: DEFAULT_ARCHIVE_DURATION
        });
      } catch (error) {
        await interaction.editReply({ content: ERROR_MESSAGES.FAILED_THREAD_CREATION });
        throw error;
      }

      try {
        await thread.members.add(interaction.user.id);
      } catch (error) {
        await interaction.editReply({ content: ERROR_MESSAGES.FAILED_ADD_USER });
        throw error;
      }

      const ticketData = {
        guildId: interaction.guildId,
        threadId: thread.id,
        creatorId: interaction.user.id,
        tag: tag,
        tagLabel: tagConfig.label,
        threadName: thread.name,
        autoArchiveDuration: DEFAULT_ARCHIVE_DURATION
      };

      const ticket = await ticketRepository.create(ticketData);
      
      const welcomePayload = buildTicketWelcomePayload(tagConfig, interaction.user.id);
      let welcomeMessage;
      
      try {
        welcomeMessage = await thread.send(welcomePayload);
      } catch (error) {
        await loggingService.warn({ operation: 'create_ticket', ...context, message: 'Failed to send welcome message', metadata: { error: error.message } });
      }

      try {
        await thread.send({
          content: buildTicketMentions(interaction.user.id),
          allowedMentions: { users: [interaction.user.id], roles: TICKET_STAFF_ROLE_IDS }
        });
      } catch (error) {
        await loggingService.warn({ operation: 'create_ticket', ...context, message: 'Failed to send mention message', metadata: { error: error.message } });
      }

      if (ADD_STAFF_MEMBERS_TO_THREAD) {
        await addStaffMembersToThread(thread);
      }

      if (welcomeMessage) {
        await ticketRepository.updateMetadata(thread.id, { welcome_message_id: welcomeMessage.id });
      }

      await loggingService.info({ operation: 'create_ticket', ...context, message: 'Ticket created successfully', metadata: { threadId: thread.id, tag, ticketId: ticket.id }});

      await interaction.editReply({ content: SUCCESS_MESSAGES.TICKET_CREATED(thread.id) });

      const duration = timer.stop();
      await metricsService.recordTicketCreation(duration, true, { guildId: interaction.guildId, threadId: thread.id, userId: interaction.user.id, tag });
      await loggingService.logInteractionComplete(context, 'create_ticket', { success: true, duration, threadId: thread.id });

      return thread;

    } finally {
      await redisClient.releaseLock(lockKey, lockValue);
    }

  } catch (error) {
    const duration = timer.stop();
    await metricsService.recordTicketCreation(duration, false, { guildId: interaction.guildId, userId: interaction.user.id, error: error.message });
    await errorHandler.handleInteractionError(context, error, 'create_ticket');
    throw error;
  }
}

async function addStaffMembersToThread(thread) {
  // Staff will be added automatically when they respond to the ping, or manual loops here.
  return Promise.resolve();
}