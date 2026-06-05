import logger from '../services/logging-service.js';
import { buildErrorPayload, buildSuccessPayload } from '../components/payloads.js';
import { isTicketStaffFromInteraction } from '../utils/permissions.js';
import { isThreadNameClosed, markThreadNameClosed } from '../utils/thread-utils.js';
import { AUTO_ARCHIVE_1H, ERROR_MESSAGES, TICKET_LOG_CHANNEL_ID, TICKET_TAGS, TICKET_STAFF_ROLE_IDS, getTicketColor } from '../utils/constants.js';

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

  const lists = [];
  text = text.replace(/(?:^|\n)((?: {0,2}[-*] .*(?:\n|$)){2,})/gm, (_, block) => {
    const items = block.trim().split('\n').map(l => l.replace(/^ {0,2}[-*] /, ''));
    lists.push(`<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`);
    return `\x00UL${lists.length - 1}\x00`;
  });

  const orderedLists = [];
  text = text.replace(/(?:^|\n)((?: {0,2}\d+\. .*(?:\n|$)){2,})/gm, (_, block) => {
    const items = block.trim().split('\n').map(l => l.replace(/^ {0,2}\d+\. /, ''));
    orderedLists.push(`<ol>${items.map(i => `<li>${i}</li>`).join('')}</ol>`);
    return `\x00OL${orderedLists.length - 1}\x00`;
  });

  text = text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^-# (.+)$/gm, '<div class="subtext">$1</div>')
    .replace(/^\|\|(.+?)\|\|$/gs, '<span class="spoiler">$1</span>')
    .replace(/\|\|(.+?)\|\|/gs, '<span class="spoiler">$1</span>')
    .replace(/~~(.+?)~~/gs, '<s>$1</s>')
    .replace(/__\*\*\*(.+?)\*\*\*__/gs, '<u><strong><em>$1</em></strong></u>')
    .replace(/__\*\*(.+?)\*\*__/gs, '<u><strong>$1</strong></u>')
    .replace(/__\*(.+?)\*__/gs, '<u><em>$1</em></u>')
    .replace(/___(.+?)___/gs, '<u><em>$1</em></u>')
    .replace(/__(.+?)__/gs, '<u>$1</u>')
    .replace(/\*\*\*(.+?)\*\*\*/gs, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/gs, '<em>$1</em>')
    .replace(/_(.+?)_/gs, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^&gt;&gt;&gt; (.+)$/gs, '<blockquote class="bq-multi">$1</blockquote>')
    .replace(/^(&gt;|>) (.+)$/gm, '<blockquote>$2</blockquote>');

  text = text.replace(/\x00UL(\d+)\x00/g, (_, i) => lists[i] || '');
  text = text.replace(/\x00OL(\d+)\x00/g, (_, i) => orderedLists[i] || '');
  text = text.replace(/\x00CB(\d+)\x00/g, (_, i) => codeBlocks[i] || '');
  text = text.replace(/\x00IC(\d+)\x00/g, (_, i) => inlineCodes[i] || '');
  return text;
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderContent(content, attachments, embeds, stickers, userMap) {
  let html = '';

  if (content) {
    let processed = escapeHtml(content);
    processed = processed.replace(/&lt;(a?):(\w+):(\d+)&gt;/g, (_, a, name, id) =>
      `<img class="emoji" src="https://cdn.discordapp.com/emojis/${id}.${a ? 'gif' : 'png'}?size=32" alt=":${name}:" loading="lazy">`
    );
    processed = processed.replace(/&lt;@!?(\d+)&gt;/g, (_, id) => {
      const display = userMap?.[id] || id;
      return `<span class="mention">@${escapeHtml(display)}</span>`;
    });
    processed = processed.replace(/&lt;#(\d+)&gt;/g, '<span class="mention">#$1</span>');
    processed = processed.replace(/&lt;@&amp;(\d+)&gt;/g, (_, id) => {
      const display = userMap?.[id] || id;
      return `<span class="mention">@${escapeHtml(display)}</span>`;
    });
    processed = convertMarkdown(processed);
    html += processed.replace(/\n/g, '<br>');
  }

  if (attachments?.length > 0) {
    for (const a of attachments) {
      if (a.contentType?.startsWith('image/')) {
        html += `<div class="attachment-card image-card">
          <img class="card-image" src="${escapeHtml(a.url)}" alt="${escapeHtml(a.name)}" loading="lazy">
          <div class="card-filename">${escapeHtml(a.name)}</div>
        </div>`;
      } else if (a.contentType?.startsWith('video/')) {
        html += `<div class="attachment-card video-card">
          <video class="card-video" src="${escapeHtml(a.url)}" controls preload="metadata" playsinline></video>
          <div class="card-meta">
            <span class="card-filename">${escapeHtml(a.name)}</span>
            <span class="card-size">${formatFileSize(a.size)}</span>
          </div>
        </div>`;
      } else if (a.contentType?.startsWith('audio/')) {
        html += `<div class="attachment-card audio-card">
          <div class="card-filename">${escapeHtml(a.name)}</div>
          <audio class="card-audio" src="${escapeHtml(a.url)}" controls preload="metadata"></audio>
        </div>`;
      } else {
        html += `<a class="file-card" href="${escapeHtml(a.url)}" target="_blank" rel="noopener">
          <div class="file-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8b949e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div class="file-info">
            <span class="card-filename">${escapeHtml(a.name)}</span>
            <span class="card-size">${formatFileSize(a.size)}</span>
          </div>
        </a>`;
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
      const accent = e.hexColor || '#2b2d31';

      let inner = '';
      if (e.author?.name) {
        inner += `<div class="e-author">${e.author.iconURL ? `<img src="${escapeHtml(e.author.iconURL)}" class="e-author-icon">` : ''}<span>${e.author.url ? `<a href="${escapeHtml(e.author.url)}" target="_blank" rel="noopener">${escapeHtml(e.author.name)}</a>` : escapeHtml(e.author.name)}</span></div>`;
      }
      if (e.title) {
        inner += `<div class="e-title">${e.url ? `<a href="${escapeHtml(e.url)}" target="_blank" rel="noopener">${escapeHtml(e.title)}</a>` : escapeHtml(e.title)}</div>`;
      }
      if (e.description) {
        inner += `<div class="e-desc">${escapeHtml(e.description).replace(/\n/g, '<br>')}</div>`;
      }
      if (e.fields?.length > 0) {
        inner += '<div class="e-fields">';
        for (const f of e.fields) {
          inner += `<div class="e-field${f.inline ? ' e-inline' : ''}"><div class="e-fn">${escapeHtml(f.name)}</div><div class="e-fv">${escapeHtml(f.value).replace(/\n/g, '<br>')}</div></div>`;
        }
        inner += '</div>';
      }

      if (e.thumbnail?.url) {
        inner += `<img class="e-thumb" src="${escapeHtml(e.thumbnail.url)}" alt="" loading="lazy">`;
      }

      let footerHtml = '';
      if (e.footer?.text || e.timestamp) {
        footerHtml += '<div class="e-footer">';
        if (e.footer?.iconURL) {
          footerHtml += `<img src="${escapeHtml(e.footer.iconURL)}" class="e-footer-icon">`;
        }
        if (e.footer?.text) {
          footerHtml += `<span>${escapeHtml(e.footer.text)}</span>`;
        }
        if (e.timestamp) {
          footerHtml += `<span class="e-ts">${new Date(e.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>`;
        }
        footerHtml += '</div>';
      }

      const img = e.image?.url ? `<img class="e-image" src="${escapeHtml(e.image.url)}" alt="" loading="lazy">` : '';

      const body = `<div class="embed-body">${inner}${footerHtml}${img}</div>`;
      if (e.url) {
        html += `<a class="embed embed-link" href="${escapeHtml(e.url)}" target="_blank" rel="noopener" style="--accent:${accent}">${body}</a>`;
      } else {
        html += `<div class="embed" style="--accent:${accent}">${body}</div>`;
      }
    }
  }

  return html || (embeds?.length > 0 || attachments?.length > 0 || stickers?.length > 0 ? '' : '[empty]');
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

    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);

    await channel.setName(markThreadNameClosed(channel.name)).catch(() => null);
    await channel.members.remove(creatorId).catch(() => null);
    await channel.setAutoArchiveDuration(AUTO_ARCHIVE_1H).catch(() => null);
    await channel.setLocked(true).catch(() => null);
    await channel.setArchived(true).catch(() => null);

    await this.ticketService.cooldownService.applyCooldown(creatorId).catch(() => null);
    await this.ticketService.resolveTicket(channel.id, interaction.user.id, creatorId).catch(() => null);
    await this.sendResolvedLog(channel, creatorId, interaction.user.id, messages);

    await interaction.editReply(buildSuccessPayload('Ticket has been closed.'));
  }

  async sendResolvedLog(thread, creatorId, resolverId, messages) {
    const logChannel = await this.discordClient.channels.fetch(TICKET_LOG_CHANNEL_ID).catch(() => null);
    if (!logChannel) return;
    const webhook = await this.webhookService.getOrCreateLogWebhook(logChannel).catch(() => null);
    if (!webhook) return;

    const ticketRow = await this.ticketService.getTicket(thread.id).catch(() => null);
    const createdAtUnix = ticketRow?.created_at
      ? Math.floor(new Date(ticketRow.created_at).getTime() / 1000)
      : thread.createdAt ? Math.floor(thread.createdAt.getTime() / 1000) : null;

    const now = Math.floor(Date.now() / 1000);
    const threadLink = `https://discord.com/channels/${thread.guildId}/${thread.id}`;
    const finalTagLabel =
      ticketRow?.tag_label ||
      TICKET_TAGS.find((t) => t.value === ticketRow?.tag)?.label ||
      'Unknown';
    const transcriptFileName = 'transcript.html';
    const creator = await this.discordClient.users.fetch(creatorId).catch(() => null);
    const avatarUrl = creator?.displayAvatarURL({ extension: 'png', size: 4096 }) || this.discordClient.user?.displayAvatarURL();

    const pointerLine = (label, value) => `<:Pointer:1502993771317694655> **${label}:** ${value}`;

    const components = [
      {
        type: 17,
        accent_color: getTicketColor(thread.id),
        components: [
          {
            type: 10,
            content: `# TICKET CLOSED`
          },
          {
            type: 9,
            components: [
              {
                type: 10,
                content: [
                  pointerLine('Creator', `<@${creatorId}>`),
                  pointerLine('Closed By', `<@${resolverId}>`),
                  pointerLine('Closed At', `<t:${now}:f>`),
                  pointerLine('Thread', threadLink)
                ].join('\n')
              }
            ],
            accessory: {
              type: 11,
              media: { url: avatarUrl }
            }
          }
        ]
      }
    ];

    const payload = {
      flags: 1 << 15,
      components,
      allowedMentions: { parse: [] },
      username: 'Ticket System',
      avatarURL: this.discordClient.user?.displayAvatarURL()
    };

    if (messages && messages.size > 0) {
      const file = this.buildTranscriptFile(thread, creatorId, resolverId, messages, createdAtUnix, now, finalTagLabel);
      if (file) {
        payload.files = [file];
        components[0].components.push({
          type: 13,
          file: { url: `attachment://transcript.html` }
        });
      }
    }

    await this.webhookService.sendWithRetry(webhook, payload).catch(() => null);
  }

  buildTranscriptFile(thread, creatorId, resolverId, messages, createdAtUnix, now, tagLabel) {
    const sorted = [...messages.values()].reverse();
    const staffRoleIds = new Set(TICKET_STAFF_ROLE_IDS);

    const userMap = {};
    for (const msg of messages.values()) {
      if (msg.author?.id) userMap[msg.author.id] = msg.member?.displayName || msg.author.username;
      if (msg.mentions) {
        for (const u of msg.mentions.users.values()) {
          const m = msg.mentions.members?.get(u.id);
          userMap[u.id] = m?.displayName || u.username;
        }
      }
    }

    let body = '';
    for (const msg of sorted) {
      if (msg.author.bot) continue;

      const unix = Math.floor(msg.createdAt.getTime() / 1000);
      const name = msg.author.username;
      const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 128 });
      const isCreator = msg.author.id === creatorId;
      const isStaff = msg.member?.roles?.cache?.hasAny?.(...staffRoleIds) ?? false;
      const color = isCreator ? '#004225' : '#7D1B36';
      const badge = isCreator ? 'OP' : isStaff ? 'STAFF' : '';
      const content = renderContent(msg.content, [...msg.attachments.values()], msg.embeds, [...msg.stickers.values()], userMap);

      body += `<div class="msg-group">
        <img class="msg-avatar" src="${avatar}" alt="" loading="lazy">
        <div class="msg-body">
          <div class="msg-header">
            <span class="msg-name" style="color:${color}">${escapeHtml(name)}</span>
            ${badge ? `<span class="msg-badge">${badge}</span>` : ''}
            <span class="msg-time">${new Date(unix * 1000).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
          <div class="msg-content">${content}</div>
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
  body {
    font-family: -apple-system, 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    background: #0d0e10;
    color: #e1e4e8;
    padding: 40px 24px;
    -webkit-font-smoothing: antialiased;
  }
  .container { max-width: 760px; margin: 0 auto; }

  /* Header */
  .header {
    text-align: center;
    margin-bottom: 40px;
    padding-bottom: 24px;
    border-bottom: 1px solid #1f2228;
  }
  .header-title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .header-icon {
    flex-shrink: 0;
  }
  .header h1 {
    font-size: 20px;
    font-weight: 600;
    color: #e1e4e8;
    letter-spacing: -0.3px;
  }
  .header .meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px 20px;
    margin-top: 10px;
    font-size: 13px;
    color: #6d7178;
  }

  /* Message groups */
  .msg-group {
    display: flex;
    gap: 12px;
    padding: 6px 0;
  }
  .msg-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 2px;
    background: #1f2228;
  }
  .msg-body {
    flex: 1;
    min-width: 0;
  }
  .msg-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 2px;
  }
  .msg-name {
    font-weight: 600;
    font-size: 14px;
  }
  .msg-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(255,255,255,.06);
    color: #8b949e;
    letter-spacing: .4px;
    text-transform: uppercase;
  }
  .msg-time {
    font-size: 11px;
    color: #6d7178;
    font-weight: 400;
  }
  .msg-content {
    font-size: 14px;
    line-height: 1.55;
    color: #d1d5da;
    word-wrap: break-word;
    margin-top: 1px;
  }
  .msg-content strong { font-weight: 600; color: #e1e4e8; }
  .msg-content em { font-style: italic; }
  .msg-content u { text-decoration: underline; text-underline-offset: 2px; }
  .msg-content s { text-decoration: line-through; }
  .msg-content a { color: #58a6ff; text-decoration: none; }
  .msg-content a:hover { text-decoration: underline; }
  .msg-content h1, .msg-content h2, .msg-content h3 { color: #e1e4e8; font-weight: 600; margin: 12px 0 4px; line-height: 1.3; }
  .msg-content h1 { font-size: 18px; }
  .msg-content h2 { font-size: 16px; }
  .msg-content h3 { font-size: 15px; }
  .msg-content .subtext { color: #6d7178; font-size: 12px; margin: 4px 0; }
  .msg-content ul, .msg-content ol { margin: 4px 0 4px 20px; }
  .msg-content li { margin: 2px 0; }
  .msg-content code {
    background: #16181d;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 85%;
    font-family: 'JetBrains Mono', 'Consolas', 'Courier New', monospace;
    color: #c9d1d9;
    border: 1px solid #21242b;
  }
  .msg-content pre {
    background: #0d0e10;
    padding: 14px 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 8px 0;
    border: 1px solid #1f2228;
  }
  .msg-content pre code {
    background: none; padding: 0; border-radius: 0;
    font-size: 12px; border: none; color: #c9d1d9;
  }
  .msg-content blockquote {
    border-left: 3px solid #30363d;
    padding: 4px 0 4px 12px;
    margin: 6px 0;
    color: #8b949e;
  }
  .msg-content .spoiler {
    background: #21242b;
    color: transparent;
    border-radius: 3px;
    padding: 0 4px;
    cursor: default;
  }
  .msg-content .spoiler:hover { color: #d1d5da; background: #30363d; }
  .msg-content .mention {
    background: rgba(56,139,253,.15);
    color: #58a6ff;
    padding: 1px 5px;
    border-radius: 4px;
    font-weight: 500;
    font-size: 13px;
  }
  .msg-content .emoji {
    width: 22px;
    height: 22px;
    vertical-align: middle;
    object-fit: contain;
  }

  /* Attachment cards */
  .attachment-card {
    background: #111318;
    border: 1px solid #1f2228;
    border-radius: 14px;
    overflow: hidden;
    margin: 8px 0;
    box-shadow: 0 2px 8px rgba(0,0,0,.25);
  }
  .card-image {
    display: block;
    width: 100%;
    max-height: 420px;
    object-fit: contain;
    background: #0a0b0d;
    cursor: pointer;
    transition: opacity .2s;
  }
  .card-image:hover { opacity: .92; }
  .card-video {
    display: block;
    width: 100%;
    max-height: 440px;
    background: #000;
  }
  .card-audio {
    display: block;
    width: 100%;
    margin-top: 8px;
  }
  .card-filename {
    font-size: 12px;
    color: #8b949e;
    padding: 8px 12px;
    border-top: 1px solid #1f2228;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .attachment-card .card-filename {
    border-top: 1px solid #1f2228;
  }
  .audio-card .card-filename {
    border-top: none;
    padding-bottom: 0;
  }
  .card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-top: 1px solid #1f2228;
  }
  .card-meta .card-filename {
    border-top: none;
    padding: 0;
    flex: 1;
    min-width: 0;
  }
  .card-size {
    font-size: 11px;
    color: #6d7178;
    flex-shrink: 0;
    margin-left: 8px;
  }

  /* File card */
  .file-card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #111318;
    border: 1px solid #1f2228;
    border-radius: 14px;
    padding: 12px 14px;
    margin: 8px 0;
    text-decoration: none;
    transition: border-color .2s;
    box-shadow: 0 2px 8px rgba(0,0,0,.25);
  }
  .file-card:hover { border-color: #30363d; }
  .file-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: #16181d;
    border-radius: 8px;
  }
  .file-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .file-info .card-filename {
    border-top: none;
    padding: 0;
    font-size: 13px;
    color: #d1d5da;
  }
  .file-info .card-size {
    font-size: 11px;
    color: #6d7178;
  }

  /* Sticker */
  .sticker {
    max-width: 150px;
    max-height: 150px;
    border-radius: 8px;
    margin: 6px 0;
    display: block;
  }

  /* Embeds */
  .embed {
    background: #111318;
    border: 1px solid #1f2228;
    border-radius: 14px;
    overflow: hidden;
    margin: 8px 0;
    max-width: 520px;
    text-decoration: none;
    color: inherit;
    display: block;
    box-shadow: 0 2px 8px rgba(0,0,0,.25);
  }
  .embed::before {
    content: '';
    display: block;
    height: 3px;
    background: var(--accent, #30363d);
  }
  .embed-link:hover { border-color: #30363d; }
  .e-author {
    font-size: 12px;
    color: #8b949e;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
  }
  .e-author a { color: #8b949e; text-decoration: none; }
  .e-author a:hover { text-decoration: underline; }
  .e-author-icon { width: 18px; height: 18px; border-radius: 50%; }
  .e-title {
    font-size: 15px;
    font-weight: 600;
    color: #e1e4e8;
    line-height: 1.35;
  }
  .e-title a { color: #58a6ff; text-decoration: none; }
  .e-title a:hover { text-decoration: underline; }
  .e-desc { font-size: 13px; color: #8b949e; line-height: 1.5; margin-top: 2px; }
  .e-fields { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 6px; }
  .e-field { flex: 1 1 100%; }
  .e-field.e-inline { flex: 1 1 calc(50% - 12px); min-width: 160px; }
  .e-fn { font-size: 12px; font-weight: 600; color: #d1d5da; margin-bottom: 1px; }
  .e-fv { font-size: 12px; color: #8b949e; line-height: 1.45; white-space: pre-wrap; }
  .e-image { max-width: 100%; display: block; margin-top: 4px; border-radius: 4px; }
  .e-thumb {
    max-width: 72px;
    max-height: 72px;
    border-radius: 6px;
    float: right;
    margin: 0 0 4px 10px;
  }
  .e-footer {
    font-size: 11px;
    color: #6d7178;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
  }
  .e-footer-icon { width: 14px; height: 14px; border-radius: 50%; }
  .e-ts::before { content: '·'; margin-right: 6px; color: #6d7178; }

  .embed-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 4px; }

  /* Footer */
  .footer {
    text-align: center;
    color: #6d7178;
    font-size: 12px;
    margin-top: 48px;
    padding: 20px 16px 4px;
    border-top: 1px solid #1f2228;
  }
  .footer-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 18px; margin-top: 6px; }
  .footer-row:first-of-type { margin-top: 0; }
  .footer-item { display: inline-flex; align-items: center; gap: 4px; }
  .footer-item .lbl { color: #6d7178; }
  .footer-item .val { color: #8b949e; font-weight: 500; }

  @media (max-width: 600px) {
    body { padding: 20px 12px; }
    .msg-group { gap: 10px; }
    .msg-avatar { width: 32px; height: 32px; }
    .msg-continued { padding-left: 42px; }
    .e-field.e-inline { flex: 1 1 100%; }
    .footer-row { gap: 2px 10px; font-size: 11px; }
    .header { margin-bottom: 24px; }
  }
</style>
</head>
<body>
<div class="container">
    <div class="header">
      <div class="header-title">
        <svg class="header-icon" width="22" height="22" viewBox="0 0 1536 1536" fill="#8b949e" xmlns="http://www.w3.org/2000/svg">
          <path d="M 775.0 1238.5 L 680.0 1234.5 L 594.0 1222.5 L 503.0 1197.5 L 445.0 1172.5 L 380.0 1132.5 L 329.5 1086.0 L 308.5 1060.0 L 287.5 1027.0 L 264.5 976.0 L 247.5 910.0 L 243.5 880.0 L 242.5 824.0 L 250.5 739.0 L 266.5 647.0 L 304.5 512.0 L 352.5 392.0 L 390.5 326.0 L 401.0 313.5 L 418.0 300.5 L 427.0 297.5 L 448.0 300.5 L 472.0 314.5 L 502.0 339.5 L 546.5 388.0 L 618.0 483.5 L 626.0 484.5 L 701.0 471.5 L 752.0 470.5 L 825.0 471.5 L 916.0 483.5 L 977.5 401.0 L 1033.0 340.5 L 1083.0 302.5 L 1095.0 297.5 L 1116.0 300.5 L 1133.0 311.5 L 1153.0 338.5 L 1184.5 397.0 L 1233.5 522.0 L 1269.5 655.0 L 1285.5 748.0 L 1293.5 825.0 L 1292.5 881.0 L 1288.5 910.0 L 1270.5 980.0 L 1247.5 1029.0 L 1226.5 1062.0 L 1205.5 1088.0 L 1155.0 1134.5 L 1090.0 1174.5 L 1032.0 1199.5 L 941.0 1224.5 L 855.0 1236.5 L 776.0 1239.5 Z"/>
        </svg>
        <h1>Ticket Transcript</h1>
      </div>
    <div class="meta">
      <span>${escapeHtml(tagLabel)}</span>
      <span>·</span>
      <span>${sorted.filter(m => !m.author.bot).length} messages</span>
      <span>·</span>
      <span>Created ${createdAtUnix ? new Date(createdAtUnix * 1000).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</span>
    </div>
  </div>
  ${body}
  <div class="footer">
    <div class="footer-row">
      <div class="footer-item"><span class="lbl">Created by</span> <span class="val">${escapeHtml(creatorId)}</span></div>
      <div class="footer-item"><span class="lbl">·</span></div>
      <div class="footer-item"><span class="lbl">Closed by</span> <span class="val">${escapeHtml(resolverId)}</span></div>
    </div>
    <div class="footer-row">
      <div class="footer-item"><span class="lbl">Closed</span> <span class="val">${new Date(now * 1000).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
      <div class="footer-item"><span class="lbl">·</span></div>
      <div class="footer-item"><span class="lbl">Tag</span> <span class="val">${escapeHtml(tagLabel)}</span></div>
    </div>
  </div>
</div>
</body>
</html>`;

    const buffer = Buffer.from(html, 'utf-8');
    return { attachment: buffer, name: 'transcript.html' };
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
