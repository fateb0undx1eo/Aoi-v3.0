import { ChannelType, PermissionFlagsBits } from 'discord.js';
import type { InteractionResult } from '../../../types/index.js';
import logger from '../services/logging-service.js';
import { buildTicketWelcomePayload } from '../components/payloads.js';
import { generateThreadName, addStaffMembersToThread, buildTicketMentions, hasOpenTicketInChannel } from '../utils/thread-utils.js';
import { CooldownError } from '../utils/error-handler.js';
import {
  ERROR_MESSAGES,
  AUTO_ARCHIVE_24H,
  TICKET_LOG_CHANNEL_ID,
  TICKET_STAFF_ROLE_IDS,
  ADD_STAFF_MEMBERS_TO_THREAD,
  getTicketColor
} from '../utils/constants.js';
import type TicketService from '../services/ticket-service.js';
import type LockService from '../services/lock-service.js';
import type DiscordRestService from '../services/discord-rest-service.js';
import type WebhookService from '../services/webhook-service.js';
import type { TicketTag } from '../utils/constants.js';

const R = {
  editReply: (content: string, opts: { components?: any[] } = {}): InteractionResult => ({ type: 'EDIT_REPLY', content, components: opts.components }),
};

export class TicketCreationHandler {
  private ticketService: TicketService;
  private lockService: LockService;
  private discordRest: DiscordRestService;
  private webhookService: WebhookService;
  private discordClient: any;

  constructor(
    ticketService: TicketService,
    lockService: LockService,
    discordRestService: DiscordRestService,
    webhookService: WebhookService,
    discordClient: any
  ) {
    this.ticketService = ticketService;
    this.lockService = lockService;
    this.discordRest = discordRestService;
    this.webhookService = webhookService;
    this.discordClient = discordClient;
  }

  async handleTicketCreation(interaction: any, tag: TicketTag): Promise<InteractionResult> {
    const { user, channel, client } = interaction;
    try {
      if (!channel?.threads?.create) {
        return R.editReply(ERROR_MESSAGES.NO_PANEL_CHANNEL);
      }

      const isAdminOrOwner = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || interaction.guild?.ownerId === user.id;
      if (!isAdminOrOwner) {
        try {
          await (this.ticketService as any).cooldownService.checkCooldown(user.id);
        } catch (error) {
          if (error instanceof CooldownError) {
            return R.editReply(error.message);
          }
          throw error;
        }
      }

      const activeTickets = await this.ticketService
        .getUserActiveTickets(interaction.guildId, user.id)
        .catch(() => []);
      const hasLegacyOpenThread = activeTickets.length === 0
        ? await hasOpenTicketInChannel(channel, user.id, client.user.id)
        : false;

      if (activeTickets.length > 0 || hasLegacyOpenThread) {
        return R.editReply(ERROR_MESSAGES.ALREADY_OPEN);
      }

      const thread = await channel.threads.create({
        name: generateThreadName(tag.namePrefix),
        type: ChannelType.PrivateThread,
        autoArchiveDuration: AUTO_ARCHIVE_24H,
        invitable: false,
        reason: `Ticket created by ${user.id} (${tag.value})`
      }).catch(() => null);

      if (!thread) {
        return R.editReply(ERROR_MESSAGES.THREAD_CREATE_FAILED);
      }

      const added = await thread.members.add(user.id).then(() => true).catch(() => false);
      if (!added) {
        return R.editReply(ERROR_MESSAGES.ADD_USER_FAILED);
      }

      this.setupThreadAsync(thread, user.id, tag).catch((error) => {
        logger.error('Ticket thread setup failed', { threadId: thread.id, error: (error as Error).message });
      });

      return R.editReply(`Ticket created: <#${thread.id}>`);
    } catch (error) {
      logger.error('Ticket creation failed', { error: (error as Error).message, stack: (error as Error).stack });
      return R.editReply('An error occurred while creating your ticket.');
    }
  }

  async setupThreadAsync(thread: any, creatorId: string, tag: TicketTag): Promise<void> {
    if (ADD_STAFF_MEMBERS_TO_THREAD) {
      await addStaffMembersToThread(thread).catch((error) => {
        logger.warn('Failed adding staff members', { error: (error as Error).message, threadId: thread.id });
      });
    }

    await thread.send({
      content: buildTicketMentions(creatorId),
      allowedMentions: { users: [creatorId], roles: TICKET_STAFF_ROLE_IDS }
    }).catch(() => null);

    await thread.send(buildTicketWelcomePayload(tag, creatorId)).catch(() => null);

    await this.ticketService.createTicket({
      guildId: thread.guildId,
      threadId: thread.id,
      creatorId,
      tagValue: tag.value,
      tagLabel: tag.label,
      threadName: thread.name,
      createdAt: new Date()
    }).catch(() => null);

    await this.sendCreatedLog(thread, creatorId, tag.label);
  }

  async sendCreatedLog(thread: any, creatorId: string, tagLabel: string): Promise<void> {
    const logChannel = await this.discordClient.channels.fetch(TICKET_LOG_CHANNEL_ID).catch(() => null);
    if (!logChannel) return;

    const webhook = await this.webhookService.getOrCreateLogWebhook(logChannel).catch(() => null);
    if (!webhook) return;

    const now = Math.floor(Date.now() / 1000);
    const threadLink = `https://discord.com/channels/${thread.guildId}/${thread.id}`;
    const creator = await this.discordClient.users.fetch(creatorId).catch(() => null);
    const avatarUrl = creator?.displayAvatarURL({ extension: 'png', size: 4096 }) || this.discordClient.user?.displayAvatarURL();

    const pointerLine = (label: string, value: string) => `<:Pointer:1502993771317694655> **${label}:** ${value}`;

    const components = [
      {
        type: 17,
        accent_color: getTicketColor(thread.id),
        components: [
          { type: 10, content: `# TICKET CREATED` },
          {
            type: 9,
            components: [
              { type: 10, content: [
                pointerLine('Creator', `<@${creatorId}>`),
                pointerLine('Category', tagLabel),
                pointerLine('Created', `<t:${now}:f>`),
                pointerLine('Thread', threadLink)
              ].join('\n') }
            ],
            accessory: { type: 11, media: { url: avatarUrl } }
          }
        ]
      }
    ];

    await this.webhookService.sendWithRetry(webhook, {
      flags: 1 << 15,
      components,
      allowedMentions: { parse: [] },
      username: 'Ticket System',
      avatarURL: this.discordClient.user?.displayAvatarURL()
    }).catch(() => null);
  }
}

export default TicketCreationHandler;
