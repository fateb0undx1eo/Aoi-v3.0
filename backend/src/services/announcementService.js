import { EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle } from 'discord.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimString(value, maxLength = 1000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeColor(value) {
  const raw = trimString(value, 16).replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(raw)) {
    return null;
  }
  return Number.parseInt(raw, 16);
}

function normalizeFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields.slice(0, 25).map((f) => ({
    name: trimString(f.name, 256) || '\u200b',
    value: trimString(f.value, 1024) || '\u200b',
    inline: Boolean(f.inline),
  }));
}

function normalizeComponents(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!Array.isArray(row)) return [];
      return row
        .map((comp) => {
          if (!comp || !comp.type) return null;
          if (comp.type === 'button') {
            return {
              type: 'button',
              style: Math.min(Math.max(Number(comp.style) || 1, 1), 5),
              label: trimString(comp.label, 80),
              custom_id: trimString(comp.custom_id, 100),
              url: trimString(comp.url, 512),
              emoji: comp.emoji || null,
              disabled: Boolean(comp.disabled),
            };
          }
          if (comp.type === 'select') {
            return {
              type: 'select',
              custom_id: trimString(comp.custom_id, 100),
              placeholder: trimString(comp.placeholder, 150),
              min_values: Math.max(Number(comp.min_values) || 1, 0),
              max_values: Math.max(Number(comp.max_values) || 1, 1),
              disabled: Boolean(comp.disabled),
              options: (comp.options || []).slice(0, 25).map((opt) => ({
                label: trimString(opt.label, 100) || 'Option',
                value: trimString(opt.value, 100) || `opt_${Date.now()}`,
                description: opt.description ? trimString(opt.description, 100) : undefined,
                emoji: opt.emoji || undefined,
              })),
            };
          }
          return null;
        })
        .filter(Boolean);
    })
    .filter((row) => row.length > 0 && row.length <= 5);
}

function normalizeContainerBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .map((block) => ({
      type: String(block?.type ?? '').trim(),
      content: trimString(block?.content, 2000),
    }))
    .filter((block) => block.type === 'text' || block.type === 'image' || block.type === 'separator');
}

function buildContainerComponents(blocks) {
  const components = [];
  for (const block of normalizeContainerBlocks(blocks)) {
    if (block.type === 'text' && block.content) {
      components.push({ type: 10, content: block.content });
      continue;
    }
    if (block.type === 'image' && block.content) {
      components.push({ type: 12, items: [{ media: { url: block.content } }] });
      continue;
    }
    if (block.type === 'separator') {
      components.push({ type: 14, divider: true, spacing: 1 });
    }
  }
  if (!components.length) return [];
  return [{ type: 17, components }];
}

function hasLegacyType(entry) {
  return entry?.type === 'normal' || entry?.type === 'embed' || entry?.type === 'container';
}

function normalizeEntry(rawEntry = {}) {
  if (hasLegacyType(rawEntry)) {
    const type = rawEntry.type;
    return {
      id: trimString(rawEntry.id, 64),
      type,
      edit_existing: Boolean(rawEntry?.edit_existing),
      message_link: trimString(rawEntry?.message_link, 500),
      content: trimString(rawEntry.content, 2000),
      embed: {
        title: trimString(rawEntry?.embed?.title, 256),
        description: trimString(rawEntry?.embed?.description, 4000),
        footer_text: trimString(rawEntry?.embed?.footer_text, 2048),
        image_url: trimString(rawEntry?.embed?.image_url, 1000),
        color: normalizeColor(rawEntry?.embed?.color),
      },
      container_blocks: normalizeContainerBlocks(rawEntry?.container_blocks),
      components: [],
    };
  }

  return {
    id: trimString(rawEntry.id, 64),
    type: 'new',
    edit_existing: Boolean(rawEntry?.edit_existing),
    message_link: trimString(rawEntry?.message_link, 500),
    content: trimString(rawEntry.content, 2000),
    embed: {
      title: trimString(rawEntry?.embed?.title, 256),
      description: trimString(rawEntry?.embed?.description, 4000),
      url: trimString(rawEntry?.embed?.url, 1000),
      color: normalizeColor(rawEntry?.embed?.color),
      author_name: trimString(rawEntry?.embed?.author_name, 256),
      author_icon_url: trimString(rawEntry?.embed?.author_icon_url, 1000),
      author_url: trimString(rawEntry?.embed?.author_url, 1000),
      fields: normalizeFields(rawEntry?.embed?.fields),
      footer_text: trimString(rawEntry?.embed?.footer_text, 2048),
      footer_icon_url: trimString(rawEntry?.embed?.footer_icon_url, 1000),
      image_url: trimString(rawEntry?.embed?.image_url, 1000),
      thumbnail_url: trimString(rawEntry?.embed?.thumbnail_url, 1000),
      timestamp: trimString(rawEntry?.embed?.timestamp, 64),
    },
    container_blocks: [],
    components: normalizeComponents(rawEntry?.components),
  };
}

function normalizePayload(rawPayload = {}) {
  const channelIds = Array.isArray(rawPayload?.channel_ids)
    ? Array.from(new Set(rawPayload.channel_ids.map((value) => trimString(value, 32)).filter(Boolean)))
    : [];

  const entries = Array.isArray(rawPayload?.entries)
    ? rawPayload.entries.map(normalizeEntry).filter((entry) => {
        if (hasLegacyType(entry)) {
          if (entry.type === 'normal') return Boolean(entry.content);
          if (entry.type === 'embed') return Boolean(entry.embed.title || entry.embed.description || entry.embed.image_url || entry.embed.footer_text);
          return entry.container_blocks.length > 0;
        }
        return Boolean(entry.content) || Boolean(entry.embed.title || entry.embed.description || entry.embed.image_url || entry.embed.thumbnail_url || entry.embed.footer_text || entry.embed.author_name || entry.embed.fields.length > 0) || entry.components.length > 0;
      })
    : [];

  return { channel_ids: channelIds, entries };
}

function parseMessageLink(link) {
  const match = String(link ?? '').trim().match(/discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/i);
  if (!match) return null;
  return { guildId: match[1], channelId: match[2], messageId: match[3] };
}

function buildEmbed(embed) {
  const builder = new EmbedBuilder();
  if (embed.color !== null) builder.setColor(embed.color);
  if (embed.title) builder.setTitle(embed.title);
  if (embed.description) builder.setDescription(embed.description);
  if (embed.url) builder.setURL(embed.url);
  if (embed.author_name) {
    const authorOpts = { name: embed.author_name };
    if (embed.author_icon_url) authorOpts.iconURL = embed.author_icon_url;
    if (embed.author_url) authorOpts.url = embed.author_url;
    builder.setAuthor(authorOpts);
  }
  if (embed.fields.length > 0) builder.addFields(embed.fields);
  if (embed.footer_text) {
    const footerOpts = { text: embed.footer_text };
    if (embed.footer_icon_url) footerOpts.iconURL = embed.footer_icon_url;
    builder.setFooter(footerOpts);
  }
  if (embed.image_url) builder.setImage(embed.image_url);
  if (embed.thumbnail_url) builder.setThumbnail(embed.thumbnail_url);
  if (embed.timestamp) {
    try { builder.setTimestamp(new Date(embed.timestamp)); } catch {}
  }
  return builder;
}

function buildDiscordComponents(componentRows) {
  return componentRows.map((row) => {
    const actionRow = new ActionRowBuilder();
    const items = row.map((comp) => {
      if (comp.type === 'button') {
        const btn = new ButtonBuilder()
          .setStyle(comp.style)
          .setLabel(comp.label || '\u200b')
          .setDisabled(comp.disabled);
        if (comp.emoji) btn.setEmoji(comp.emoji);
        if (comp.style === ButtonStyle.Link) {
          btn.setURL(comp.url || 'https://discord.com');
        } else {
          btn.setCustomId(comp.custom_id || `btn_${Date.now()}`);
        }
        return btn;
      }
      if (comp.type === 'select') {
        const select = new StringSelectMenuBuilder()
          .setCustomId(comp.custom_id || `select_${Date.now()}`)
          .setPlaceholder(comp.placeholder || 'Select an option')
          .setMinValues(comp.min_values)
          .setMaxValues(comp.max_values)
          .setDisabled(comp.disabled);
        if (comp.options.length > 0) select.addOptions(comp.options);
        return select;
      }
      return null;
    }).filter(Boolean);
    actionRow.addComponents(items);
    return actionRow;
  });
}

function buildEntryPayload(entry) {
  if (hasLegacyType(entry)) {
    const payload = { allowedMentions: { parse: [] } };
    if (entry.type === 'normal') {
      payload.content = entry.content;
      payload.embeds = [];
      payload.components = [];
      return payload;
    }
    if (entry.type === 'embed') {
      const embed = new EmbedBuilder();
      if (entry.embed.color !== null) embed.setColor(entry.embed.color);
      if (entry.embed.title) embed.setTitle(entry.embed.title);
      if (entry.embed.description) embed.setDescription(entry.embed.description);
      if (entry.embed.footer_text) embed.setFooter({ text: entry.embed.footer_text });
      if (entry.embed.image_url) embed.setImage(entry.embed.image_url);
      payload.content = '';
      payload.embeds = [embed];
      payload.components = [];
      return payload;
    }
    const components = buildContainerComponents(entry.container_blocks);
    if (!components.length) return null;
    payload.content = '';
    payload.embeds = [];
    payload.flags = MessageFlags.IsComponentsV2;
    payload.components = components;
    return payload;
  }

  const payload = { allowedMentions: { parse: [] } };
  if (entry.content) payload.content = entry.content;
  if (entry.embed.title || entry.embed.description || entry.embed.fields.length > 0 || entry.embed.image_url || entry.embed.thumbnail_url || entry.embed.footer_text || entry.embed.author_name) {
    payload.embeds = [buildEmbed(entry.embed)];
  }
  if (entry.components.length > 0) {
    payload.components = buildDiscordComponents(entry.components);
  }
  return payload;
}

function buildComponentsV2EntryPayload(entry) {
  if (hasLegacyType(entry)) {
    const components = [];
    if (entry.type === 'normal') {
      if (entry.content) components.push({ type: 10, content: entry.content });
    } else if (entry.type === 'embed') {
      if (entry.embed.title) components.push({ type: 10, content: `## ${entry.embed.title}` });
      if (entry.embed.description) components.push({ type: 10, content: entry.embed.description });
      if (entry.embed.image_url) components.push({ type: 12, items: [{ media: { url: entry.embed.image_url } }] });
      if (entry.embed.footer_text) {
        if (components.length > 0) components.push({ type: 14, divider: true, spacing: 1 });
        components.push({ type: 10, content: `*${entry.embed.footer_text}*` });
      }
    } else {
      return buildEntryPayload(entry);
    }
    if (!components.length) return null;
    return { flags: MessageFlags.IsComponentsV2, components: [{ type: 17, components }], allowedMentions: { parse: [] } };
  }
  return buildEntryPayload(entry);
}

export class AnnouncementService {
  constructor({ client }) {
    this.client = client;
  }

  async resolveGuild(guildId) {
    return this.client.guilds.cache.get(guildId) ?? await this.client.guilds.fetch(guildId).catch(() => null);
  }

  async resolveChannels(guild, channelIds) {
    const channels = [];
    for (const channelId of channelIds) {
      const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
      if (channel?.isTextBased()) channels.push(channel);
    }
    return channels;
  }

  async sendEntry(channel, entry) {
    const payload = buildEntryPayload(entry);
    if (!payload) return;
    await channel.send(payload);
  }

  async editExistingEntry(guild, entry) {
    const link = parseMessageLink(entry.message_link);
    if (!link || link.guildId !== guild.id) {
      throw new Error('That message link is invalid for this server.');
    }
    const channel = guild.channels.cache.get(link.channelId) ?? await guild.channels.fetch(link.channelId).catch(() => null);
    if (!channel?.isTextBased()) {
      throw new Error('The target message channel could not be resolved.');
    }
    const message = await channel.messages.fetch(link.messageId).catch(() => null);
    if (!message) {
      throw new Error('The target message could not be found.');
    }
    if (message.author?.id !== this.client.user?.id) {
      throw new Error('Only messages sent by this bot can be edited.');
    }
    const payload = message.flags?.has?.(MessageFlags.IsComponentsV2)
      ? buildComponentsV2EntryPayload(entry)
      : buildEntryPayload(entry);
    if (!payload) {
      throw new Error('Add at least one message component before editing this message.');
    }
    await message.edit(payload);
  }

  async send(guildId, rawPayload) {
    const payload = normalizePayload(rawPayload);
    const newEntries = payload.entries.filter((entry) => !entry.edit_existing);
    const editEntries = payload.entries.filter((entry) => entry.edit_existing);
    const requestedChannels = newEntries.length > 0 ? payload.channel_ids.length : 0;

    if (!payload.channel_ids.length && newEntries.length > 0) {
      throw new Error('Select at least one target channel.');
    }
    if (!payload.entries.length) {
      throw new Error('Add at least one announcement message before sending.');
    }

    const guild = await this.resolveGuild(guildId);
    if (!guild) {
      throw new Error('Guild not found.');
    }

    const channels = newEntries.length > 0
      ? await this.resolveChannels(guild, payload.channel_ids)
      : [];
    if (!channels.length && newEntries.length > 0) {
      throw new Error('None of the selected channels could be used.');
    }

    let editedMessages = 0, deliveredChannels = 0, failedChannels = 0, failedEdits = 0;
    let firstFailureMessage = '';

    for (const entry of editEntries) {
      try {
        await this.editExistingEntry(guild, entry);
        editedMessages += 1;
      } catch (error) {
        failedEdits += 1;
        if (!firstFailureMessage) {
          firstFailureMessage = error instanceof Error ? error.message : 'Failed to edit the linked announcement message.';
        }
      }
    }

    if (newEntries.length > 0) {
      for (const channel of channels) {
        try {
          for (const entry of newEntries) {
            await this.sendEntry(channel, entry);
            await sleep(250);
          }
          deliveredChannels += 1;
        } catch (error) {
          failedChannels += 1;
          if (!firstFailureMessage) {
            firstFailureMessage = error instanceof Error ? error.message : 'Failed to send the announcement.';
          }
        }
        await sleep(500);
      }
    }

    if (editedMessages === 0 && deliveredChannels === 0 && (failedEdits > 0 || failedChannels > 0)) {
      throw new Error(firstFailureMessage || 'Announcement delivery failed.');
    }

    return {
      requested_channels: requestedChannels,
      delivered_channels: deliveredChannels,
      failed_channels: failedChannels,
      message_count: newEntries.length,
      edited_messages: editedMessages,
      failed_edits: failedEdits,
    };
  }
}
