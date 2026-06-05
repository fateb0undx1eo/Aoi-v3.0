import logger from '../services/logging-service.js';
import { buildErrorPayload, buildSuccessPayload } from '../components/payloads.js';
import { isTicketStaffFromInteraction } from '../utils/permissions.js';
import { isThreadNameClosed, markThreadNameClosed, extractTagLabelFromMessage, findWelcomeMessageInThread } from '../utils/thread-utils.js';
import { AUTO_ARCHIVE_1H, ERROR_MESSAGES, POINTER, TICKET_LOG_CHANNEL_ID, TICKET_TAGS, TICKET_STAFF_ROLE_IDS } from '../utils/constants.js';

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function convertMarkdown(text) {
  const codeBlocks = [];
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(`<pre><code class="lang-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`);
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  const inlineCodes = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return `\x00IC${inlineCodes.length - 1}\x00`;
  });

  text = text
    .replace(/\|\|(.+?)\|\|/gs, '<span class="spoiler">$1</span>')
    .replace(/~~(.+?)~~/gs, '<s>$1</s>')
    .replace(/__(.+?)__/gs, '<u>$1</u>')
    .replace(/\*\*\*(.+?)\*\*\*/gs, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/gs, '<em>$1</em>')
    .replace(/_(.+?)_/gs, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^(&gt;|>) (.+)$/gm, '<blockquote>$2</blockquote>');

  text = text.replace(/\x00CB(\d+)\x00/g, (_, i) => codeBlocks[i] || '');
  text = text.replace(/\x00IC(\d+)\x00/g, (_, i) => inlineCodes[i] || '');
  return text;
}

function renderContent(content, attachments, embeds, stickers) {
  let html = '';

  if (content) {
    let processed = escapeHtml(content);
    processed = processed.replace(/&lt;(a?):(\w+):(\d+)&gt;/g, (_, a, name, id) =>
      `<img class="emoji" src="https://cdn.discordapp.com/emojis/${id}.${a ? 'gif' : 'png'}" alt=":${name}:" loading="lazy">`
    );
    processed = processed.replace(/&lt;@!?(\d+)&gt;/g, '<span class="mention">@$1</span>');
    processed = processed.replace(/&lt;#(\d+)&gt;/g, '<span class="mention">#$1</span>');
    processed = processed.replace(/&lt;@&amp;(\d+)&gt;/g, '<span class="mention">@$1</span>');
    processed = convertMarkdown(processed);
    html += processed.replace(/\n/g, '<br>');
  }

  if (attachments?.length > 0) {
    for (const a of attachments) {
      if (a.contentType?.startsWith('image/')) {
        html += `<a href="${escapeHtml(a.url)}" target="_blank"><img class="media" src="${escapeHtml(a.url)}" alt="${escapeHtml(a.name)}" loading="lazy"></a>`;
      } else {
        html += `<a class="file-link" href="${escapeHtml(a.url)}" target="_blank">📎 ${escapeHtml(a.name)}</a>`;
      }
    }
  }

  if (stickers?.length > 0) {
    for (const s of stickers) {
      html += `<img class="sticker" src="${escapeHtml(s.url)}" alt="${escapeHtml(s.name)}" loading="lazy">`;
    }
  }

  if (embeds?.length > 0) {
    for (const e of embeds) {
      let color = e.hexColor ? `border-left-color:${e.hexColor}` : '';
      html += '<div class="embed" style="' + color + '">';
      if (e.author?.name) {
        html += `<div class="embed-author">${e.author.iconURL ? `<img src="${escapeHtml(e.author.iconURL)}" class="embed-author-icon"> ` : ''}${e.author.url ? `<a href="${escapeHtml(e.author.url)}" target="_blank">${escapeHtml(e.author.name)}</a>` : escapeHtml(e.author.name)}</div>`;
      }
      if (e.title) {
        html += `<div class="embed-title">${e.url ? `<a href="${escapeHtml(e.url)}" target="_blank">${escapeHtml(e.title)}</a>` : escapeHtml(e.title)}</div>`;
      }
      if (e.description) {
        html += `<div class="embed-desc">${escapeHtml(e.description).replace(/\n/g, '<br>')}</div>`;
      }
      if (e.fields?.length > 0) {
        for (const f of e.fields) {
          html += `<div class="embed-field${f.inline ? ' inline' : ''}"><span class="embed-field-name">${escapeHtml(f.name)}</span><span class="embed-field-value">${escapeHtml(f.value).replace(/\n/g, '<br>')}</span></div>`;
        }
      }
      if (e.image?.url) {
        html += `<img class="embed-image" src="${escapeHtml(e.image.url)}" alt="" loading="lazy">`;
      }
      if (e.thumbnail?.url) {
        html += `<img class="embed-thumb" src="${escapeHtml(e.thumbnail.url)}" alt="" loading="lazy">`;
      }
      if (e.footer?.text) {
        html += `<div class="embed-footer">${e.footer.iconURL ? `<img src="${escapeHtml(e.footer.iconURL)}" class="embed-footer-icon"> ` : ''}${escapeHtml(e.footer.text)}${e.timestamp ? ` · ${new Date(e.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}</div>`;
      }
      html += '</div>';
    }
  }

  return html || '[empty]';
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

      const unix = Math.floor(msg.createdAt.getTime() / 1000);
      const time = `<span class="time" data-timestamp="${unix}"><t:${unix}:F></span>`;
      const name = msg.author.username;
      const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 128 });
      const isCreator = msg.author.id === creatorId;
      const isStaff = msg.member?.roles?.cache?.hasAny?.(...staffRoleIds) ?? false;
      const color = isCreator ? '#004225' : '#7D1B36';
      const badge = isCreator ? 'OP' : isStaff ? 'STAFF' : '';
      const content = renderContent(msg.content, [...msg.attachments.values()], msg.embeds, [...msg.stickers.values()]);

      body += `<div class="message">
        <img class="avatar" src="${avatar}" alt="" loading="lazy">
        <div class="content">
          <div class="header"><span class="name" style="color:${color}">${escapeHtml(name)}</span>${badge ? ` <span class="badge">${badge}</span>` : ''} ${time}</div>
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
  .avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; }
  .content { flex: 1; min-width: 0; }
  .header { font-size: 14px; line-height: 1.4; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .name { font-weight: 600; font-size: 15px; }
  .badge { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px; background: #222; color: #72767d; text-transform: uppercase; letter-spacing: .5px; }
  .time { font-size: 11px; color: #72767d; }
  .text { font-size: 15px; line-height: 1.5; word-wrap: break-word; color: #dcddde; margin-top: 1px; }
  .text strong { font-weight: 700; color: #fff; }
  .text em { font-style: italic; }
  .text u { text-decoration: underline; }
  .text s { text-decoration: line-through; }
  .text a { color: #00AFFA; text-decoration: none; }
  .text a:hover { text-decoration: underline; }
  .text code { background: #222; padding: 1px 4px; border-radius: 3px; font-size: 85%; font-family: 'Consolas', 'Courier New', monospace; }
  .text pre { background: #111; padding: 10px; border-radius: 6px; overflow-x: auto; margin: 6px 0; border: 1px solid #222; }
  .text pre code { background: none; padding: 0; border-radius: 0; font-size: 13px; }
  .text blockquote { border-left: 4px solid #5865F2; padding-left: 10px; margin: 4px 0; color: #b5bac1; }
  .text .spoiler { background: #222; color: transparent; border-radius: 3px; padding: 0 2px; cursor: pointer; }
  .text .spoiler:hover { color: #dcddde; background: #333; }
  .text .mention { background: #5865F2/20; background: rgba(88,101,242,.15); color: #dee0fc; padding: 0 3px; border-radius: 3px; font-weight: 500; }
  .text .emoji { width: 22px; height: 22px; vertical-align: middle; object-fit: contain; }
  .media { max-width: 100%; max-height: 300px; border-radius: 8px; margin: 4px 0; display: block; }
  .file-link { color: #00AFFA; text-decoration: none; font-size: 14px; display: inline-block; margin: 2px 0; }
  .file-link:hover { text-decoration: underline; }
  .sticker { max-width: 160px; max-height: 160px; border-radius: 8px; margin: 4px 0; display: block; }
  .embed { background: #111; border-left: 4px solid #333; border-radius: 4px; padding: 8px 12px; margin: 6px 0; max-width: 520px; }
  .embed-author { font-size: 13px; color: #b5bac1; margin-bottom: 2px; display: flex; align-items: center; gap: 4px; }
  .embed-author a { color: #b5bac1; text-decoration: none; }
  .embed-author a:hover { text-decoration: underline; }
  .embed-author-icon { width: 20px; height: 20px; border-radius: 50%; }
  .embed-title { font-size: 15px; font-weight: 600; color: #00AFFA; margin-bottom: 4px; }
  .embed-title a { color: #00AFFA; text-decoration: none; }
  .embed-title a:hover { text-decoration: underline; }
  .embed-desc { font-size: 14px; color: #dcddde; line-height: 1.4; margin-bottom: 4px; }
  .embed-field { margin: 4px 0; }
  .embed-field.inline { display: inline-block; width: 50%; vertical-align: top; padding-right: 8px; }
  .embed-field-name { font-size: 13px; font-weight: 600; color: #dcddde; display: block; }
  .embed-field-value { font-size: 13px; color: #b5bac1; display: block; white-space: pre-wrap; }
  .embed-image { max-width: 100%; max-height: 300px; border-radius: 4px; margin: 4px 0; display: block; }
  .embed-thumb { max-width: 80px; max-height: 80px; border-radius: 4px; float: right; margin: 0 0 4px 8px; }
  .embed-footer { font-size: 12px; color: #72767d; margin-top: 4px; display: flex; align-items: center; gap: 4px; }
  .embed-footer-icon { width: 16px; height: 16px; border-radius: 50%; }
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
