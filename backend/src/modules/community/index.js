import { EmbedBuilder, MessageFlags, WebhookClient, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { randomUUID } from 'node:crypto';

const MEME_ACTION_PREFIX = 'memes:autopost';
const pendingMemeAutopostActions = new Map();
const premiumFeatureCooldowns = new Map();
const pendingProfileStyleSelections = new Map();

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
    profile_style: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        font_id: { type: 'number' },
        effect_id: { type: 'number' },
        colors: { type: 'array', items: { type: 'number' } }
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

const PROFILE_STYLE_FONT_CHOICES = [
  ['Bangers', 1],
  ['Bio Rhyme', 2],
  ['Cherry Bomb', 3],
  ['Chicle', 4],
  ['Compagnon', 5],
  ['Museo Moderno', 6],
  ['Neo Castel', 7],
  ['Pixelify', 8],
  ['Ribes', 9],
  ['Sinistre', 10],
  ['Default', 11],
  ['Zilla Slab', 12]
].map(([name, value]) => ({ name, value }));

const PROFILE_STYLE_EFFECT_CHOICES = [
  ['Solid', 1],
  ['Gradient', 2],
  ['Neon', 3],
  ['Toon', 4],
  ['Pop', 5],
  ['Glow', 6]
].map(([name, value]) => ({ name, value }));

function decimalToHex(value) {
  return `#${Number(value ?? 0).toString(16).padStart(6, '0').toUpperCase()}`;
}

function isUwuMessage(content) {
  return /uwu|owo|uvu/i.test(content);
}

function buildEmbed(title, description, color) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
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
  }, 600000);

  store.set(token, {
    ...data,
    timeout,
    createdAt: Date.now()
  });

  return token;
}

export default {
  name: 'community',
  configSchema: COMMUNITY_SCHEMA,
  commands: [
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
      name: 'profile',
      description: 'Manage the bot profile style for this server',
      ephemeral: true,
      permissionOverrides: {
        discordPermissions: ['Administrator']
      },
      options: [],
      async execute(interaction, { services }) {
        const components = [{
          type: 17,
          components: [
            {
              type: 10,
              content: '-# AOI PROFILE STYLE\nYou can change profile of AOI with this.'
            },
            {
              type: 1,
              components: [
                {
                  type: 2,
                  label: 'AOI',
                  custom_id: 'profile:aoi',
                  style: 2
                },
                {
                  type: 2,
                  label: 'CLEAR',
                  custom_id: 'profile:clear',
                  style: 2
                }
              ]
            }
          ]
        }];

        await interaction.editReply({
          flags: MessageFlags.IsComponentsV2,
          components,
          allowedMentions: { parse: [] }
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
        if (interaction.isCommand()) return;
        if (
          !interaction.isButton() ||
          !interaction.customId.startsWith(`${MEME_ACTION_PREFIX}:`)
        ) {
          return;
        }

        const [, , token, action] = interaction.customId.split(':');
        const pending = pendingMemeAutopostActions.get(token);
        if (!pending) {
          return { type: 'REPLY', message: 'This meme autopost panel expired. Run the command again.', ephemeral: true };
        }

        if (pending.issuerId !== interaction.user.id) {
          return { type: 'REPLY', message: 'Only the original invoker can use this meme autopost panel.', ephemeral: true };
        }

        if (pending.guildId !== interaction.guildId) {
          return { type: 'REPLY', message: 'This meme autopost panel belongs to a different server context.', ephemeral: true };
        }

        if (action !== 'start' && action !== 'stop') {
          return { type: 'REPLY', message: 'That meme autopost action is not recognized anymore.', ephemeral: true };
        }

        const nextEnabled = action === 'start';
        const config = await services.memeService.updateGuildConfig(interaction.guildId, {
          enabled: nextEnabled
        });
        const { stats } = await services.memeService.getAutopostStatus(interaction.guildId);

        return {
          type: 'UPDATE',
          embeds: [buildMemeAutopostControlEmbed(config, stats)],
          components: buildMemeAutopostButtons(token, config.enabled)
        };
      }
    },
    {
      name: 'interactionCreate',
      async execute(interaction, context) {
        if (interaction.isCommand()) return;
        if (!interaction.memberPermissions?.has('Administrator')) {
          return;
        }

        const { services } = context;

        try {
          if (interaction.isButton() && interaction.customId === 'profile:aoi') {
            return {
              type: 'UPDATE',
              flags: MessageFlags.IsComponentsV2,
              components: [{
                type: 17,
                components: [
                  { type: 10, content: '-# SELECT FONT & EFFECT\nChoose a font and effect, then click Continue to set colors.' },
                  {
                    type: 1,
                    components: [{
                      type: 3, custom_id: 'profile:font', placeholder: 'Select a font',
                      min_values: 1, max_values: 1,
                      options: PROFILE_STYLE_FONT_CHOICES.map((f) => ({ label: f.name, value: String(f.value) }))
                    }]
                  },
                  {
                    type: 1,
                    components: [{
                      type: 3, custom_id: 'profile:effect', placeholder: 'Select an effect',
                      min_values: 1, max_values: 1,
                      options: PROFILE_STYLE_EFFECT_CHOICES.map((e) => ({ label: e.name, value: String(e.value) }))
                    }]
                  },
                  { type: 1, components: [{ type: 2, label: 'Continue', custom_id: 'profile:continue', style: 2 }] }
                ]
              }]
            };
          }

          if (interaction.isStringSelectMenu() && interaction.customId === 'profile:font') {
            const key = `${interaction.guildId}:${interaction.user.id}`;
            const data = pendingProfileStyleSelections.get(key) ?? {};
            data.font = Number(interaction.values[0]);
            pendingProfileStyleSelections.set(key, data);
            return { type: 'DEFER_UPDATE' };
          }

          if (interaction.isStringSelectMenu() && interaction.customId === 'profile:effect') {
            const key = `${interaction.guildId}:${interaction.user.id}`;
            const data = pendingProfileStyleSelections.get(key) ?? {};
            data.effect = Number(interaction.values[0]);
            pendingProfileStyleSelections.set(key, data);
            return { type: 'DEFER_UPDATE' };
          }

          if (interaction.isButton() && interaction.customId === 'profile:continue') {
            const key = `${interaction.guildId}:${interaction.user.id}`;
            const data = pendingProfileStyleSelections.get(key) ?? {};

            if (!data.font || !data.effect) {
              return { type: 'REPLY', message: 'Please select both a font and an effect first.', ephemeral: true };
            }

            const modal = new ModalBuilder()
              .setCustomId('profile_aoi_modal')
              .setTitle('AOI Profile Style')
              .addComponents(
                new ActionRowBuilder().addComponents(
                  new TextInputBuilder()
                    .setCustomId('profile:color1').setLabel('Color 1 (hex)')
                    .setPlaceholder('FF0000').setStyle(TextInputStyle.Short)
                    .setMaxLength(6).setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                  new TextInputBuilder()
                    .setCustomId('profile:color2').setLabel('Color 2 (hex, optional)')
                    .setPlaceholder('00FFFF').setStyle(TextInputStyle.Short)
                    .setMaxLength(6).setRequired(false)
                )
              );

            return { type: 'MODAL', modal };
          }

          if (interaction.isButton() && interaction.customId === 'profile:clear') {
            const modal = new ModalBuilder()
              .setCustomId('profile_clear_modal')
              .setTitle('Clear Profile Style')
              .addComponents(
                new ActionRowBuilder().addComponents(
                  new TextInputBuilder()
                    .setCustomId('profile:confirm').setLabel('Type CONFIRM to clear')
                    .setStyle(TextInputStyle.Short).setPlaceholder('CONFIRM').setRequired(true)
                )
              );

            return { type: 'MODAL', modal };
          }

          if (interaction.isModalSubmit() && interaction.customId === 'profile_aoi_modal') {
            const key = `${interaction.guildId}:${interaction.user.id}`;
            const data = pendingProfileStyleSelections.get(key) ?? {};
            const color1 = interaction.fields.getTextInputValue('profile:color1');
            const color2 = interaction.fields.getTextInputValue('profile:color2');

            const parsedColor1 = services.profileStyleService.parseColorInput(color1);
            const parsedColor2 = color2 ? services.profileStyleService.parseColorInput(color2) : null;

            if (parsedColor1 === null) return { type: 'REPLY', message: 'Invalid primary color.', ephemeral: true };
            if (color2 && parsedColor2 === null) return { type: 'REPLY', message: 'Invalid secondary color.', ephemeral: true };

            await services.profileStyleService.updateGuildConfig(interaction.guildId, {
              enabled: true, font_id: data.font ?? 11, effect_id: data.effect ?? 1,
              colors: [parsedColor1, parsedColor2].filter((v) => v !== null)
            });

            pendingProfileStyleSelections.delete(key);

            return {
              type: 'UPDATE',
              flags: MessageFlags.IsComponentsV2,
              components: [{
                type: 17,
                components: [{ type: 10, content: '-# PROFILE STYLE UPDATED\nProfile style has been updated successfully!' }]
              }]
            };
          }

          if (interaction.isModalSubmit() && interaction.customId === 'profile_clear_modal') {
            const confirm = interaction.fields.getTextInputValue('profile:confirm');
            if (confirm !== 'CONFIRM') {
              return { type: 'REPLY', message: 'Text does not match. Profile style was not cleared.', ephemeral: true };
            }

            await services.profileStyleService.clearGuildConfig(interaction.guildId);
            return { type: 'REPLY', message: 'Profile style cleared!', ephemeral: true };
          }
        } catch (error) {
          return { type: 'ERROR', message: 'Error processing profile action.' };
        }
      }
    }
  ]
};
