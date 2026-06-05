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

function renderContent(content, attachments, embeds, stickers, userMap) {
  let html = '';

  if (content) {
    let processed = escapeHtml(content);
    processed = processed.replace(/&lt;(a?):(\w+):(\d+)&gt;/g, (_, a, name, id) =>
      `<img class="emoji" src="https://cdn.discordapp.com/emojis/${id}.${a ? 'gif' : 'png'}?size=4096" alt=":${name}:" loading="lazy">`
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
        html += `<img class="media" src="${escapeHtml(a.url)}" alt="${escapeHtml(a.name)}" loading="lazy">`;
      } else if (a.contentType?.startsWith('video/')) {
        html += `<video class="media-video" src="${escapeHtml(a.url)}" controls preload="metadata" playsinline></video>`;
      } else if (a.contentType?.startsWith('audio/')) {
        html += `<audio class="media-audio" src="${escapeHtml(a.url)}" controls preload="metadata"></audio>`;
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
      const accent = e.hexColor || '#2b2d31';
      const accentBorder = e.hexColor || 'transparent';

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
        html += `<a class="embed embed-link" href="${escapeHtml(e.url)}" target="_blank" rel="noopener" style="--accent:${accent};--accent-border:${accentBorder}">${body}</a>`;
      } else {
        html += `<div class="embed" style="--accent:${accent};--accent-border:${accentBorder}">${body}</div>`;
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
      : thread.createdAt ? Math.floor(thread.createdAt.getTime() / 1000) : null;
    const tagLabelFromDb =
      ticketRow?.tag_label ||
      TICKET_TAGS.find((t) => t.value === ticketRow?.tag)?.label;

    const now = Math.floor(Date.now() / 1000);
    const threadLink = `https://discord.com/channels/${thread.guildId}/${thread.id}`;
    const finalTagLabel = tagLabelFromDb || tagLabel;
    const tag = thread.name.split('-').slice(0, -1).join('-') || 'ticket';
    const safeName = thread.name.replace(/[^a-zA-Z0-9_-]/g, '');
    const transcriptFileName = `${safeName}-transcript.html`;

    const components = [
      {
        type: 17,
        accent_color: 0x004225,
        components: [
          {
            type: 10,
            content: `# 🎫 ${tag.toUpperCase()} — Closed`
          },
          {
            type: 9,
            components: [
              {
                type: 10,
                content: [
                  `${POINTER} **Created by:** <@${creatorId}>`,
                  `${POINTER} **Closed by:** <@${resolverId}>`,
                  `${POINTER} **Tag:** ${finalTagLabel}`
                ].join('\n')
              }
            ],
            accessory: {
              type: 11,
              media: { url: this.discordClient.user?.displayAvatarURL({ extension: 'png', size: 128 }) }
            }
          },
          {
            type: 14,
            spacing: 1
          },
          {
            type: 10,
            content: [
              `${POINTER} **Created:** ${createdAtUnix ? `<t:${createdAtUnix}:F>` : '-'}`,
              `${POINTER} **Closed:** <t:${now}:F>`,
              `${POINTER} **Thread:** ${threadLink}`,
            ].join('\n')
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
          file: { url: `attachment://${transcriptFileName}` }
        });
      }
    }

    await this.webhookService.sendWithRetry(webhook, payload).catch(() => null);
  }

  buildTranscriptFile(thread, creatorId, resolverId, messages, createdAtUnix, now, tagLabel) {
    const sorted = [...messages.values()].reverse();
    const tag = thread.name.split('-').slice(0, -1).join('-') || 'ticket';
    const safeName = thread.name.replace(/[^a-zA-Z0-9_-]/g, '');
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
      const time = `<span class="time" data-timestamp="${unix}"><t:${unix}:F></span>`;
      const name = msg.author.username;
      const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 128 });
      const isCreator = msg.author.id === creatorId;
      const isStaff = msg.member?.roles?.cache?.hasAny?.(...staffRoleIds) ?? false;
      const color = isCreator ? '#004225' : '#7D1B36';
      const badge = isCreator ? 'OP' : isStaff ? 'STAFF' : '';
      const content = renderContent(msg.content, [...msg.attachments.values()], msg.embeds, [...msg.stickers.values()], userMap);

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
  body {
    font-family: -apple-system, 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    background: #0a0a0c;
    color: #e3e5e8;
    padding: 32px 20px;
    -webkit-font-smoothing: antialiased;
  }
  .messages { max-width: 800px; margin: 0 auto; }

  .header-emojis {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 2px;
    flex-wrap: wrap;
    line-height: 1;
    margin-bottom: 20px;
    text-align: center;
  }
  .header-emojis .h-emoji {
    width: 36px;
    height: 36px;
    vertical-align: middle;
    object-fit: contain;
  }
  .header-emojis .h-ticket { display: inline-flex; gap: 0; }

  .message {
    display: flex;
    gap: 14px;
    padding: 8px 16px;
    border-radius: 10px;
    transition: background .15s;
  }
  .message:hover { background: rgba(255,255,255,.03); }
  .avatar {
    width: 40px; height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 2px;
    box-shadow: 0 0 0 1px rgba(255,255,255,.06);
  }
  .content { flex: 1; min-width: 0; }
  .header {
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
    line-height: 1.3;
  }
  .name { font-weight: 700; font-size: 15px; }
  .badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: .6px;
    background: rgba(255,255,255,.06);
    color: #b5bac1;
  }
  .time {
    font-size: 11px;
    color: #6d6f78;
    font-weight: 400;
  }

  .text {
    font-size: 15px;
    line-height: 1.55;
    word-wrap: break-word;
    color: #dbdee1;
    margin-top: 2px;
  }
  .text strong { font-weight: 700; color: #fff; }
  .text em { font-style: italic; }
  .text u { text-decoration: underline; text-underline-offset: 2px; text-decoration-thickness: 1.5px; }
  .text s { text-decoration: line-through; }
  .text a { color: #00AFFA; text-decoration: none; font-weight: 500; }
  .text a:hover { text-decoration: underline; }
  .text h1, .text h2, .text h3 { color: #fff; font-weight: 700; margin: 10px 0 4px; line-height: 1.3; }
  .text h1 { font-size: 22px; }
  .text h2 { font-size: 18px; }
  .text h3 { font-size: 16px; }
  .text .subtext { color: #6d6f78; font-size: 13px; margin: 4px 0; }
  .text ul, .text ol { margin: 4px 0 4px 20px; color: #dbdee1; }
  .text li { margin: 2px 0; }
  .text code {
    background: #1e1e22;
    padding: 2px 6px;
    border-radius: 5px;
    font-size: 85%;
    font-family: 'JetBrains Mono', 'Consolas', 'Courier New', monospace;
    color: #c9d1d9;
    border: 1px solid #2a2a30;
  }
  .text pre {
    background: #0e0e12;
    padding: 14px 16px;
    border-radius: 10px;
    overflow-x: auto;
    margin: 8px 0;
    border: 1px solid #1e1e24;
  }
  .text pre code {
    background: none; padding: 0; border-radius: 0;
    font-size: 13px; border: none; color: #c9d1d9;
  }
  .text blockquote {
    border-left: 4px solid #5865F2;
    padding: 6px 0 6px 14px;
    margin: 6px 0;
    color: #b5bac1;
    background: rgba(88,101,242,.04);
    border-radius: 0 8px 8px 0;
  }
  .text blockquote.bq-multi {
    border-left: 4px solid #5865F2;
    padding: 10px 14px;
    margin: 6px 0;
    color: #b5bac1;
    background: rgba(88,101,242,.04);
    border-radius: 8px;
  }
  .text .spoiler {
    background: #2a2a30;
    color: transparent;
    border-radius: 4px;
    padding: 0 4px;
    cursor: pointer;
    transition: color .2s, background .2s;
  }
  .text .spoiler:hover { color: #dbdee1; background: #3a3a44; }
  .text .mention {
    background: rgba(88,101,242,.15);
    color: #dee0fc;
    padding: 1px 5px;
    border-radius: 5px;
    font-weight: 500;
    font-size: 14px;
  }
  .text .emoji {
    width: 32px; height: 32px;
    vertical-align: middle;
    object-fit: contain;
  }

  .media {
    max-width: 100%;
    max-height: 340px;
    border-radius: 12px;
    margin: 6px 0;
    display: block;
    border: 1px solid #1e1e24;
    transition: opacity .2s;
  }
  .media:hover { opacity: .92; }
  .media-video {
    max-width: 100%;
    max-height: 440px;
    border-radius: 12px;
    margin: 6px 0;
    display: block;
    border: 1px solid #1e1e24;
    width: 100%;
    background: #000;
    color-scheme: dark;
  }

  .media-audio {
    width: 100%;
    margin: 6px 0;
    border-radius: 8px;
    background: #111;
    color-scheme: dark;
  }
  .file-link {
    color: #00AFFA;
    text-decoration: none;
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin: 3px 0;
    padding: 4px 10px;
    background: rgba(0,175,250,.06);
    border-radius: 8px;
    transition: background .15s;
  }
  .file-link:hover { background: rgba(0,175,250,.12); text-decoration: none; }
  .sticker {
    max-width: 200px;
    max-height: 200px;
    border-radius: 10px;
    margin: 6px 0; display: block;
  }

  .embed {
    background: #0e0e12;
    border: 1px solid #1e1e24;
    border-left: 4px solid var(--accent-border, #2b2d31);
    border-radius: 8px;
    margin: 8px 0;
    overflow: hidden;
    width: fit-content;
    max-width: 100%;
    text-decoration: none;
    color: inherit;
    display: block;
    transition: border-color .15s;
  }
  .embed-link:hover { border-color: #3a3a44; }
  .embed-body { padding: 12px 16px 12px 14px; display: flex; flex-direction: column; gap: 5px; }
  .e-author {
    font-size: 13px; color: #b5bac1;
    display: flex; align-items: center; gap: 6px;
  }
  .e-author a { color: #b5bac1; text-decoration: none; }
  .e-author a:hover { text-decoration: underline; }
  .e-author-icon { width: 20px; height: 20px; border-radius: 50%; }
  .e-title { font-size: 15px; font-weight: 700; color: #e3e5e8; line-height: 1.3; }
  .e-title a { color: #00AFFA; text-decoration: none; }
  .e-title a:hover { text-decoration: underline; }
  .e-desc { font-size: 14px; color: #b5bac1; line-height: 1.45; }
  .e-fields { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 2px; }
  .e-field { flex: 1 1 100%; }
  .e-field.e-inline { flex: 1 1 calc(50% - 10px); min-width: 170px; }
  .e-fn { font-size: 13px; font-weight: 700; color: #dbdee1; margin-bottom: 1px; }
  .e-fv { font-size: 13px; color: #b5bac1; line-height: 1.4; white-space: pre-wrap; }
  .e-image { max-width: 100%; display: block; margin-top: 4px; border-radius: 4px; }
  .e-thumb {
    max-width: 80px; max-height: 80px;
    border-radius: 6px;
    float: right;
    margin: 0 0 4px 10px;
  }
  .e-footer {
    font-size: 12px; color: #6d6f78;
    display: flex; align-items: center; gap: 6px;
    margin-top: 2px;
  }
  .e-footer-icon { width: 16px; height: 16px; border-radius: 50%; }
  .e-ts::before { content: '·'; margin-right: 6px; color: #6d6f78; }

  .footer {
    text-align: center;
    color: #6d6f78;
    font-size: 12px;
    margin-top: 40px;
    padding: 16px 16px 4px;
    border-top: 1px solid #1a1a1e;
  }
  .footer-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px 16px; margin-top: 6px; }
  .footer-row:first-of-type { margin-top: 0; }
  .footer-item { display: inline-flex; align-items: center; gap: 3px; }
  .footer-item .lbl { color: #6d6f78; }
  .footer-item .val { color: #b5bac1; font-weight: 500; }

  @media (max-width: 600px) {
    body { padding: 16px 10px; }
    .header-emojis { gap: 1px; }
    .header-emojis .h-emoji { width: 28px; height: 28px; }
    .message { padding: 6px 10px; }
    .e-field.e-inline { flex: 1 1 100%; }
    .footer-row { gap: 2px 8px; font-size: 11px; }
  }
</style>
</head>
<body>
<div class="messages">
  <div class="header-emojis">
    <img class="h-emoji" src="https://cdn.discordapp.com/emojis/1503044372487471328.png?size=4096" alt=":Empty:" loading="lazy">
    <img class="h-emoji" src="https://cdn.discordapp.com/emojis/1503044372487471328.png?size=4096" alt=":Empty:" loading="lazy">
    <img class="h-emoji" src="https://cdn.discordapp.com/emojis/1503044372487471328.png?size=4096" alt=":Empty:" loading="lazy">
    <img class="h-emoji" src="https://cdn.discordapp.com/emojis/1503090874417152020.gif?size=4096" alt=":Sparkle2:" loading="lazy">
    <span class="h-ticket">
      <img class="h-emoji" src="https://cdn.discordapp.com/emojis/1503003731887788072.png?size=4096" alt=":Ticket1:" loading="lazy">
      <img class="h-emoji" src="https://cdn.discordapp.com/emojis/1503003714213118104.png?size=4096" alt=":Ticket2:" loading="lazy">
    </span>
    <img class="h-emoji" src="https://cdn.discordapp.com/emojis/1503090874417152020.gif?size=4096" alt=":Sparkle2:" loading="lazy">
  </div>
  ${body}
  <div class="footer">
    <div class="footer-row">
      <div class="footer-item"><span class="lbl">Created by</span> <span class="val">${escapeHtml(creatorId)}</span></div>
      <div class="footer-item"><span class="lbl">·</span></div>
      <div class="footer-item"><span class="lbl">Closed by</span> <span class="val">${escapeHtml(resolverId)}</span></div>
    </div>
    <div class="footer-row">
      <div class="footer-item"><span class="lbl">Created</span> <span class="val">${createdAtUnix ? new Date(createdAtUnix * 1000).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</span></div>
      <div class="footer-item"><span class="lbl">·</span></div>
      <div class="footer-item"><span class="lbl">Closed</span> <span class="val">${new Date(now * 1000).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
      <div class="footer-item"><span class="lbl">·</span></div>
      <div class="footer-item"><span class="lbl">Messages</span> <span class="val">${sorted.filter(m => !m.author.bot).length}</span></div>
      <div class="footer-item"><span class="lbl">·</span></div>
      <div class="footer-item"><span class="lbl">Tag</span> <span class="val">${escapeHtml(tagLabel)}</span></div>
    </div>
  </div>
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
