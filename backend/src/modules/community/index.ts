import { EmbedBuilder, MessageFlags, WebhookClient } from 'discord.js';
import { nanoid } from 'nanoid';
import type { BotContext, InteractionResult, ConfigCache, PlaceholderEngine } from '../../types/index.js';
import type { ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction, GuildMember, Message, PartialGuildMember } from 'discord.js';

const MEME_ACTION_PREFIX = 'memes:autopost';
const pendingMemeAutopostActions = new Map<string, PendingMemeAction>();
const premiumFeatureCooldowns = new Map<string, number>();

setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of premiumFeatureCooldowns) {
    if (expiresAt <= now) {
      premiumFeatureCooldowns.delete(key);
    }
  }
}, 60_000).unref();

interface PremiumTriggerConfig {
  id: string;
  trigger: string;
  response_links: string[];
  footer_text: string;
  delete_trigger_message: boolean;
  use_main_roles: boolean;
  role_ids: string[];
}

interface PremiumFeatureConfig {
  enabled: boolean;
  cooldown_seconds: number;
  webhook_enabled: boolean;
  webhook_url: string;
  role_ids: string[];
  triggers: PremiumTriggerConfig[];
}

interface PendingMemeAction {
  guildId: string;
  issuerId: string;
  timeout: ReturnType<typeof setTimeout>;
  createdAt: number;
}

interface MemeAutopostStats {
  fetched_at: string;
  subreddit: string;
  result_count: number;
}

interface ProfileStyleConfig {
  enabled: boolean;
  font_id: number;
  effect_id: number;
  colors: number[];
}

interface UwuLockResult {
  settings?: {
    delete_non_uwu: boolean;
    notify: boolean;
  };
}

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

const FONT_PAIRS: Array<[string, number]> = [
  ['Bangers', 1],
  ['BioRhyme', 2],
  ['Cherry Bomb', 3],
  ['Chicle', 4],
  ['Compagnon', 5],
  ['MuseoModerno', 6],
  ['Neo-Castel', 7],
  ['Pixelify Sans', 8],
  ['Ribes', 9],
  ['Sinistre', 10],
  ['Default', 11],
  ['Zilla Slab', 12]
];
const PROFILE_STYLE_FONT_CHOICES = FONT_PAIRS.map(([name, value]) => ({ name, value }));

const EFFECT_PAIRS: Array<[string, number]> = [
  ['Solid', 1],
  ['Gradient', 2],
  ['Neon', 3],
  ['Toon', 4],
  ['Pop', 5],
  ['Glow', 6]
];
const PROFILE_STYLE_EFFECT_CHOICES = EFFECT_PAIRS.map(([name, value]) => ({ name, value }));

function decimalToHex(value: unknown): string {
  return `#${Number(value ?? 0).toString(16).padStart(6, '0').toUpperCase()}`;
}

function buildProfileModal(config: Record<string, any>) {
  const fontId = String(config.font_id ?? 11);
  const effectId = String(config.effect_id ?? 1);
  const color1 = config.colors?.[0] != null ? decimalToHex(config.colors[0]).replace('#', '') : '';
  const color2 = config.colors?.[1] != null ? decimalToHex(config.colors[1]).replace('#', '') : '';

  return {
    custom_id: 'profile_modal',
    title: 'AOI Profile Style',
    components: [
      {
        type: 18,
        label: 'Choose a font',
        component: {
          type: 3,
          custom_id: 'profile:font',
          placeholder: PROFILE_STYLE_FONT_CHOICES.find((f) => String(f.value) === fontId)?.name ?? 'Select a font',
          options: PROFILE_STYLE_FONT_CHOICES.map((f) => ({
            value: String(f.value),
            label: f.name,
            default: String(f.value) === fontId
          }))
        }
      },
      {
        type: 18,
        label: 'Choose an effect',
        component: {
          type: 21,
          custom_id: 'profile:effect',
          options: PROFILE_STYLE_EFFECT_CHOICES.map((e) => ({
            value: String(e.value),
            label: e.name,
            default: String(e.value) === effectId
          }))
        }
      },
      {
        type: 1,
        components: [
          {
            type: 4,
            custom_id: 'profile:color1',
            label: 'Primary Color',
            placeholder: 'FF0000',
            style: 1,
            max_length: 6,
            required: false,
            value: color1
          }
        ]
      },
      {
        type: 1,
        components: [
          {
            type: 4,
            custom_id: 'profile:color2',
            label: 'Secondary Color (for gradient only)',
            placeholder: '00FFFF',
            style: 1,
            max_length: 6,
            required: false,
            value: color2
          }
        ]
      },
      {
        type: 18,
        label: 'RESET',
        component: {
          type: 23,
          custom_id: 'profile:reset',
          default: false
        }
      }
    ]
  };
}

function isUwuMessage(content: string): boolean {
  return /uwu|owo|uvu/i.test(content);
}

function buildEmbed(title: string, description: string, color: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function normalizePremiumTrigger(rawTrigger: Record<string, any> | undefined | null): PremiumTriggerConfig {
  const responseLinks = Array.isArray(rawTrigger?.response_links)
    ? rawTrigger.response_links
      .map((value: any) => String(value ?? '').trim())
      .filter((value: string) => /^https?:\/\//i.test(value))
    : [];

  return {
    id: String(rawTrigger?.id ?? nanoid()),
    trigger: String(rawTrigger?.trigger ?? '').trim(),
    response_links: Array.from(new Set(responseLinks)),
    footer_text: String(rawTrigger?.footer_text ?? '').trim().slice(0, 500),
    delete_trigger_message: Boolean(rawTrigger?.delete_trigger_message),
    use_main_roles: rawTrigger?.use_main_roles !== false,
    role_ids: Array.isArray(rawTrigger?.role_ids)
      ? Array.from(new Set(rawTrigger.role_ids.map((value: any) => String(value ?? '').trim()).filter(Boolean)))
      : []
  };
}

function normalizePremiumFeatureConfig(rawConfig: Record<string, any> | undefined | null): PremiumFeatureConfig {
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
      ? Array.from(new Set(rawConfig.role_ids.map((value: any) => String(value ?? '').trim()).filter(Boolean)))
      : [],
    triggers
  };
}

function buildPremiumFeatureComponents(triggerConfig: PremiumTriggerConfig): any[] {
  const components: any[] = [];

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

function getPremiumFeatureCooldownKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

async function sendPremiumFeatureResponse({ message, config, triggerConfig }: { message: Message; config: PremiumFeatureConfig; triggerConfig: PremiumTriggerConfig }): Promise<void> {
  const payload = {
    flags: Number(MessageFlags.IsComponentsV2),
    components: buildPremiumFeatureComponents(triggerConfig),
    allowedMentions: { parse: [] }
  };

  if (config.webhook_enabled && config.webhook_url) {
    const webhook = new WebhookClient({ url: config.webhook_url });
    try {
      await webhook.send(payload as any);
      return;
    } catch {
      await (message.channel as any).send(payload).catch(() => null);
      return;
    }
  }

  await (message.channel as any).send(payload).catch(() => null);
}

function buildMemeAutopostControlEmbed(config: Record<string, any>, stats: MemeAutopostStats[] = []): EmbedBuilder {
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
      `Subreddits: ${config.subreddits.length ? config.subreddits.map((subreddit: string) => `r/${subreddit}`).join(', ') : 'None configured'}`,
      '',
      latest || 'No recent autopost stats recorded yet.',
      '',
      'Use the buttons below to start or stop the autopost. Use the Community page on the dashboard to edit the channel, role, subreddits, or timing.'
    ].join('\n'),
    0x5865f2
  );
}

function buildMemeAutopostButtons(token: string, enabled: boolean): any[] {
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

function storePendingAction(store: Map<string, any>, data: Record<string, any>): string {
  const token = nanoid();
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
      async execute(interaction: ChatInputCommandInteraction, context: BotContext): Promise<void> {
        const { services, configCache } = context as any;
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
      defer: false,
      permissionOverrides: {
        discordPermissions: ['Administrator']
      },
      options: [],
      async execute(interaction: ChatInputCommandInteraction, context: BotContext): Promise<void> {
        const { services } = context as any;
        const config = await services.profileStyleService.getGuildConfig(interaction.guildId);
        const modal = buildProfileModal(config);
        await interaction.showModal(modal);
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
      async execute(interaction: ChatInputCommandInteraction, context: BotContext): Promise<void> {
        const { services } = context as any;
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
      async execute(member: GuildMember, context: BotContext): Promise<void> {
        const { services, placeholderEngine } = context as any;
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
        const iconUrl = member.guild.iconURL({ extension: 'png', size: 128 }) ?? member.user.displayAvatarURL({ extension: 'png', size: 128 });
        embed.setThumbnail(iconUrl);
        if (imageUrl) {
          embed.setImage(imageUrl);
        }

        await member.send({ embeds: [embed] }).catch(() => null);
      }
    },
    {
      name: 'guildMemberRemove',
      async execute(member: GuildMember | PartialGuildMember, context: BotContext): Promise<void> {
        const { services, placeholderEngine } = context as any;
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

        await (channel as any).send({ embeds: [buildEmbed('Member Left', description, 0x808080)] });
      }
    },
    {
      name: 'guildMemberUpdate',
      async execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember, context: BotContext): Promise<void> {
        const { services } = context as any;
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
          const avatarUrl = newMember.user.displayAvatarURL({ extension: 'png', size: 128 });
          embed.setThumbnail(avatarUrl);

          await (channel as any).send({ embeds: [embed] });
        }
      }
    },
    {
      name: 'messageCreate',
      async execute(message: Message, context: BotContext): Promise<void> {
        const { services } = context as any;
        if (!message.guild || message.author.bot) return;

        const lock: UwuLockResult | null = await services.communityService.getUwuLock(message.guild.id, message.author.id);
        if (lock && !isUwuMessage(message.content)) {
          if (lock.settings?.delete_non_uwu) {
            await message.delete().catch(() => null);
          }

          if (lock.settings?.notify) {
            const warning = await (message.channel as any).send({
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
      async execute(interaction: ButtonInteraction, context: BotContext): Promise<InteractionResult | void> {
        const { services } = context as any;
        if (interaction.isCommand()) return;
        if (
          !interaction.isButton() ||
          !interaction.customId.startsWith(`${MEME_ACTION_PREFIX}:`)
        ) {
          return;
        }

        const [, , token, action] = interaction.customId.split(':');
        const pending = token ? pendingMemeAutopostActions.get(token) : undefined;
        if (!pending) {
          return { type: 'REPLY' as const, message: 'This meme autopost panel expired. Run the command again.', ephemeral: true };
        }

        if (pending.issuerId !== interaction.user.id) {
          return { type: 'REPLY' as const, message: 'Only the original invoker can use this meme autopost panel.', ephemeral: true };
        }

        if (pending.guildId !== interaction.guildId) {
          return { type: 'REPLY' as const, message: 'This meme autopost panel belongs to a different server context.', ephemeral: true };
        }

        if (action !== 'start' && action !== 'stop') {
          return { type: 'REPLY' as const, message: 'That meme autopost action is not recognized anymore.', ephemeral: true };
        }

        const nextEnabled = action === 'start';
        const config = await services.memeService.updateGuildConfig(interaction.guildId, {
          enabled: nextEnabled
        });
        const { stats } = await services.memeService.getAutopostStatus(interaction.guildId);

        return {
          type: 'UPDATE' as const,
          embeds: [buildMemeAutopostControlEmbed(config, stats)],
          components: buildMemeAutopostButtons(token!, config.enabled)
        };
      }
    },
    {
      name: 'interactionCreate',
      async execute(interaction: ModalSubmitInteraction, context: BotContext): Promise<InteractionResult | void> {
        if (interaction.isCommand()) return;
        if (!interaction.memberPermissions?.has('Administrator' as any)) return;
        if (!interaction.isModalSubmit() || interaction.customId !== 'profile_modal') return;

        const { services } = context as any;

        try {
          const { fields } = interaction;

          const fontValues = fields.getStringSelectValues('profile:font');
          const fontValue = fontValues?.[0] ?? null;
          const effectValue = fields.getRadioGroup('profile:effect');
          const color1Raw = fields.getTextInputValue('profile:color1');
          const color2Raw = fields.getTextInputValue('profile:color2');
          const resetValue = fields.getCheckbox('profile:reset') as boolean | string;

          if (resetValue === true || resetValue === 'true') {
            await services.profileStyleService.clearGuildConfig(interaction.guildId);
            return { type: 'REPLY' as const, message: 'Profile style cleared!', ephemeral: true };
          }

          const fontId = fontValue ? Number(fontValue) : 11;
          const effectId = effectValue ? Number(effectValue) : 1;
          const parsedColor1 = color1Raw ? services.profileStyleService.parseColorInput(color1Raw) : null;
          const parsedColor2 = color2Raw ? services.profileStyleService.parseColorInput(color2Raw) : null;

          if (parsedColor1 === null && parsedColor2 === null) return { type: 'REPLY' as const, message: 'Please provide at least one color.', ephemeral: true };
          if (color2Raw && parsedColor2 === null) return { type: 'REPLY' as const, message: 'Invalid secondary color.', ephemeral: true };
          if (effectId === 2 && (parsedColor1 === null || parsedColor2 === null)) return { type: 'REPLY' as const, message: 'Gradient effect requires two colors.', ephemeral: true };

          const me = interaction.guild?.members?.me ?? await interaction.guild?.members?.fetchMe().catch(() => null);
          if (!me?.permissions.has('ChangeNickname' as any)) return { type: 'REPLY' as const, message: 'I need the "Change Nickname" permission in this server to apply a profile style.', ephemeral: true };

          const colors = [parsedColor1, parsedColor2].filter((v: any) => v !== null).slice(0, 2);

          await services.profileStyleService.updateGuildConfig(interaction.guildId, {
            enabled: true,
            font_id: fontId,
            effect_id: effectId,
            colors
          });

          return { type: 'REPLY' as const, message: 'Profile style updated!', ephemeral: true };
        } catch (error) {
          return { type: 'ERROR' as const, message: 'Error processing profile action.' };
        }
      }
    }
  ]
};
