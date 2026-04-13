import { EmbedBuilder, MessageFlags } from 'discord.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimString(value, maxLength = 1000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeContainerBlocks(blocks) {
  if (!Array.isArray(blocks)) {
    return [];
  }

  return blocks
    .map((block) => ({
      type: String(block?.type ?? '').trim(),
      content: trimString(block?.content, 2000)
    }))
    .filter((block) => block.type === 'text' || block.type === 'image' || block.type === 'separator');
}

function buildContainerComponents(blocks) {
  const components = [];

  for (const block of normalizeContainerBlocks(blocks)) {
    if (block.type === 'text' && block.content) {
      components.push({
        type: 10,
        content: block.content
      });
      continue;
    }

    if (block.type === 'image' && block.content) {
      components.push({
        type: 12,
        items: [
          {
            media: { url: block.content },
            description: 'Announcement image'
          }
        ]
      });
      continue;
    }

    if (block.type === 'separator') {
      components.push({
        type: 14,
        divider: true,
        spacing: 1
      });
    }
  }

  if (!components.length) {
    return [];
  }

  return [{
    type: 17,
    components
  }];
}

function normalizeColor(value) {
  const raw = trimString(value, 16).replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(raw)) {
    return null;
  }

  return Number.parseInt(raw, 16);
}

function normalizeEntry(rawEntry = {}) {
  const type = rawEntry?.type === 'embed' || rawEntry?.type === 'container'
    ? rawEntry.type
    : 'normal';

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
      color: normalizeColor(rawEntry?.embed?.color)
    },
    container_blocks: normalizeContainerBlocks(rawEntry?.container_blocks)
  };
}

function normalizePayload(rawPayload = {}) {
  const channelIds = Array.isArray(rawPayload?.channel_ids)
      ? Array.from(new Set(rawPayload.channel_ids.map((value) => trimString(value, 32)).filter(Boolean)))
      : [];

  const entries = Array.isArray(rawPayload?.entries)
      ? rawPayload.entries.map(normalizeEntry).filter((entry) => {
          if (entry.type === 'normal') return Boolean(entry.content);
          if (entry.type === 'embed') return Boolean(entry.embed.title || entry.embed.description || entry.embed.image_url || entry.embed.footer_text);
          return entry.container_blocks.length > 0;
        })
      : [];

  return {
    channel_ids: channelIds,
    entries
  };
}

function parseMessageLink(link) {
  const match = String(link ?? '').trim().match(/discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/i);
  if (!match) {
    return null;
  }

  return {
    guildId: match[1],
    channelId: match[2],
    messageId: match[3]
  };
}

function buildEntryPayload(entry) {
  const payload = {
    allowedMentions: { parse: [] }
  };

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
  if (!components.length) {
    return null;
  }

  payload.content = '';
  payload.embeds = [];
  payload.flags = MessageFlags.IsComponentsV2;
  payload.components = components;
  return payload;
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
      if (channel?.isTextBased()) {
        channels.push(channel);
      }
    }

    return channels;
  }

  async sendEntry(channel, entry) {
    const payload = buildEntryPayload(entry);
    if (!payload) {
      return;
    }

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

    const payload = buildEntryPayload(entry);
    if (!payload) {
      throw new Error('Add at least one container block before editing this message.');
    }

    await message.edit(payload);
  }

  async send(guildId, rawPayload) {
    const payload = normalizePayload(rawPayload);
    const newEntries = payload.entries.filter((entry) => !entry.edit_existing);
    const editEntries = payload.entries.filter((entry) => entry.edit_existing);

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

    const channels = payload.channel_ids.length
      ? await this.resolveChannels(guild, payload.channel_ids)
      : [];
    if (!channels.length && newEntries.length > 0) {
      throw new Error('None of the selected channels could be used.');
    }

    let editedMessages = 0;
    let deliveredChannels = 0;
    let failedChannels = 0;
    let failedEdits = 0;
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

    if (editedMessages === 0 && deliveredChannels === 0 && (failedEdits > 0 || failedChannels > 0)) {
      throw new Error(firstFailureMessage || 'Announcement delivery failed.');
    }

    return {
      requested_channels: payload.channel_ids.length,
      delivered_channels: deliveredChannels,
      failed_channels: failedChannels,
      message_count: newEntries.length,
      edited_messages: editedMessages,
      failed_edits: failedEdits
    };
  }
}
