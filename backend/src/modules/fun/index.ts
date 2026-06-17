import { MessageFlags } from 'discord.js';
import { nanoid } from 'nanoid';
import { formatDate } from '../../utils/date.js';
import type { BotContext, InteractionResult, PlaceholderEngine } from '../../types/index.js';
import type { ChatInputCommandInteraction, ButtonInteraction, Message, Client } from 'discord.js';

const FUN_ACTION_PREFIX = 'fun:drop';
const pendingDrops = new Map<string, PendingDrop>();

interface DropConfig {
  shared_cooldown_across_types: boolean;
  max_uses_per_member: number;
  cooldown_window_seconds: number;
  interaction_timeout_seconds: number;
  resolved_drop_delete_seconds: number;
  ephemeral_notice_delete_seconds: number;
  claim_result_visibility: string;
  pass_result_visibility: string;
  smash_button_label: string;
  pass_button_label: string;
  summon_title_template: string;
  summon_body_template: string;
  claim_title_template: string;
  claim_body_template: string;
  pass_title_template: string;
  pass_body_template: string;
  dm_title_template: string;
  dm_body_template: string;
  cooldown_title_template: string;
  cooldown_body_template: string;
  expired_title_template: string;
  expired_body_template: string;
}

interface DropAsset {
  url: string;
  artistName?: string;
  artistHref?: string;
  sourceUrl?: string;
}

interface PendingDrop {
  token: string;
  guildId: string;
  guildName: string;
  channelId: string;
  messageId: string;
  summonerId: string;
  type: string;
  asset: DropAsset | null;
  config: DropConfig;
  resolved: boolean;
  timeout: ReturnType<typeof setTimeout>;
}

interface CooldownResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface TemplateContext {
  type: string;
  type_title: string;
  type_upper: string;
  server_name: string;
  summoner_mention: string;
  actor_mention: string;
  claimer_mention: string;
  claimed_at: string;
  command_name: string;
  retry_after: string;
  max_uses: string;
  window_seconds: string;
  window_text: string;
  window_minutes: string;
  dm_status: string;
  image_url: string;
  artist_name: string;
  artist_href: string;
  source_url: string;
}

const FUN_SCHEMA = {
  type: 'object',
  properties: {
    shared_cooldown_across_types: { type: 'boolean' },
    max_uses_per_member: { type: 'number' },
    cooldown_window_seconds: { type: 'number' },
    interaction_timeout_seconds: { type: 'number' },
    resolved_drop_delete_seconds: { type: 'number' },
    ephemeral_notice_delete_seconds: { type: 'number' },
    claim_result_visibility: { type: 'string' },
    pass_result_visibility: { type: 'string' },
    smash_button_label: { type: 'string' },
    pass_button_label: { type: 'string' },
    summon_title_template: { type: 'string' },
    summon_body_template: { type: 'string' },
    claim_title_template: { type: 'string' },
    claim_body_template: { type: 'string' },
    pass_title_template: { type: 'string' },
    pass_body_template: { type: 'string' },
    dm_title_template: { type: 'string' },
    dm_body_template: { type: 'string' },
    cooldown_title_template: { type: 'string' },
    cooldown_body_template: { type: 'string' },
    expired_title_template: { type: 'string' },
    expired_body_template: { type: 'string' }
  }
};

function getTypeTitle(type: string): string {
  return type === 'husbando' ? 'Husbando' : 'Waifu';
}

function buildDurationText(totalSeconds: unknown): string {
  const seconds = Math.max(1, Number.parseInt(String(totalSeconds ?? 0), 10) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

function formatClaimedAt(date: Date = new Date()): string {
  return formatDate(date, 'MMMM d, yyyy, h:mm:ss a');
}

function buildTemplateContext(opts: {
  type: string;
  asset?: DropAsset | null;
  guildName?: string;
  summonerId?: string;
  actorId?: string;
  claimerId?: string;
  claimedAt?: string;
  commandName?: string;
  retryAfter?: string;
  maxUses?: number;
  windowSeconds?: number;
  dmStatus?: string;
}): TemplateContext {
  return {
    type: opts.type,
    type_title: getTypeTitle(opts.type),
    type_upper: String(opts.type).toUpperCase(),
    server_name: opts.guildName || 'this server',
    summoner_mention: opts.summonerId ? `<@${opts.summonerId}>` : '',
    actor_mention: opts.actorId ? `<@${opts.actorId}>` : '',
    claimer_mention: opts.claimerId ? `<@${opts.claimerId}>` : '',
    claimed_at: opts.claimedAt || '',
    command_name: opts.commandName || opts.type,
    retry_after: opts.retryAfter || '',
    max_uses: String(opts.maxUses || ''),
    window_seconds: String(opts.windowSeconds || ''),
    window_text: buildDurationText(opts.windowSeconds),
    window_minutes: String(Math.max(1, Math.round((opts.windowSeconds || 0) / 60))),
    dm_status: opts.dmStatus || '',
    image_url: opts.asset?.url ?? '',
    artist_name: opts.asset?.artistName ?? '',
    artist_href: opts.asset?.artistHref ?? '',
    source_url: opts.asset?.sourceUrl ?? ''
  };
}

function renderTemplate(placeholderEngine: PlaceholderEngine, template: string, fallback: string, context: TemplateContext): string {
  const rendered = placeholderEngine.render(template, context).trim();
  return rendered || fallback;
}

function buildContainer(opts: {
  title: string;
  body?: string;
  asset?: DropAsset | null;
  buttons?: any[];
}): any[] {
  const components: any[] = [
    {
      type: 10,
      content: `# ${opts.title}`
    }
  ];

  if (opts.body) {
    components.push({
      type: 14,
      divider: true,
      spacing: 1
    });
    components.push({
      type: 10,
      content: opts.body
    });
  }

  if (opts.asset?.url) {
    components.push({
      type: 14,
      divider: true,
      spacing: 1
    });
    components.push({
      type: 12,
      items: [
        {
          media: { url: opts.asset.url }
        }
      ]
    });
  }

  if (opts.buttons && opts.buttons.length > 0) {
    components.push({
      type: 14,
      divider: true,
      spacing: 1
    });
    components.push({
      type: 1,
      components: opts.buttons
    });
  }

  return [
    {
      type: 17,
      components
    }
  ];
}

function scheduleMessageDelete(message: Message | null | undefined, seconds: number): void {
  if (!message || seconds <= 0) {
    return;
  }

  setTimeout(() => {
    message.delete().catch(() => null);
  }, seconds * 1000);
}

function scheduleFollowUpDelete(interaction: any, messageId: string | undefined, seconds: number): void {
  if (!messageId || seconds <= 0 || seconds > 840) {
    return;
  }

  setTimeout(() => {
    interaction.webhook.deleteMessage(messageId).catch(() => null);
  }, seconds * 1000);
}

async function fetchMessageForDrop(client: Client, pending: PendingDrop): Promise<Message | null> {
  const guild = client.guilds.cache.get(pending.guildId)
    ?? await client.guilds.fetch(pending.guildId).catch(() => null);
  if (!guild) return null;

  const channel = guild.channels.cache.get(pending.channelId)
    ?? await guild.channels.fetch(pending.channelId).catch(() => null);
  if (!channel?.isTextBased?.() || !('messages' in channel)) {
    return null;
  }

  return (channel as any).messages.fetch(pending.messageId).catch(() => null);
}

function clearPendingDrop(token: string): PendingDrop | null {
  const pending = pendingDrops.get(token);
  if (pending?.timeout) {
    clearTimeout(pending.timeout);
  }
  pendingDrops.delete(token);
  return pending ?? null;
}

async function expirePendingDrop(token: string, client: Client, placeholderEngine: PlaceholderEngine): Promise<void> {
  const pending = clearPendingDrop(token);
  if (!pending || pending.resolved) {
    return;
  }

  pending.resolved = true;

  const message = await fetchMessageForDrop(client, pending);
  if (!message) {
    return;
  }

  const templateContext = buildTemplateContext({
    type: pending.type,
    asset: pending.asset,
    guildName: pending.guildName,
    summonerId: pending.summonerId,
    commandName: pending.type,
    maxUses: pending.config.max_uses_per_member,
    windowSeconds: pending.config.cooldown_window_seconds
  });
  const title = renderTemplate(
    placeholderEngine,
    pending.config.expired_title_template,
    `${getTypeTitle(pending.type)} Expired`,
    templateContext
  );
  const body = renderTemplate(
    placeholderEngine,
    pending.config.expired_body_template,
    `Nobody claimed this ${pending.type} before the drop timed out.`,
    templateContext
  );

  await message.edit({
    flags: MessageFlags.IsComponentsV2,
    components: buildContainer({
      title,
      body,
      asset: pending.asset
    }),
    allowedMentions: { parse: [] }
  }).catch(() => null);

  scheduleMessageDelete(message, pending.config.resolved_drop_delete_seconds);
}

async function sendEphemeralResult(interaction: any, pending: PendingDrop, components: any[]): Promise<void> {
  const message = await interaction.followUp({
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components,
    allowedMentions: { parse: [] }
  }).catch(() => null);

  if (message?.id) {
    scheduleFollowUpDelete(
      interaction,
      message.id,
      pending.config.ephemeral_notice_delete_seconds
    );
  }
}

async function handleSummonCommand(interaction: ChatInputCommandInteraction, context: BotContext, type: string): Promise<void> {
  const { services, placeholderEngine } = context as any;

  const enabled = await services.funService.isModuleEnabled(interaction.guildId);
  if (!enabled) {
    await interaction.editReply('The fun module is disabled for this server.');
    return;
  }

  const config: DropConfig = await services.funService.getGuildConfig(interaction.guildId);
  const cooldown: CooldownResult = await services.funService.checkCommandCooldown(
    interaction.guildId,
    interaction.user.id,
    type,
    config
  );

  if (!cooldown.allowed) {
    const templateContext = buildTemplateContext({
      type,
      guildName: interaction.guild?.name,
      commandName: type,
      retryAfter: buildDurationText(cooldown.retryAfterSeconds),
      maxUses: config.max_uses_per_member,
      windowSeconds: config.cooldown_window_seconds
    });
    const title = renderTemplate(
      placeholderEngine,
      config.cooldown_title_template,
      'Slow Down',
      templateContext
    );
    const body = renderTemplate(
      placeholderEngine,
      config.cooldown_body_template,
      `Try again in ${buildDurationText(cooldown.retryAfterSeconds)}.`,
      templateContext
    );

    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: buildContainer({ title, body }),
      allowedMentions: { parse: [] }
    });
    return;
  }

  let asset: DropAsset | null;
  try {
    asset = await services.funService.fetchCharacter(type);
  } catch (error: any) {
    await interaction.editReply(`Failed to load a ${type} right now: ${error?.message || 'unknown error'}`);
    return;
  }

  const token = nanoid();
  const templateContext = buildTemplateContext({
    type,
    asset,
    guildName: interaction.guild?.name,
    summonerId: interaction.user.id,
    commandName: type,
    maxUses: config.max_uses_per_member,
    windowSeconds: config.cooldown_window_seconds
  });
  const title = renderTemplate(
    placeholderEngine,
    config.summon_title_template,
    `${getTypeTitle(type)} Drop`,
    templateContext
  );
  const body = renderTemplate(
    placeholderEngine,
    config.summon_body_template,
    `A ${type} dropped. Smash first to claim it or pass to clear it.`,
    templateContext
  );

  await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: buildContainer({
      title,
      body,
      asset,
      buttons: [
        {
          type: 2,
          custom_id: `${FUN_ACTION_PREFIX}:${token}:smash`,
          label: config.smash_button_label,
          style: 3
        },
        {
          type: 2,
          custom_id: `${FUN_ACTION_PREFIX}:${token}:pass`,
          label: config.pass_button_label,
          style: 4
        }
      ]
    }),
    allowedMentions: { parse: [] }
  });

  const reply = await interaction.fetchReply();
  const timeout = setTimeout(() => {
    expirePendingDrop(token, interaction.client, placeholderEngine).catch(() => null);
  }, config.interaction_timeout_seconds * 1000);

  pendingDrops.set(token, {
    token,
    guildId: interaction.guildId!,
    guildName: interaction.guild?.name ?? 'this server',
    channelId: interaction.channelId,
    messageId: reply.id,
    summonerId: interaction.user.id,
    type,
    asset,
    config,
    resolved: false,
    timeout
  });

  await services.funService.recordCommandUse(
    interaction.guildId!,
    interaction.user.id,
    type,
    config
  );
}

function buildGenericResolvedComponents(pending: PendingDrop): any[] {
  return buildContainer({
    title: `${getTypeTitle(pending.type)} Drop`,
    body: 'This drop is no longer available.',
    asset: pending.asset
  });
}

export default {
  name: 'fun',
  display_name: 'Fun',
  description: 'Anime waifu and husbando drops with claim and pass interactions.',
  category: 'fun',
  configSchema: FUN_SCHEMA,
  commands: [
    {
      name: 'waifu',
      description: 'Summon a waifu drop for the server',
      options: [],
      async execute(interaction: ChatInputCommandInteraction, context: BotContext): Promise<void> {
        await handleSummonCommand(interaction, context, 'waifu');
      }
    },
    {
      name: 'husbando',
      description: 'Summon a husbando drop for the server',
      options: [],
      async execute(interaction: ChatInputCommandInteraction, context: BotContext): Promise<void> {
        await handleSummonCommand(interaction, context, 'husbando');
      }
    }
  ],
  events: [
    {
      name: 'interactionCreate',
      async execute(interaction: ButtonInteraction, context: BotContext): Promise<InteractionResult | void> {
        const { services, placeholderEngine } = context as any;

        if (interaction.isCommand()) return;
        if (!interaction.isButton() || !interaction.customId.startsWith(`${FUN_ACTION_PREFIX}:`)) {
          return;
        }

        const [, , token, action] = interaction.customId.split(':');
        if (!token || (action !== 'smash' && action !== 'pass')) {
          return { type: 'REPLY' as const, message: 'That drop action is no longer valid.', ephemeral: true };
        }

        const pending = pendingDrops.get(token);
        if (!pending) {
          return { type: 'REPLY' as const, message: 'This drop expired. Use the slash command again.', ephemeral: true };
        }

        if (pending.guildId !== interaction.guildId!) {
          return { type: 'REPLY' as const, message: 'This drop belongs to another server context.', ephemeral: true };
        }

        if (pending.resolved) {
          return { type: 'REPLY' as const, message: 'This drop has already been resolved.', ephemeral: true };
        }

        pending.resolved = true;
        clearPendingDrop(token);

        const claimedAt = formatClaimedAt(new Date());
        let dmStatus = 'Check your DMs.';

        if (action === 'smash') {
          const dmContext = buildTemplateContext({
            type: pending.type,
            asset: pending.asset,
            guildName: pending.guildName,
            summonerId: pending.summonerId,
            actorId: interaction.user.id,
            claimerId: interaction.user.id,
            claimedAt,
            commandName: pending.type,
            maxUses: pending.config.max_uses_per_member,
            windowSeconds: pending.config.cooldown_window_seconds,
            dmStatus
          });
          const dmTitle = renderTemplate(
            placeholderEngine,
            pending.config.dm_title_template,
            `You claimed your ${pending.type}`,
            dmContext
          );
          const dmBody = renderTemplate(
            placeholderEngine,
            pending.config.dm_body_template,
            `Server: ${pending.guildName}\nClaimed at: ${claimedAt}`,
            dmContext
          );

          const dmDelivered = await interaction.user.send({
            flags: MessageFlags.IsComponentsV2,
            components: buildContainer({ title: dmTitle, body: dmBody, asset: pending.asset }),
            allowedMentions: { parse: [] }
          }).then(() => true).catch(() => false);

          dmStatus = dmDelivered
            ? 'Check your DMs.'
            : 'I could not DM the claim details, so keep this message instead.';
        }

        const templateContext = buildTemplateContext({
          type: pending.type,
          asset: pending.asset,
          guildName: pending.guildName,
          summonerId: pending.summonerId,
          actorId: interaction.user.id,
          claimerId: action === 'smash' ? interaction.user.id : '',
          claimedAt,
          commandName: pending.type,
          retryAfter: '',
          maxUses: pending.config.max_uses_per_member,
          windowSeconds: pending.config.cooldown_window_seconds,
          dmStatus
        });

        if (action === 'smash') {
          const title = renderTemplate(
            placeholderEngine,
            pending.config.claim_title_template,
            `${getTypeTitle(pending.type)} Claimed`,
            templateContext
          );
          const body = renderTemplate(
            placeholderEngine,
            pending.config.claim_body_template,
            `<@${interaction.user.id}> claimed this ${pending.type}. ${dmStatus}`,
            templateContext
          );
          const components = buildContainer({ title, body, asset: pending.asset });

          if (pending.config.claim_result_visibility === 'public') {
            scheduleMessageDelete(interaction.message, pending.config.resolved_drop_delete_seconds);
            return {
              type: 'UPDATE',
              content: null,
              components,
              allowedMentions: { parse: [] },
              flags: MessageFlags.IsComponentsV2
            } as unknown as InteractionResult;
          }

          scheduleMessageDelete(interaction.message, pending.config.resolved_drop_delete_seconds);
          return {
            type: 'MULTI',
            results: [
              { type: 'UPDATE', content: null, components: buildGenericResolvedComponents(pending), allowedMentions: { parse: [] }, flags: MessageFlags.IsComponentsV2 },
              {
                type: 'FOLLOW_UP', content: '', components, ephemeral: true, allowedMentions: { parse: [] },
                after: async (msg: Message) => { if (msg?.id) scheduleFollowUpDelete(interaction, msg.id, pending.config.ephemeral_notice_delete_seconds); }
              }
            ]
          } as unknown as InteractionResult;
        }

        const passTitle = renderTemplate(
          placeholderEngine,
          pending.config.pass_title_template,
          `${getTypeTitle(pending.type)} Passed`,
          templateContext
        );
        const passBody = renderTemplate(
          placeholderEngine,
          pending.config.pass_body_template,
          `<@${interaction.user.id}> passed on this ${pending.type}.`,
          templateContext
        );
        const passComponents = buildContainer({ title: passTitle, body: passBody, asset: pending.asset });

        if (pending.config.pass_result_visibility === 'public') {
          scheduleMessageDelete(interaction.message, pending.config.resolved_drop_delete_seconds);
          return {
            type: 'UPDATE',
            content: null,
            components: passComponents,
            allowedMentions: { parse: [] },
            flags: MessageFlags.IsComponentsV2
          } as unknown as InteractionResult;
        }

        scheduleMessageDelete(interaction.message, pending.config.resolved_drop_delete_seconds);
          return {
            type: 'MULTI',
            results: [
              { type: 'UPDATE', content: null, components: buildGenericResolvedComponents(pending), allowedMentions: { parse: [] }, flags: MessageFlags.IsComponentsV2 },
              {
                type: 'FOLLOW_UP', content: '', components: passComponents, ephemeral: true, allowedMentions: { parse: [] },
                after: async (msg: Message) => { if (msg?.id) scheduleFollowUpDelete(interaction, msg.id, pending.config.ephemeral_notice_delete_seconds); }
              }
            ]
          } as unknown as InteractionResult;
      }
    }
  ]
};
