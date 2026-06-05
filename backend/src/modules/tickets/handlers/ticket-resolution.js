import logger from '../services/logging-service.js';
import { buildErrorPayload, buildSuccessPayload } from '../components/payloads.js';
import { isTicketStaffFromInteraction } from '../utils/permissions.js';
import { isThreadNameClosed, markThreadNameClosed, extractTagLabelFromMessage, findWelcomeMessageInThread } from '../utils/thread-utils.js';
import { AUTO_ARCHIVE_1H, ERROR_MESSAGES, POINTER, TICKET_LOG_CHANNEL_ID, TICKET_TAGS } from '../utils/constants.js';

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

    await this.sendTranscript(thread, creatorId, resolverId, webhook);
  }

  async sendTranscript(thread, creatorId, resolverId, webhook) {
    const messages = await thread.messages.fetch({ limit: 100 }).catch(() => null);
    if (!messages || messages.size === 0) return;

    const sorted = [...messages.values()].reverse();
    const tag = thread.name.split('-').slice(0, -1).join('-') || 'ticket';
    const safeName = thread.name.replace(/[^a-zA-Z0-9_-]/g, '');

    let body = '';
    for (const msg of sorted) {
      if (msg.author.bot && msg.components?.length > 0) continue;
      const time = `<span class="time">${msg.createdAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>`;
      const name = msg.author.username;
      const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 32 });
      const color = msg.member?.displayColor ? `hsl(${msg.member.displayColor}, 70%, 40%)` : '#99aab5';
      const content = msg.content
        ? escapeHtml(msg.content)
        : msg.attachments.size > 0
          ? `[${msg.attachments.map(a => a.name).join(', ')}]`
          : '[embed]';

      body += `<div class="message">
        <img class="avatar" src="${avatar}" alt="" loading="lazy">
        <div class="content">
          <div class="header"><span class="name" style="color:${color}">${escapeHtml(name)}</span> ${time}</div>
          <div class="text">${content.replace(/\n/g, '<br>')}</div>
        </div>
      </div>`;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transcript - ${escapeHtml(thread.name)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background: #1e1e2e; color: #dcddde; padding: 20px; }
  .header-bar { background: #2b2d3a; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; border: 1px solid #3a3c4a; }
  .header-bar h1 { font-size: 18px; color: #fff; }
  .header-bar .meta { font-size: 13px; color: #99aab5; margin-top: 4px; }
  .header-bar .meta span { color: #dcddde; }
  .messages { max-width: 800px; margin: 0 auto; }
  .message { display: flex; gap: 12px; padding: 6px 12px; border-radius: 4px; }
  .message:hover { background: #2b2d3a; }
  .avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; }
  .content { flex: 1; min-width: 0; }
  .header { font-size: 14px; line-height: 1.4; }
  .name { font-weight: 600; }
  .time { font-size: 11px; color: #72767d; margin-left: 6px; }
  .text { font-size: 15px; line-height: 1.5; word-wrap: break-word; color: #dcddde; margin-top: 1px; }
  .footer { text-align: center; color: #72767d; font-size: 12px; margin-top: 30px; padding: 12px; border-top: 1px solid #3a3c4a; }
</style>
</head>
<body>
<div class="messages">
  <div class="header-bar">
    <h1>${escapeHtml(tag.toUpperCase())}</h1>
    <div class="meta">Created by <span>${escapeHtml(creatorId)}</span> &middot; Closed by <span>${escapeHtml(resolverId)}</span> &middot; ${sorted.length} messages</div>
  </div>
  ${body}
  <div class="footer">End of transcript &mdash; ${new Date().toUTCString()}</div>
</div>
</body>
</html>`;

    const buffer = Buffer.from(html, 'utf-8');
    const fileName = `${safeName}-transcript.html`;

    await this.webhookService.sendWithRetry(webhook, {
      files: [{ attachment: buffer, name: fileName }],
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
