import logger from '../services/logging-service.js';
import { buildErrorPayload, buildSuccessPayload } from '../components/payloads.js';
import { isTicketStaffFromInteraction } from '../utils/permissions.js';
import { isThreadNameClosed, markThreadNameClosed, extractTagLabelFromMessage, findWelcomeMessageInThread } from '../utils/thread-utils.js';
import { AUTO_ARCHIVE_1H, ERROR_MESSAGES, POINTER, TICKET_LOG_CHANNEL_ID, TICKET_TAGS, TICKET_STAFF_ROLE_IDS } from '../utils/constants.js';

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function convertMarkdown(text) {
  return text
    .replace(/\|\|(.+?)\|\|/gs, '<span class="spoiler">$1</span>')
    .replace(/~~(.+?)~~/gs, '<s>$1</s>')
    .replace(/__(.+?)__/gs, '<u>$1</u>')
    .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/gs, '<em>$1</em>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
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

    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);

    await channel.setName(markThreadNameClosed(channel.name)).catch(() => null);
    await channel.members.remove(creatorId).catch(() => null);
    await channel.setAutoArchiveDuration(AUTO_ARCHIVE_1H).catch(() => null);
    await channel.setLocked(true).catch(() => null);
    await channel.setArchived(true).catch(() => null);

    await this.ticketService.cooldownService.applyCooldown(creatorId).catch(() => null);
    await this.ticketService.resolveTicket(channel.id, interaction.user.id, creatorId).catch(() => null);
    await this.sendResolvedLog(channel, creatorId, interaction.user.id, tagLabel, messages);

    await interaction.editReply(buildSuccessPayload('Ticket has been closed.'));
  }

  async resolveTagLabel(thread) {
    const message = await findWelcomeMessageInThread(thread).catch(() => null);
    return extractTagLabelFromMessage(message) || 'Unknown';
  }

  async sendResolvedLog(thread, creatorId, resolverId, tagLabel, messages) {
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

    const payload = {
      embeds: [embed],
      allowedMentions: { parse: [] },
      username: 'Ticket System',
      avatarURL: this.discordClient.user?.displayAvatarURL()
    };

    if (messages && messages.size > 0) {
      const file = this.buildTranscriptFile(thread, creatorId, resolverId, messages);
      if (file) payload.files = [file];
    }

    await this.webhookService.sendWithRetry(webhook, payload).catch(() => null);
  }

  buildTranscriptFile(thread, creatorId, resolverId, messages) {
    const sorted = [...messages.values()].reverse();
    const tag = thread.name.split('-').slice(0, -1).join('-') || 'ticket';
    const safeName = thread.name.replace(/[^a-zA-Z0-9_-]/g, '');
    const staffRoleIds = new Set(TICKET_STAFF_ROLE_IDS);

    let body = '';
    for (const msg of sorted) {
      if (msg.author.bot) continue;

      const time = `<span class="time">${msg.createdAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>`;
      const name = msg.author.username;
      const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 128 });
      const isCreator = msg.author.id === creatorId;
      const isStaff = msg.member?.roles?.cache?.hasAny?.(...staffRoleIds) ?? false;
      const color = isCreator ? '#57F287' : '#00AFFA';

      let content = '';
      if (msg.content) {
        content = convertMarkdown(escapeHtml(msg.content)).replace(/\n/g, '<br>');
      } else if (msg.attachments.size > 0) {
        const links = [...msg.attachments.values()].map(a => {
          if (a.contentType?.startsWith('image/')) {
            return `<a href="${escapeHtml(a.url)}" target="_blank"><img class="media" src="${escapeHtml(a.url)}" alt="${escapeHtml(a.name)}" loading="lazy"></a>`;
          }
          return `<a class="file-link" href="${escapeHtml(a.url)}" target="_blank">📎 ${escapeHtml(a.name)}</a>`;
        }).join(' ');
        content = links;
      } else {
        content = '[embed]';
      }

      body += `<div class="message ${isCreator ? 'creator' : ''} ${isStaff ? 'staff' : ''}">
        <img class="avatar" src="${avatar}" alt="" loading="lazy">
        <div class="content">
          <div class="header"><span class="name" style="color:${color}">${escapeHtml(name)}</span> <span class="badge">${isCreator ? 'OP' : isStaff ? 'STAFF' : ''}</span> ${time}</div>
          <div class="text">${content}</div>
        </div>
      </div>`;
    }

    if (!body) return null;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transcript - ${escapeHtml(thread.name)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background: #000; color: #dcddde; padding: 20px; }
  .header-bar { background: #111; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; border: 1px solid #222; }
  .header-bar h1 { font-size: 18px; color: #fff; }
  .header-bar .meta { font-size: 13px; color: #72767d; margin-top: 4px; }
  .header-bar .meta span { color: #dcddde; }
  .messages { max-width: 800px; margin: 0 auto; }
  .message { display: flex; gap: 12px; padding: 6px 12px; border-radius: 4px; }
  .message:hover { background: #111; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; }
  .content { flex: 1; min-width: 0; }
  .header { font-size: 14px; line-height: 1.4; display: flex; align-items: center; gap: 6px; }
  .name { font-weight: 600; }
  .badge { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px; background: #222; color: #72767d; text-transform: uppercase; }
  .time { font-size: 11px; color: #72767d; }
  .text { font-size: 15px; line-height: 1.5; word-wrap: break-word; color: #dcddde; margin-top: 1px; }
  .text strong { font-weight: 700; color: #fff; }
  .text em { font-style: italic; }
  .text u { text-decoration: underline; }
  .text s { text-decoration: line-through; }
  .text code { background: #222; padding: 1px 4px; border-radius: 3px; font-size: 85%; font-family: 'Consolas', 'Courier New', monospace; }
  .text pre { background: #111; padding: 10px; border-radius: 6px; overflow-x: auto; margin: 6px 0; }
  .text pre code { background: none; padding: 0; border-radius: 0; font-size: 13px; }
  .text blockquote { border-left: 4px solid #5865F2; padding-left: 10px; margin: 4px 0; color: #b5bac1; }
  .text .spoiler { background: #222; color: transparent; border-radius: 3px; padding: 0 2px; cursor: pointer; }
  .text .spoiler:hover { color: #dcddde; background: #333; }
  .media { max-width: 100%; max-height: 300px; border-radius: 8px; margin: 4px 0; display: block; }
  .file-link { color: #00AFFA; text-decoration: none; font-size: 14px; display: inline-block; margin: 2px 0; }
  .file-link:hover { text-decoration: underline; }
  .footer { text-align: center; color: #72767d; font-size: 12px; margin-top: 30px; padding: 12px; border-top: 1px solid #222; }
</style>
</head>
<body>
<div class="messages">
  <div class="header-bar">
    <h1>${escapeHtml(tag.toUpperCase())}</h1>
    <div class="meta">Created by <span>${escapeHtml(creatorId)}</span> &middot; Closed by <span>${escapeHtml(resolverId)}</span> &middot; ${sorted.filter(m => !m.author.bot).length} messages</div>
  </div>
  ${body}
  <div class="footer">End of transcript &mdash; ${new Date().toUTCString()}</div>
</div>
</body>
</html>`;

    const buffer = Buffer.from(html, 'utf-8');
    return { attachment: buffer, name: `${safeName}-transcript.html` };
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
