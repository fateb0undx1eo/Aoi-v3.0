import { EmbedBuilder, MessageFlags, WebhookClient } from 'discord.js';
import { nanoid } from 'nanoid';
import type { BotContext, PlaceholderEngine } from '../../types/index.js';
import type { Message } from 'discord.js';

export const MEME_ACTION_PREFIX = 'memes:autopost';
export const pendingMemeAutopostActions = new Map<string, PendingMemeAction>();
export const premiumFeatureCooldowns = new Map<string, number>();

setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of premiumFeatureCooldowns) {
    if (expiresAt <= now) premiumFeatureCooldowns.delete(key);
  }
}, 60_000).unref();

export interface PremiumTriggerConfig {
  id: string;
  trigger: string;
  response_links: string[];
  footer_text: string;
  delete_trigger_message: boolean;
  use_main_roles: boolean;
  role_ids: string[];
}

export interface PremiumFeatureConfig {
  enabled: boolean;
  cooldown_seconds: number;
  webhook_enabled: boolean;
  webhook_url: string;
  role_ids: string[];
  triggers: PremiumTriggerConfig[];
}

export interface PendingMemeAction {
  guildId: string;
  issuerId: string;
  timeout: ReturnType<typeof setTimeout>;
  createdAt: number;
}

export interface MemeAutopostStats {
  fetched_at: string;
  subreddit: string;
  result_count: number;
}

export interface ProfileStyleConfig {
  enabled: boolean;
  font_id: number;
  effect_id: number;
  colors: number[];
}

export interface UwuLockResult {
  settings?: {
    delete_non_uwu: boolean;
    notify: boolean;
  };
}

export const COMMUNITY_SCHEMA = {
  type: 'object',
  properties: {
    messages: { type: 'object' },
    dm_welcomer: {
      type: 'object', properties: {
        enabled: { type: 'boolean' }, title: { type: 'string' }, message: { type: 'string' }, image_url: { type: 'string' }
      }
    },
    uwu: {
      type: 'object', properties: {
        delete_non_uwu: { type: 'boolean' }, notify: { type: 'boolean' }
      }
    },
    staff_rating: {
      type: 'object', properties: { cooldown_seconds: { type: 'number' } }
    },
    role_color_rotation: {
      type: 'object', properties: {
        enabled: { type: 'boolean' }, interval_value: { type: 'number' }, interval_unit: { type: 'string' }, role_ids: { type: 'array', items: { type: 'string' } }
      }
    },
    meme_autopost: {
      type: 'object', properties: {
        enabled: { type: 'boolean' }, interval_value: { type: 'number' }, interval_unit: { type: 'string' },
        channel_id: { type: 'string' }, ping_role_id: { type: 'string' }, subreddits: { type: 'array', items: { type: 'string' } }
      }
    },
    bot_looks: {
      type: 'object', properties: {
        enabled: { type: 'boolean' }, status: { type: 'string' }, activity_type: { type: 'string' },
        activity_text: { type: 'string' }, custom_status: { type: 'string' }, streaming_url: { type: 'string' }
      }
    },
    profile_style: {
      type: 'object', properties: {
        enabled: { type: 'boolean' }, font_id: { type: 'number' }, effect_id: { type: 'number' }, colors: { type: 'array', items: { type: 'number' } }
      }
    },
    premium_feature_1: {
      type: 'object', properties: {
        enabled: { type: 'boolean' }, cooldown_seconds: { type: 'number' }, webhook_enabled: { type: 'boolean' },
        webhook_url: { type: 'string' }, role_ids: { type: 'array', items: { type: 'string' } },
        triggers: {
          type: 'array', items: {
            type: 'object', properties: {
              id: { type: 'string' }, trigger: { type: 'string' }, response_links: { type: 'array', items: { type: 'string' } },
              footer_text: { type: 'string' }, delete_trigger_message: { type: 'boolean' },
              use_main_roles: { type: 'boolean' }, role_ids: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    }
  }
} as const;

export const FONT_PAIRS: Array<[string, number]> = [
  ['Bangers', 1], ['BioRhyme', 2], ['Cherry Bomb', 3], ['Chicle', 4],
  ['Compagnon', 5], ['MuseoModerno', 6], ['Neo-Castel', 7], ['Pixelify Sans', 8],
  ['Ribes', 9], ['Sinistre', 10], ['Default', 11], ['Zilla Slab', 12]
];

export const EFFECT_PAIRS: Array<[string, number]> = [
  ['Solid', 1], ['Gradient', 2], ['Neon', 3], ['Toon', 4], ['Pop', 5], ['Glow', 6]
];

export function buildEmbed(title: string, description: string, color: number): EmbedBuilder {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
}

export function isUwuMessage(content: string): boolean {
  return /uwu|owo|uvu/i.test(content);
}

export function normalizePremiumTrigger(rawTrigger: Record<string, any> | undefined | null): PremiumTriggerConfig {
  const responseLinks = Array.isArray(rawTrigger?.response_links)
    ? rawTrigger.response_links.map((value: any) => String(value ?? '').trim()).filter((value: string) => /^https?:\/\//i.test(value))
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

export function normalizePremiumFeatureConfig(rawConfig: Record<string, any> | undefined | null): PremiumFeatureConfig {
  const triggers = Array.isArray(rawConfig?.triggers)
    ? rawConfig.triggers.map(normalizePremiumTrigger).filter((entry) => entry.trigger && entry.response_links.length > 0)
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

export function buildPremiumFeatureComponents(triggerConfig: PremiumTriggerConfig): any[] {
  const components: any[] = [];
  if (triggerConfig.response_links.length > 0) {
    components.push({ type: 12, items: triggerConfig.response_links.map((url) => ({ media: { url } })) });
  }
  if (triggerConfig.footer_text) {
    if (components.length > 0) components.push({ type: 14, divider: true, spacing: 1 });
    components.push({ type: 10, content: triggerConfig.footer_text });
  }
  return [{ type: 17, components }];
}

export function getPremiumFeatureCooldownKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

export async function sendPremiumFeatureResponse({ message, config, triggerConfig }: { message: Message; config: PremiumFeatureConfig; triggerConfig: PremiumTriggerConfig }): Promise<void> {
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

export function buildMemeAutopostControlEmbed(config: Record<string, any>, stats: MemeAutopostStats[] = []): EmbedBuilder {
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
      '', latest || 'No recent autopost stats recorded yet.', '',
      'Use the buttons below to start or stop the autopost. Use the Community page on the dashboard to edit the channel, role, subreddits, or timing.'
    ].join('\n'), 0x5865f2
  );
}

export function buildMemeAutopostButtons(token: string, enabled: boolean): any[] {
  return [{
    type: 1,
    components: [
      { type: 2, custom_id: `${MEME_ACTION_PREFIX}:${token}:start`, label: 'Start', style: 3, disabled: enabled },
      { type: 2, custom_id: `${MEME_ACTION_PREFIX}:${token}:stop`, label: 'Stop', style: 4, disabled: !enabled }
    ]
  }];
}

export function storePendingAction(store: Map<string, any>, data: Record<string, any>): string {
  const token = nanoid();
  const timeout = setTimeout(() => { store.delete(token); }, 600000);
  store.set(token, { ...data, timeout, createdAt: Date.now() });
  return token;
}

export function buildProfileModal(config: Record<string, any>) {
  const fontId = String(config.font_id ?? 11);
  const effectId = String(config.effect_id ?? 1);
  const color1 = config.colors?.[0] != null ? `#${Number(config.colors[0]).toString(16).padStart(6, '0').toUpperCase()}`.replace('#', '') : '';
  const color2 = config.colors?.[1] != null ? `#${Number(config.colors[1]).toString(16).padStart(6, '0').toUpperCase()}`.replace('#', '') : '';

  return {
    custom_id: 'profile_modal',
    title: 'AOI Profile Style',
    components: [
      {
        type: 18, label: 'Choose a font',
        component: {
          type: 3, custom_id: 'profile:font',
          placeholder: FONT_PAIRS.find((f) => String(f[1]) === fontId)?.[0] ?? 'Select a font',
          options: FONT_PAIRS.map((f) => ({ value: String(f[1]), label: f[0], default: String(f[1]) === fontId }))
        }
      },
      {
        type: 18, label: 'Choose an effect',
        component: {
          type: 21, custom_id: 'profile:effect',
          options: EFFECT_PAIRS.map((e) => ({ value: String(e[1]), label: e[0], default: String(e[1]) === effectId }))
        }
      },
      {
        type: 1, components: [
          { type: 4, custom_id: 'profile:color1', label: 'Primary Color', placeholder: 'FF0000', style: 1, max_length: 6, required: false, value: color1 }
        ]
      },
      {
        type: 1, components: [
          { type: 4, custom_id: 'profile:color2', label: 'Secondary Color (for gradient only)', placeholder: '00FFFF', style: 1, max_length: 6, required: false, value: color2 }
        ]
      },
      { type: 18, label: 'RESET', component: { type: 23, custom_id: 'profile:reset', default: false } }
    ]
  };
}
