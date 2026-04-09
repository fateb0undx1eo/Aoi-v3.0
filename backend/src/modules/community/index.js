import { EmbedBuilder, MessageFlags, WebhookClient } from 'discord.js';
import { randomUUID } from 'node:crypto';
import { env } from '../../core/config/env.js';

const DOMAIN_EXPANSION_PENDING_MS = 10 * 60 * 1000;
const DOMAIN_EXPANSION_MESSAGE_DELETE_MS = 15_000;
const DEADLY_GIF =
  'https://cdn.discordapp.com/attachments/1457404028760625327/1475165182077698108/ezgif-34f5623570ffe407.gif?ex=699c7e22&is=699b2ca2&hm=85b3a92f761fff6dc8f1e1e1e1e9549012ebeaa1bbb46e9545f7f80a876528b8';
const FREE_GIF =
  'https://media.discordapp.net/attachments/1489131113082261564/1490752931048325191/ezgif-5cd40aa21eb72603.gif?ex=69d5335b&is=69d3e1db&hm=c3c73e9688b19f8f4ada917dc65a656c8a3b7da25291b95a81d01df087c6d99b&=';
const DOMAIN_ACTION_PREFIX = 'domainexpansion:action';
const FREE_ACTION_PREFIX = 'free:action';
const MEME_ACTION_PREFIX = 'memes:autopost';
const pendingDomainExpansions = new Map();
const pendingFreeActions = new Map();
const pendingMemeAutopostActions = new Map();
const premiumFeatureCooldowns = new Map();

const COMMUNITY_SCHEMA = {
  type: 'object',
  properties: {
    messages: { type: 'object' },
    dm_welcomer: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        title: { type: 'string' },
        message: { type: 'string' },
        image_url: { type: 'string' }
      }
    },
    uwu: {
      type: 'object',
      properties: {
        delete_non_uwu: { type: 'boolean' },
        notify: { type: 'boolean' }
      }
    },
    staff_rating: {
      type: 'object',
      properties: {
        cooldown_seconds: { type: 'number' }
      }
    },
    role_color_rotation: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        interval_value: { type: 'number' },
        interval_unit: { type: 'string' },
        role_ids: { type: 'array', items: { type: 'string' } }
      }
    },
    meme_autopost: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        interval_value: { type: 'number' },
        interval_unit: { type: 'string' },
        channel_id: { type: 'string' },
        ping_role_id: { type: 'string' },
        subreddits: { type: 'array', items: { type: 'string' } }
      }
    },
    bot_looks: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        status: { type: 'string' },
        activity_type: { type: 'string' },
        activity_text: { type: 'string' },
        custom_status: { type: 'string' },
        streaming_url: { type: 'string' }
      }
    },
    announcements_studio: {
      type: 'object',
      properties: {
        presets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              kind: { type: 'string' },
              form: { type: 'object' }
            }
          }
        }
      }
    },
    premium_feature_1: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        cooldown_seconds: { type: 'number' },
        webhook_enabled: { type: 'boolean' },
        webhook_url: { type: 'string' },
        role_ids: { type: 'array', items: { type: 'string' } },
        triggers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              trigger: { type: 'string' },
              response_links: { type: 'array', items: { type: 'string' } },
              footer_text: { type: 'string' },
              delete_trigger_message: { type: 'boolean' },
              use_main_roles: { type: 'boolean' },
              role_ids: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    }
  }
};

function isUwuMessage(content) {
  return /uwu|owo|uvu/i.test(content);
}

function getStarDisplay(rating) {
  const filled = '★'.repeat(Math.floor(rating));
  const empty = '☆'.repeat(5 - Math.floor(rating));
  return filled + empty;
}

function buildEmbed(title, description, color) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function buildActionPromptComponents({ title, prompt, buttonRows, locked = false, actionLabel = '' }) {
  const components = [
    {
      type: 17,
      components: [
        {
          type: 10,
          content: `# ${title}`
        },
        {
          type: 14,
          divider: true,
          spacing: 1
        },
        {
          type: 10,
          content: prompt
        }
      ]
    }
  ];

  if (!locked && buttonRows?.length) {
    for (const row of buttonRows) {
      components[0].components.push({
        type: 1,
        components: row
      });
    }
  } else if (locked) {
    components[0].components.push({
      type: 10,
      content: actionLabel
        ? `Action selected: ${actionLabel}.`
        : 'This Domain Expansion has already been resolved.'
    });
  }

  return components;
}

function normalizePremiumTrigger(rawTrigger) {
  const responseLinks = Array.isArray(rawTrigger?.response_links)
    ? rawTrigger.response_links
      .map((value) => String(value ?? '').trim())
      .filter((value) => /^https?:\/\//i.test(value))
    : [];

  return {
    id: String(rawTrigger?.id ?? randomUUID()),
    trigger: String(rawTrigger?.trigger ?? '').trim(),
    response_links: Array.from(new Set(responseLinks)),
    footer_text: String(rawTrigger?.footer_text ?? '').trim().slice(0, 500),
    delete_trigger_message: Boolean(rawTrigger?.delete_trigger_message),
    use_main_roles: rawTrigger?.use_main_roles !== false,
    role_ids: Array.isArray(rawTrigger?.role_ids)
      ? Array.from(new Set(rawTrigger.role_ids.map((value) => String(value ?? '').trim()).filter(Boolean)))
      : []
  };
}

function normalizePremiumFeatureConfig(rawConfig) {
  const triggers = Array.isArray(rawConfig?.triggers)
    ? rawConfig.triggers
      .map(normalizePremiumTrigger)
      .filter((entry) => entry.trigger && entry.response_links.length > 0)
    : [];

  return {
    enabled: Boolean(rawConfig?.enabled),
    cooldown_seconds: Math.max(0, Math.min(3600, Number(rawConfig?.cooldown_seconds) || 0)),
    webhook_enabled: Boolean(rawConfig?.webhook_enabled) && /^https:\/\/discord(?:app)?\.com\/api\/webhooks\//i.test(String(rawConfig?.webhook_url ?? '').trim()),
    webhook_url: String(rawConfig?.webhook_url ?? '').trim(),
    role_ids: Array.isArray(rawConfig?.role_ids)
      ? Array.from(new Set(rawConfig.role_ids.map((value) => String(value ?? '').trim()).filter(Boolean)))
      : [],
    triggers
  };
}

function buildPremiumFeatureComponents(triggerConfig) {
  const components = [];

  if (triggerConfig.response_links.length > 0) {
    components.push({
      type: 12,
      items: triggerConfig.response_links.map((url) => ({
        media: { url }
      }))
    });
  }

  if (triggerConfig.footer_text) {
    if (components.length > 0) {
      components.push({
        type: 14,
        divider: true,
        spacing: 1
      });
    }

    components.push({
      type: 10,
      content: triggerConfig.footer_text
    });
  }

  return [{
    type: 17,
    components
  }];
}

function getPremiumFeatureCooldownKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

async function sendPremiumFeatureResponse({ message, config, triggerConfig }) {
  const payload = {
    flags: MessageFlags.IsComponentsV2,
    components: buildPremiumFeatureComponents(triggerConfig),
    allowedMentions: { parse: [] }
  };

  if (config.webhook_enabled && config.webhook_url) {
    const webhook = new WebhookClient({ url: config.webhook_url });
    try {
      await webhook.send(payload);
      return;
    } catch {
      await message.channel.send(payload).catch(() => null);
      return;
    }
  }

  await message.channel.send(payload).catch(() => null);
}

function buildAnnouncementComponents({ title, body, gifUrl }) {
  return [
    {
      type: 17,
      components: [
        {
          type: 10,
          content: `# ${title}`
        },
        {
          type: 14,
          divider: true,
          spacing: 1
        },
        {
          type: 12,
          items: [
            {
              media: { url: gifUrl },
              description: `${title} animation`
            }
          ]
        },
        {
          type: 14,
          divider: true,
          spacing: 1
        },
        {
          type: 10,
          content: body
        }
      ]
    }
  ];
}

function buildMemeAutopostControlEmbed(config, stats = []) {
  const latest = stats.slice(0, 5).map((row) => {
    const when = row.fetched_at ? new Date(row.fetched_at).toLocaleString() : 'unknown time';
    return `r/${row.subreddit}: ${row.result_count} result at ${when}`;
  }).join('\n');

  return buildEmbed(
    'Meme Autopost Status',
    [
      `Enabled: ${config.enabled ? 'Yes' : 'No'}`,
      `Channel: ${config.channel_id ? `<#${config.channel_id}>` : 'Not set'}`,
      `Ping Role: ${config.ping_role_id ? `<@&${config.ping_role_id}>` : 'None'}`,
      `Interval: every ${config.interval_value} ${config.interval_unit}`,
      `Subreddits: ${config.subreddits.length ? config.subreddits.map((subreddit) => `r/${subreddit}`).join(', ') : 'None configured'}`,
      '',
      latest || 'No recent autopost stats recorded yet.',
      '',
      'Use the buttons below to start or stop the autopost. Use the Community page on the dashboard to edit the channel, role, subreddits, or timing.'
    ].join('\n'),
    0x5865f2
  );
}

function buildMemeAutopostButtons(token, enabled) {
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          custom_id: `${MEME_ACTION_PREFIX}:${token}:start`,
          label: 'Start',
          style: 3,
          disabled: enabled
        },
        {
          type: 2,
          custom_id: `${MEME_ACTION_PREFIX}:${token}:stop`,
          label: 'Stop',
          style: 4,
          disabled: !enabled
        }
      ]
    }
  ];
}

function storePendingAction(store, data) {
  const token = randomUUID();
  const timeout = setTimeout(() => {
    store.delete(token);
  }, DOMAIN_EXPANSION_PENDING_MS);

  store.set(token, {
    ...data,
    timeout,
    createdAt: Date.now()
  });

  return token;
}

function clearPendingAction(store, token) {
  const pending = store.get(token);
  if (pending?.timeout) {
    clearTimeout(pending.timeout);
  }
  store.delete(token);
}

async function deleteRecentMessagesFromChannel(channel, targetId) {
  if (!channel?.isTextBased?.() || !channel.messages?.fetch || !channel.bulkDelete) {
    return { attempted: false, deletedCount: 0 };
  }

  const cutoff = Date.now() - (60 * 60 * 1000);
  let before;
  let deletedCount = 0;

  for (let batch = 0; batch < 10; batch += 1) {
    const messages = await channel.messages.fetch({
      limit: 100,
      ...(before ? { before } : {})
    });

    if (!messages.size) {
      break;
    }

    const deletable = messages.filter(
      (message) =>
        message.author?.id === targetId &&
        message.createdTimestamp >= cutoff
    );

    if (deletable.size) {
      const deleted = await channel.bulkDelete(deletable, true).catch(() => null);
      deletedCount += deleted?.size ?? 0;
    }

    const oldest = messages.last();
    if (!oldest || oldest.createdTimestamp < cutoff) {
      break;
    }

    before = oldest.id;
  }

  return { attempted: true, deletedCount };
}

export default {
  name: 'community',
  configSchema: COMMUNITY_SCHEMA,
  commands: [
    {
      name: 'leave',
      description: 'Configure leave message',
      options: [
        { name: 'channel', type: 7, description: 'Channel for leave messages', required: false }
      ],
      async execute(interaction, { services }) {
        const channel = interaction.options.getChannel('channel') || interaction.channel;

        await services.communityService.setMessageConfig(interaction.guildId, 'leave', {
          channel_id: channel.id,
          text: '{username} left {server_name}',
          enabled: true
        });

        await interaction.editReply({
          embeds: [
            buildEmbed(
              'Leave Message Configured',
              `Leave messages will now be sent to <#${channel.id}>.`,
              0x808080
            )
          ]
        });
      }
    },
    {
      name: 'boost',
      description: 'Configure boost message',
      options: [
        { name: 'channel', type: 7, description: 'Channel for boost messages', required: false }
      ],
      async execute(interaction, { services }) {
        const channel = interaction.options.getChannel('channel') || interaction.channel;

        await services.communityService.setMessageConfig(interaction.guildId, 'boost', {
          channel_id: channel.id,
          text: 'Thanks {mention} for boosting {server_name}',
          enabled: true
        });

        await interaction.editReply({
          embeds: [
            buildEmbed(
              'Boost Message Configured',
              `Boost messages will now be sent to <#${channel.id}>.\n\nPreview: Thanks <@${interaction.user.id}> for boosting ${interaction.guild.name}!`,
              0xf47fff
            )
          ]
        });
      }
    },
    {
      name: 'staffrate',
      description: 'Rate a staff member',
      options: [
        { name: 'user', type: 6, description: 'Staff member to rate', required: true },
        { name: 'rating', type: 4, description: 'Rating (1-5 stars)', required: true, min_value: 1, max_value: 5 },
        { name: 'comment', type: 3, description: 'Optional comment', required: false }
      ],
      async execute(interaction, { services }) {
        const user = interaction.options.getUser('user');
        const stars = interaction.options.getInteger('rating');
        const comment = interaction.options.getString('comment') || 'No comment provided';

        await services.communityService.addStaffRating(
          interaction.guildId,
          user.id,
          interaction.user.id,
          stars,
          comment
        );

        await interaction.editReply({
          embeds: [
            buildEmbed(
              'Staff Rating Submitted',
              `${getStarDisplay(stars)}\n\nStaff: <@${user.id}>\nComment: ${comment}`,
              0xfee75c
            )
          ]
        });
      }
    },
    {
      name: 'staffleaderboard',
      description: 'Show staff rating leaderboard',
      options: [],
      async execute(interaction, { services }) {
        const rows = await services.communityService.getStaffLeaderboard(interaction.guildId, 10);

        if (rows.length === 0) {
          await interaction.editReply('No staff ratings yet.');
          return;
        }

        const description = rows
          .map((row, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '•';
            return `${medal} <@${row.staffUserId}> - ${getStarDisplay(row.averageStars)} (${row.ratingsCount} ratings)`;
          })
          .join('\n');

        await interaction.editReply({
          embeds: [buildEmbed('Staff Leaderboard', description, 0xfee75c)]
        });
      }
    },
    {
      name: 'randomizedrolecolor',
      description: 'Enable or disable randomized role color rotation',
      options: [
        { name: 'enabled', type: 5, description: 'Whether randomized role color rotation should run', required: true }
      ],
      async execute(interaction, { services, configCache }) {
        const enabled = interaction.options.getBoolean('enabled', true);
        const config = await services.roleColorRotationService.updateGuildConfig(interaction.guildId, {
          enabled
        });
        await configCache.refreshGuild(interaction.guildId);

        const suffix = config.role_ids.length
          ? `Configured roles: ${config.role_ids.length}\nInterval: every ${config.interval_value} ${config.interval_unit}.`
          : 'No roles are configured yet. Use the community dashboard to choose roles and interval.';

        await interaction.editReply({
          embeds: [
            buildEmbed(
              enabled ? 'Randomized Role Color Enabled' : 'Randomized Role Color Disabled',
              suffix,
              enabled ? 0x57f287 : 0xed4245
            )
          ]
        });
      }
    },
    {
      name: 'memes',
      description: 'View meme autopost status',
      permissionOverrides: {
        discordPermissions: ['ManageGuild', 'ManageMessages']
      },
      options: [
        {
          name: 'autopost',
          type: 1,
          description: 'Show meme autopost status and recent stats'
        }
      ],
      async execute(interaction, { services }) {
        const subcommand = interaction.options.getSubcommand(true);
        if (subcommand !== 'autopost') {
          await interaction.editReply('Unsupported memes action.');
          return;
        }

        const { config, stats } = await services.memeService.getAutopostStatus(interaction.guildId);
        const token = storePendingAction(pendingMemeAutopostActions, {
          guildId: interaction.guildId,
          issuerId: interaction.user.id
        });

        await interaction.editReply({
          embeds: [buildMemeAutopostControlEmbed(config, stats)],
          components: buildMemeAutopostButtons(token, config.enabled)
        });
      }
    },
    {
      name: 'domain-expansion',
      description: 'Activate a Domain Expansion',
      ephemeral: true,
      options: [
        {
          name: 'technique',
          type: 3,
          description: 'Choose a domain',
          required: true,
          choices: [
            {
              name: 'Deadly Sentencing (Higuruma)',
              value: 'deadly'
            }
          ]
        },
        {
          name: 'target',
          type: 6,
          description: 'User to judge',
          required: true
        }
      ],
      async execute(interaction) {
        const domainRoleId = env.discord.domainExpansionRoleId;
        const accusedRoleId = env.discord.accusedRoleId;

        if (!domainRoleId) {
          await interaction.editReply('DOMAIN_EXPANSION is missing in the backend environment.');
          return;
        }

        if (!accusedRoleId) {
          await interaction.editReply('ACCUSED_ROLE is missing in the backend environment.');
          return;
        }

        if (!interaction.member.roles.cache.has(domainRoleId)) {
          await interaction.editReply('You lack authority to expand a Domain.');
          return;
        }

        const technique = interaction.options.getString('technique', true);
        const target = interaction.options.getUser('target', true);
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) {
          await interaction.editReply('That user could not be found in this server.');
          return;
        }

        const accusedRole = interaction.guild.roles.cache.get(accusedRoleId)
          ?? (await interaction.guild.roles.fetch(accusedRoleId).catch(() => null));
        if (!accusedRole) {
          await interaction.editReply('The configured ACCUSED_ROLE does not exist in this server.');
          return;
        }

        if (accusedRole.managed || !accusedRole.editable) {
          await interaction.editReply('The configured ACCUSED_ROLE cannot be managed by this bot.');
          return;
        }

        if (technique !== 'deadly') {
          await interaction.editReply('That domain technique is not supported yet.');
          return;
        }

        const token = storePendingAction(pendingDomainExpansions, {
          guildId: interaction.guildId,
          issuerId: interaction.user.id,
          targetId: target.id,
          accusedRoleId,
          technique,
          channelId: interaction.channelId
        });

        await interaction.editReply({
          flags: MessageFlags.IsComponentsV2,
          components: buildActionPromptComponents({
            title: 'Domain Expansion: Deadly Sentencing',
            prompt:
              `Do you really want to do this to <@${target.id}>?\n\n` +
              'YES: apply the accused role.\n' +
              'YES+: apply the accused role and delete the target user\'s last hour of messages in this channel.',
            buttonRows: [[
              {
                type: 2,
                custom_id: `${DOMAIN_ACTION_PREFIX}:${token}:apply`,
                label: 'YES',
                style: 1
              },
              {
                type: 2,
                custom_id: `${DOMAIN_ACTION_PREFIX}:${token}:purge`,
                label: 'YES+',
                style: 4
              }
            ]]
          }),
          allowedMentions: {
            users: [target.id]
          }
        });
      }
    },
    {
      name: 'free',
      description: 'Free a user from the accused role',
      ephemeral: true,
      options: [
        {
          name: 'target',
          type: 6,
          description: 'User to free',
          required: true
        }
      ],
      async execute(interaction) {
        const domainRoleId = env.discord.domainExpansionRoleId;
        const accusedRoleId = env.discord.accusedRoleId;

        if (!domainRoleId) {
          await interaction.editReply('DOMAIN_EXPANSION is missing in the backend environment.');
          return;
        }

        if (!accusedRoleId) {
          await interaction.editReply('ACCUSED_ROLE is missing in the backend environment.');
          return;
        }

        if (!interaction.member.roles.cache.has(domainRoleId)) {
          await interaction.editReply('You lack authority to free this user.');
          return;
        }

        const target = interaction.options.getUser('target', true);
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) {
          await interaction.editReply('That user could not be found in this server.');
          return;
        }

        const accusedRole = interaction.guild.roles.cache.get(accusedRoleId)
          ?? (await interaction.guild.roles.fetch(accusedRoleId).catch(() => null));
        if (!accusedRole) {
          await interaction.editReply('The configured ACCUSED_ROLE does not exist in this server.');
          return;
        }

        if (accusedRole.managed || !accusedRole.editable) {
          await interaction.editReply('The configured ACCUSED_ROLE cannot be managed by this bot.');
          return;
        }

        if (!member.roles.cache.has(accusedRole.id)) {
          await interaction.editReply('That user does not currently have the accused role.');
          return;
        }

        const token = storePendingAction(pendingFreeActions, {
          guildId: interaction.guildId,
          issuerId: interaction.user.id,
          targetId: target.id,
          accusedRoleId,
          channelId: interaction.channelId
        });

        await interaction.editReply({
          flags: MessageFlags.IsComponentsV2,
          components: buildActionPromptComponents({
            title: 'You wanna let them out?',
            prompt:
              `Do you want to free the user <@${target.id}>?\n\n` +
              'YES: click this to free the user.',
            buttonRows: [[
              {
                type: 2,
                custom_id: `${FREE_ACTION_PREFIX}:${token}:release`,
                label: 'YES',
                style: 3
              }
            ]]
          }),
          allowedMentions: {
            users: [target.id]
          }
        });
      }
    }
  ],
  events: [
    {
      name: 'guildMemberAdd',
      async execute(member, { services, placeholderEngine }) {
        const config = await services.configService.getModuleConfig(member.guild.id, 'community').catch(() => null);
        const dmWelcomerConfig = config?.config?.dm_welcomer;
        if (!dmWelcomerConfig?.enabled || !dmWelcomerConfig?.message) return;

        const description = placeholderEngine.render(dmWelcomerConfig.message, {
          mention: `<@${member.id}>`,
          username: member.user.username,
          server_name: member.guild.name,
          user: {
            id: member.id,
            username: member.user.username
          }
        });
        const title = placeholderEngine.render(
          dmWelcomerConfig.title || `Welcome to ${member.guild.name}`,
          {
            mention: `<@${member.id}>`,
            username: member.user.username,
            server_name: member.guild.name
          }
        );
        const imageUrl = String(dmWelcomerConfig.image_url ?? '').trim();

        const embed = buildEmbed(title, description, 0x57f287);
        embed.setThumbnail(member.guild.iconURL({ extension: 'png', size: 128 }) ?? member.user.displayAvatarURL({ extension: 'png', size: 128 }));
        if (imageUrl) {
          embed.setImage(imageUrl);
        }

        await member.send({ embeds: [embed] }).catch(() => null);
      }
    },
    {
      name: 'guildMemberRemove',
      async execute(member, { services, placeholderEngine }) {
        const config = await services.configService.getModuleConfig(member.guild.id, 'community').catch(() => null);
        const messageConfig = config?.config?.messages?.leave;
        if (!messageConfig?.enabled || !messageConfig?.channel_id) return;

        const channel = member.guild.channels.cache.get(messageConfig.channel_id);
        if (!channel || !channel.isTextBased()) return;

        const description = placeholderEngine.render(messageConfig.text, {
          mention: `<@${member.id}>`,
          username: member.user.username,
          server_name: member.guild.name
        });

        await channel.send({ embeds: [buildEmbed('Member Left', description, 0x808080)] });
      }
    },
    {
      name: 'guildMemberUpdate',
      async execute(oldMember, newMember, { services }) {
        if (!oldMember.premiumSince && newMember.premiumSince) {
          const config = await services.configService.getModuleConfig(newMember.guild.id, 'community').catch(() => null);
          const boostConfig = config?.config?.messages?.boost;
          if (!boostConfig?.enabled || !boostConfig?.channel_id) return;

          const channel = newMember.guild.channels.cache.get(boostConfig.channel_id);
          if (!channel || !channel.isTextBased()) return;

          const embed = buildEmbed(
            'New Server Boost',
            `Thank you <@${newMember.id}> for boosting ${newMember.guild.name}!\nThe server now has ${newMember.guild.premiumSubscriptionCount || 0} boosts.`,
            0xf47fff
          );
          embed.setThumbnail(newMember.user.displayAvatarURL({ extension: 'png', size: 128 }));

          await channel.send({ embeds: [embed] });
        }
      }
    },
    {
      name: 'messageCreate',
      async execute(message, { services }) {
        if (!message.guild || message.author.bot) return;

        const lock = await services.communityService.getUwuLock(message.guild.id, message.author.id);
        if (lock && !isUwuMessage(message.content)) {
          if (lock.settings?.delete_non_uwu) {
            await message.delete().catch(() => null);
          }

          if (lock.settings?.notify) {
            const warning = await message.channel.send({
              content: `${message.author}, UwU lock is active. Please use uwu/owo/uvu-style wording.`
            });
            setTimeout(() => warning.delete().catch(() => null), 5000);
          }

          return;
        }

        const config = await services.configService.getModuleConfig(message.guild.id, 'community').catch(() => null);
        const premiumFeatureConfig = normalizePremiumFeatureConfig(config?.config?.premium_feature_1);
        if (!premiumFeatureConfig.enabled || premiumFeatureConfig.role_ids.length === 0 || premiumFeatureConfig.triggers.length === 0) {
          return;
        }

        const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
        if (!member) return;

        const normalizedMessage = String(message.content ?? '').trim().toLowerCase();
        if (!normalizedMessage) return;

        const matchedTrigger = premiumFeatureConfig.triggers.find(
          (entry) => entry.trigger.toLowerCase() === normalizedMessage
        );
        if (!matchedTrigger) return;

        const allowedRoleIds = matchedTrigger.use_main_roles
          ? premiumFeatureConfig.role_ids
          : matchedTrigger.role_ids;
        const canUseFeature = allowedRoleIds.some((roleId) => member.roles.cache.has(roleId));
        if (!canUseFeature) return;

        const cooldownKey = getPremiumFeatureCooldownKey(message.guild.id, message.author.id);
        const now = Date.now();
        const cooldownEndsAt = premiumFeatureCooldowns.get(cooldownKey) ?? 0;
        if (cooldownEndsAt > now) {
          return;
        }

        if (premiumFeatureConfig.cooldown_seconds > 0) {
          premiumFeatureCooldowns.set(cooldownKey, now + (premiumFeatureConfig.cooldown_seconds * 1000));
        }

        if (matchedTrigger.delete_trigger_message) {
          await message.delete().catch(() => null);
        }

        await sendPremiumFeatureResponse({
          message,
          config: premiumFeatureConfig,
          triggerConfig: matchedTrigger
        });
      }
    },
    {
      name: 'interactionCreate',
      async execute(interaction, { services }) {
        if (
          !interaction.isButton() ||
          (!interaction.customId.startsWith(`${DOMAIN_ACTION_PREFIX}:`) &&
            !interaction.customId.startsWith(`${FREE_ACTION_PREFIX}:`) &&
            !interaction.customId.startsWith(`${MEME_ACTION_PREFIX}:`))
        ) {
          return;
        }

        if (interaction.customId.startsWith(`${MEME_ACTION_PREFIX}:`)) {
          const [, , token, action] = interaction.customId.split(':');
          const pending = pendingMemeAutopostActions.get(token);
          if (!pending) {
            await interaction.reply({
              content: 'This meme autopost panel expired. Run the command again.',
              ephemeral: true
            });
            return;
          }

          if (pending.issuerId !== interaction.user.id) {
            await interaction.reply({
              content: 'Only the original invoker can use this meme autopost panel.',
              ephemeral: true
            });
            return;
          }

          if (pending.guildId !== interaction.guildId) {
            await interaction.reply({
              content: 'This meme autopost panel belongs to a different server context.',
              ephemeral: true
            });
            return;
          }

          if (action !== 'start' && action !== 'stop') {
            await interaction.reply({
              content: 'That meme autopost action is not recognized anymore.',
              ephemeral: true
            });
            return;
          }

          const nextEnabled = action === 'start';
          const config = await services.memeService.updateGuildConfig(interaction.guildId, {
            enabled: nextEnabled
          });
          const { stats } = await services.memeService.getAutopostStatus(interaction.guildId);

          await interaction.update({
            embeds: [buildMemeAutopostControlEmbed(config, stats)],
            components: buildMemeAutopostButtons(token, config.enabled)
          });
          return;
        }

        const [prefix, , token, action] = interaction.customId.split(':');
        const isFreeAction = prefix === 'free';
        const store = isFreeAction ? pendingFreeActions : pendingDomainExpansions;
        const pending = store.get(token);
        if (!pending) {
          await interaction.reply({
            content: isFreeAction
              ? 'This free prompt expired. Run the slash command again.'
              : 'This domain prompt expired. Run the slash command again.',
            ephemeral: true
          });
          return;
        }

        if (pending.issuerId !== interaction.user.id) {
          await interaction.reply({
            content: isFreeAction
              ? 'Only the original invoker can confirm this free action.'
              : 'Only the original invoker can confirm this Domain Expansion.',
            ephemeral: true
          });
          return;
        }

        if (pending.guildId !== interaction.guildId) {
          await interaction.reply({
            content: isFreeAction
              ? 'This free action belongs to a different server context.'
              : 'This Domain Expansion belongs to a different server context.',
            ephemeral: true
          });
          return;
        }

        const validAction = isFreeAction
          ? action === 'release'
          : action === 'apply' || action === 'purge';

        if (!validAction) {
          await interaction.reply({
            content: isFreeAction
              ? 'That free action is not recognized anymore.'
              : 'That domain action is not recognized anymore.',
            ephemeral: true
          });
          return;
        }

        const guild = interaction.guild ?? (await interaction.client.guilds.fetch(pending.guildId).catch(() => null));
        if (!guild) {
          clearPendingAction(store, token);
          await interaction.reply({
            content: 'The guild could not be resolved anymore.',
            ephemeral: true
          });
          return;
        }

        const member = await guild.members.fetch(pending.targetId).catch(() => null);
        if (!member) {
          clearPendingAction(store, token);
          await interaction.reply({
            content: 'That user is no longer available in this server.',
            ephemeral: true
          });
          return;
        }

        const accusedRole = guild.roles.cache.get(pending.accusedRoleId)
          ?? (await guild.roles.fetch(pending.accusedRoleId).catch(() => null));
        if (!accusedRole || accusedRole.managed || !accusedRole.editable) {
          clearPendingAction(store, token);
          await interaction.reply({
            content: 'The configured accused role is missing or cannot be managed by this bot.',
            ephemeral: true
          });
          return;
        }

        try {
          if (isFreeAction) {
            await member.roles.remove(accusedRole.id, 'Free command release');
          } else {
            await member.roles.add(accusedRole.id, 'Deadly Sentencing domain expansion');
          }

          let deletedCount = 0;

          if (!isFreeAction && action === 'purge') {
            const channel = interaction.channel ?? guild.channels.cache.get(pending.channelId) ?? null;
            const purgeResult = await deleteRecentMessagesFromChannel(channel, member.id);
            deletedCount = purgeResult.deletedCount;
          }

          clearPendingAction(store, token);

          await interaction.update({
            flags: MessageFlags.IsComponentsV2,
            components: buildActionPromptComponents({
              title: isFreeAction ? 'You wanna let them out?' : 'Domain Expansion: Deadly Sentencing',
              prompt: isFreeAction
                ? `Do you want to free the user <@${member.id}>?\n\nYES: click this to free the user.`
                : (
                    `Do you really want to do this to <@${member.id}>?\n\n` +
                    'YES: apply the accused role.\n' +
                    'YES+: apply the accused role and delete the target user\'s last hour of messages in this channel.'
                  ),
              locked: true,
              actionLabel: isFreeAction
                ? 'YES selected. Accused role removed.'
                : action === 'purge'
                  ? `YES+ selected. Removed ${deletedCount} recent message${deletedCount === 1 ? '' : 's'} from this channel.`
                  : 'YES selected. Accused role applied.'
            })
          });

          const announcement = await interaction.followUp({
            flags: MessageFlags.IsComponentsV2,
            components: buildAnnouncementComponents({
              title: isFreeAction ? 'You are truly free now' : 'Domain Expansion: Deadly Sentencing',
              gifUrl: isFreeAction ? FREE_GIF : DEADLY_GIF,
              body: isFreeAction
                ? `Freed <@${member.id}>.`
                : (
                    'The court is in session.\n' +
                    `<@${member.id}> has been summoned as the **Defendant**.\n\n` +
                    (action === 'purge'
                      ? `YES+ was invoked. ${deletedCount} message${deletedCount === 1 ? '' : 's'} from the last hour were removed in <#${interaction.channelId}>.\n\n`
                      : '') +
                    'Judgment will be passed.'
                  )
            }),
            allowedMentions: {
              users: [member.id]
            }
          });
          if (announcement?.deletable) {
            setTimeout(() => {
              announcement.delete().catch(() => null);
            }, DOMAIN_EXPANSION_MESSAGE_DELETE_MS);
          }
        } catch {
          clearPendingAction(store, token);
          const fallback = {
            content: isFreeAction ? 'The free command failed.' : 'The Domain failed to form.',
            ephemeral: true
          };
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp(fallback).catch(() => null);
          } else {
            await interaction.reply(fallback).catch(() => null);
          }
        }
      }
    }
  ]
};
