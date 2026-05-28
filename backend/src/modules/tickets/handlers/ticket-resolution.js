import logger from '../services/logging-service.js';
import { buildErrorPayload, buildSuccessPayload } from '../components/payloads.js';
import { isTicketStaffFromInteraction } from '../utils/permissions.js';
import { isThreadNameClosed, markThreadNameClosed, extractTagLabelFromMessage, findWelcomeMessageInThread } from '../utils/thread-utils.js';
import { AUTO_ARCHIVE_1H, ERROR_MESSAGES, POINTER, TICKET_LOG_CHANNEL_ID, TICKET_TAGS } from '../utils/constants.js';

export class TicketResolutionHandler {
  constructor(ticketService, webhookService, discordClient) {
    this.ticketService = ticketService;
    this.webhookService = webhookService;
    this.discordClient = discordClient;
  }

  async handleResolvedButtonPress(interaction, creatorId) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => null);
    }

    const channel = interaction.channel;
    if (!interaction.inGuild() || !channel?.isThread?.()) {
      await this.editError(interaction, ERROR_MESSAGES.NOT_IN_THREAD);
      return;
    }
    if (!isTicketStaffFromInteraction(interaction)) {
      await this.editError(interaction, ERROR_MESSAGES.NOT_STAFF);
      return;
    }
    if (isThreadNameClosed(channel.name)) {
      await this.editError(interaction, ERROR_MESSAGES.ALREADY_CLOSED);
      return;
    }

    const tagLabel = await this.resolveTagLabel(channel);

    await channel.setName(markThreadNameClosed(channel.name)).catch(() => null);
    await channel.members.remove(creatorId).catch(() => null);
    await channel.setAutoArchiveDuration(AUTO_ARCHIVE_1H).catch(() => null);
    await channel.setLocked(true).catch(() => null);
    await channel.setArchived(true).catch(() => null);

    await this.ticketService.cooldownService.applyCooldown(creatorId).catch(() => null);
    await this.ticketService.resolveTicket(channel.id, interaction.user.id, creatorId).catch(() => null);
    await this.sendResolvedLog(channel, creatorId, interaction.user.id, tagLabel);

    await interaction.editReply(buildSuccessPayload('Ticket has been closed.'));
  }

  async resolveTagLabel(thread) {
    const message = await findWelcomeMessageInThread(thread).catch(() => null);
    return extractTagLabelFromMessage(message) || 'Unknown';
  }

  async sendResolvedLog(thread, creatorId, resolverId, tagLabel) {
    const logChannel = await this.discordClient.channels.fetch(TICKET_LOG_CHANNEL_ID).catch(() => null);
    if (!logChannel) return;
    const webhook = await this.webhookService.getOrCreateLogWebhook(logChannel).catch(() => null);
    if (!webhook) return;

    const ticketRow = await this.ticketService.getTicket(thread.id).catch(() => null);
    const createdAtUnix = ticketRow?.created_at
      ? Math.floor(new Date(ticketRow.created_at).getTime() / 1000)
      : null;
    const tagLabelFromDb =
      ticketRow?.tag_label ||
      TICKET_TAGS.find((t) => t.value === ticketRow?.tag)?.label;

    const now = Math.floor(Date.now() / 1000);
    const threadLink = `https://discord.com/channels/${thread.guildId}/${thread.id}`;
    const embed = {
      title: 'Closed',
      color: 0x2fa44f,
      description: [
        `${POINTER} Created By: <@${creatorId}>`,
        `${POINTER} Created At: ${createdAtUnix ? `<t:${createdAtUnix}:F>` : '-'}`,
        `${POINTER} Resolved At: <t:${now}:F>`,
        `${POINTER} Resolved By: <@${resolverId}>`,
        `${POINTER} Ticket Tag: ${tagLabelFromDb || tagLabel}`,
        `${POINTER} Thread Link: ${threadLink}`
      ].join('\n')
    };

    await this.webhookService.sendWithRetry(webhook, {
      embeds: [embed],
      allowedMentions: { parse: [] },
      username: 'Ticket System',
      avatarURL: this.discordClient.user?.displayAvatarURL()
    }).catch(() => null);
  }

  async editError(interaction, message) {
    const payload = buildErrorPayload(message);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
  }
}

export default TicketResolutionHandler;
