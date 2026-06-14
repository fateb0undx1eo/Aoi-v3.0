import { fetchMany } from '../database/repository.js';
import type { ConfigService } from './configService.js';
import type { ModuleConfigRow } from '../types/database.js';

const NEKOS_API_BASE = 'https://nekos.best/api/v2';
const NEKOS_FETCH_TIMEOUT_MS = 12_000;

interface FunConfigOptions {
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

export const DEFAULT_FUN_CONFIG: FunConfigOptions = {
  shared_cooldown_across_types: true,
  max_uses_per_member: 3,
  cooldown_window_seconds: 3600,
  interaction_timeout_seconds: 1800,
  resolved_drop_delete_seconds: 20,
  ephemeral_notice_delete_seconds: 15,
  claim_result_visibility: 'public',
  pass_result_visibility: 'public',
  smash_button_label: 'Smash',
  pass_button_label: 'Pass',
  summon_title_template: '{type_title} Drop',
  summon_body_template: 'A {type} dropped. Smash first to claim it or pass to clear it.',
  claim_title_template: '{type_title} Claimed',
  claim_body_template: '{claimer_mention} claimed this {type}. {dm_status}',
  pass_title_template: '{type_title} Passed',
  pass_body_template: '{actor_mention} passed on this {type}.',
  dm_title_template: 'You claimed your {type}',
  dm_body_template: 'Server: {server_name}\nClaimed at: {claimed_at}',
  cooldown_title_template: 'Slow Down',
  cooldown_body_template: 'You have used /{command_name} {max_uses} time(s) in {window_text}. Try again in {retry_after}.',
  expired_title_template: '{type_title} Expired',
  expired_body_template: 'Nobody claimed this {type} before the drop timed out.'
};

function clampInteger(value: any, minimum: number, maximum: number, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}

function normalizeVisibility(value: any, fallback: string = 'public'): string {
  return value === 'ephemeral' ? 'ephemeral' : fallback;
}

function normalizeLabel(value: any, fallback: string): string {
  const normalized = String(value ?? '').trim().slice(0, 40);
  return normalized || fallback;
}

function normalizeTemplate(value: any, fallback: string, maxLength: number = 1200): string {
  const normalized = String(value ?? '').trim().slice(0, maxLength);
  return normalized || fallback;
}

function normalizeCharacterType(type: string): 'husbando' | 'waifu' {
  return type === 'husbando' ? 'husbando' : 'waifu';
}

function getCooldownBucket(commandName: string, config: FunConfigOptions): string {
  const normalizedCommand = normalizeCharacterType(commandName);
  return config.shared_cooldown_across_types ? 'summon' : normalizedCommand;
}

function isValidUrl(value: any): boolean {
  return /^https?:\/\//i.test(String(value ?? '').trim());
}

export function normalizeFunConfig(config: Record<string, any> = {}): FunConfigOptions {
  return {
    shared_cooldown_across_types: config.shared_cooldown_across_types !== false,
    max_uses_per_member: clampInteger(
      config.max_uses_per_member,
      1,
      25,
      DEFAULT_FUN_CONFIG.max_uses_per_member
    ),
    cooldown_window_seconds: clampInteger(
      config.cooldown_window_seconds,
      60,
      86_400,
      DEFAULT_FUN_CONFIG.cooldown_window_seconds
    ),
    interaction_timeout_seconds: clampInteger(
      config.interaction_timeout_seconds,
      30,
      43_200,
      DEFAULT_FUN_CONFIG.interaction_timeout_seconds
    ),
    resolved_drop_delete_seconds: clampInteger(
      config.resolved_drop_delete_seconds,
      0,
      3_600,
      DEFAULT_FUN_CONFIG.resolved_drop_delete_seconds
    ),
    ephemeral_notice_delete_seconds: clampInteger(
      config.ephemeral_notice_delete_seconds,
      0,
      840,
      DEFAULT_FUN_CONFIG.ephemeral_notice_delete_seconds
    ),
    claim_result_visibility: normalizeVisibility(
      config.claim_result_visibility,
      DEFAULT_FUN_CONFIG.claim_result_visibility
    ),
    pass_result_visibility: normalizeVisibility(
      config.pass_result_visibility,
      DEFAULT_FUN_CONFIG.pass_result_visibility
    ),
    smash_button_label: normalizeLabel(
      config.smash_button_label,
      DEFAULT_FUN_CONFIG.smash_button_label
    ),
    pass_button_label: normalizeLabel(
      config.pass_button_label,
      DEFAULT_FUN_CONFIG.pass_button_label
    ),
    summon_title_template: normalizeTemplate(
      config.summon_title_template,
      DEFAULT_FUN_CONFIG.summon_title_template,
      120
    ),
    summon_body_template: normalizeTemplate(
      config.summon_body_template,
      DEFAULT_FUN_CONFIG.summon_body_template,
      1500
    ),
    claim_title_template: normalizeTemplate(
      config.claim_title_template,
      DEFAULT_FUN_CONFIG.claim_title_template,
      120
    ),
    claim_body_template: normalizeTemplate(
      config.claim_body_template,
      DEFAULT_FUN_CONFIG.claim_body_template,
      1500
    ),
    pass_title_template: normalizeTemplate(
      config.pass_title_template,
      DEFAULT_FUN_CONFIG.pass_title_template,
      120
    ),
    pass_body_template: normalizeTemplate(
      config.pass_body_template,
      DEFAULT_FUN_CONFIG.pass_body_template,
      1500
    ),
    dm_title_template: normalizeTemplate(
      config.dm_title_template,
      DEFAULT_FUN_CONFIG.dm_title_template,
      120
    ),
    dm_body_template: normalizeTemplate(
      config.dm_body_template,
      DEFAULT_FUN_CONFIG.dm_body_template,
      1500
    ),
    cooldown_title_template: normalizeTemplate(
      config.cooldown_title_template,
      DEFAULT_FUN_CONFIG.cooldown_title_template,
      120
    ),
    cooldown_body_template: normalizeTemplate(
      config.cooldown_body_template,
      DEFAULT_FUN_CONFIG.cooldown_body_template,
      1500
    ),
    expired_title_template: normalizeTemplate(
      config.expired_title_template,
      DEFAULT_FUN_CONFIG.expired_title_template,
      120
    ),
    expired_body_template: normalizeTemplate(
      config.expired_body_template,
      DEFAULT_FUN_CONFIG.expired_body_template,
      1500
    )
  };
}

interface CooldownResult {
  allowed: boolean;
  retryAfterSeconds: number;
  usedCount: number;
  bucket: string;
  config: FunConfigOptions;
}

interface CharacterResult {
  type: string;
  url: string;
  sourceUrl: string;
  artistName: string;
  artistHref: string;
}

interface NekosApiResponse {
  results?: Array<{
    url?: string;
    source_url?: string;
    artist_name?: string;
    artist_href?: string;
  }>;
}

export class FunService {
  private configService: ConfigService;
  private cooldowns: Map<string, number[]>;

  constructor({ configService }: { configService: ConfigService }) {
    this.configService = configService;
    this.cooldowns = new Map();
  }

  async getModuleRow(guildId: string): Promise<ModuleConfigRow | null> {
    return this.configService.getModuleConfig(guildId, 'fun').catch(() => null);
  }

  getConfigFromModuleRow(row: ModuleConfigRow | null): FunConfigOptions {
    return normalizeFunConfig(row?.config ?? {});
  }

  async getGuildConfig(guildId: string): Promise<FunConfigOptions> {
    const row = await this.getModuleRow(guildId);
    return this.getConfigFromModuleRow(row);
  }

  async isModuleEnabled(guildId: string): Promise<boolean> {
    const row = await this.getModuleRow(guildId);
    return row?.enabled !== false;
  }

  async checkCommandCooldown(guildId: string, userId: string, commandName: string, rawConfig: Record<string, any> | null = null): Promise<CooldownResult> {
    const config = normalizeFunConfig(rawConfig ?? (await this.getGuildConfig(guildId)) as any);
    const bucket = getCooldownBucket(commandName, config);
    const usages = this._getActiveCooldowns(guildId, userId, bucket, config.cooldown_window_seconds);

    if (usages.length < config.max_uses_per_member) {
      return {
        allowed: true,
        retryAfterSeconds: 0,
        usedCount: usages.length,
        bucket,
        config
      };
    }

    const oldestActive = usages[0] ?? Date.now();
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(((oldestActive + (config.cooldown_window_seconds * 1000)) - Date.now()) / 1000)
    );

    return {
      allowed: false,
      retryAfterSeconds,
      usedCount: usages.length,
      bucket,
      config
    };
  }

  async recordCommandUse(guildId: string, userId: string, commandName: string, rawConfig: Record<string, any> | null = null): Promise<void> {
    const config = normalizeFunConfig(rawConfig ?? (await this.getGuildConfig(guildId)) as any);
    const bucket = getCooldownBucket(commandName, config);
    const key = this._cooldownKey(guildId, userId, bucket);
    const usages = this._getActiveCooldowns(guildId, userId, bucket, config.cooldown_window_seconds);
    usages.push(Date.now());
    this.cooldowns.set(key, usages);
  }

  async fetchCharacter(type: string): Promise<CharacterResult> {
    const normalizedType = normalizeCharacterType(type);
    let response: Response;

    try {
      response = await fetch(`${NEKOS_API_BASE}/${normalizedType}`, {
        headers: {
          'User-Agent': 'aoi-v3-fun-module/1.0'
        },
        signal: AbortSignal.timeout(NEKOS_FETCH_TIMEOUT_MS)
      });
    } catch (error: any) {
      throw new Error(`Failed to reach Nekos API: ${error?.message || 'network error'}`);
    }

    if (!response.ok) {
      throw new Error(`Nekos API returned ${response.status}`);
    }

    const payload = await response.json() as NekosApiResponse;
    const item = payload?.results?.[0];

    if (!item?.url) {
      throw new Error('Nekos API returned no image.');
    }

    return {
      type: normalizedType,
      url: String(item.url).trim(),
      sourceUrl: isValidUrl(item.source_url) ? String(item.source_url).trim() : '',
      artistName: String(item.artist_name ?? '').trim(),
      artistHref: isValidUrl(item.artist_href) ? String(item.artist_href).trim() : ''
    };
  }

  private _cooldownKey(guildId: string, userId: string, bucket: string): string {
    return `${guildId}:${userId}:${bucket}`;
  }

  private _getActiveCooldowns(guildId: string, userId: string, bucket: string, cooldownWindowSeconds: number): number[] {
    const key = this._cooldownKey(guildId, userId, bucket);
    const cutoff = Date.now() - (cooldownWindowSeconds * 1000);
    const current = this.cooldowns.get(key) ?? [];
    const active = current.filter((timestamp) => Number.isFinite(timestamp) && timestamp >= cutoff);

    if (active.length > 0) {
      this.cooldowns.set(key, active);
    } else {
      this.cooldowns.delete(key);
    }

    return active;
  }
}
