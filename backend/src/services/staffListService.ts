import type { Client, Guild, GuildMember, Role, TextBasedChannel, Message } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { logger } from '../utils/logger.js';
import type { ConfigService } from '../types/index.js';

const FEATURE_KEY = 'staff_list';
const DEFAULT_CONFIG = Object.freeze({
  enabled: false,
  channel_id: '',
  update_mode: 'new_message',
  existing_message_link: '',
  intro_text: 'Meet the staff team keeping the server running.',
  auto_update_on_role_change: true,
  show_join_date: true,
  interval_value: 30,
  interval_unit: 'minutes',
  staff_role_ids: ['1503719057130782810'],
  rank_tier_role_ids: [] as string[],
  managed_message_channel_id: '',
  managed_message_id: '',
  tracked_staff: {} as Record<string, string>,
});
const MIN_SECONDS_INTERVAL = 30;
const MESSAGE_LINK_PATTERN = /https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/i;

interface StaffListConfig {
  enabled: boolean;
  channel_id: string;
  update_mode: string;
  existing_message_link: string;
  intro_text: string;
  auto_update_on_role_change: boolean;
  show_join_date: boolean;
  interval_value: number;
  interval_unit: string;
  staff_role_ids: string[];
  rank_tier_role_ids: string[];
  managed_message_channel_id: string;
  managed_message_id: string;
  tracked_staff: Record<string, string>;
}

interface MessageLink {
  guildId: string;
  channelId: string;
  messageId: string;
}

interface ActivityStatus {
  label: string;
  summary: string;
}

interface StaffMemberEntry {
  id: string;
  displayName: string;
  trackedAt: string;
  rankIndex: number;
  tierLabel: string;
  bucket: string;
  status: string | null;
}

interface StaffSnapshot {
  entries: StaffMemberEntry[];
  trackedStaff: Record<string, string>;
  trackedChanged: boolean;
}

interface BucketCounts {
  active: number;
  partial: number;
  inactive: number;
}

interface BuildComponentsParams {
  introText: string;
  totalCount: number;
  activityStatus: ActivityStatus;
  counts: BucketCounts;
  sections: string[];
}

interface RenderedPayload {
  nextConfig: StaffListConfig;
  trackedChanged: boolean;
  components: any[];
}

interface TargetMessage {
  channel: TextBasedChannel;
  message: Message;
}

interface PublishResult {
  updated: boolean;
  reason?: string;
}

interface SyncOptions {
  publishNow?: boolean;
  forceNewMessage?: boolean;
}

interface StaffListServiceOptions {
  client: Client;
  configService: ConfigService;
  configCache: any;
}

function normalizeUnit(unit: string): string {
  if (unit === 'seconds' || unit === 'hours') {
    return unit;
  }
  return 'minutes';
}

function toPositiveInteger(value: any, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeIntervalValue(value: any, unit: string): number {
  const parsed = toPositiveInteger(value, DEFAULT_CONFIG.interval_value);
  if (unit === 'seconds') {
    return Math.max(MIN_SECONDS_INTERVAL, parsed);
  }
  return parsed;
}

function intervalToMs(config: StaffListConfig): number {
  const unit = normalizeUnit(config.interval_unit);
  const value = normalizeIntervalValue(config.interval_value, unit);

  if (unit === 'seconds') return value * 1000;
  if (unit === 'hours') return value * 60 * 60 * 1000;
  return value * 60 * 1000;
}

function uniqueIds(values: any): string[] {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value: any) => String(value ?? '').trim())
      .filter(Boolean)
  )];
}

function normalizeTrackedStaff(value: any): Record<string, string> {
  const entries = Object.entries(value && typeof value === 'object' ? value : {});
  const normalized: Record<string, string> = {};

  for (const [memberId, trackedAt] of entries) {
    const date = new Date(trackedAt as string);
    if (!Number.isNaN(date.getTime())) {
      normalized[String(memberId)] = date.toISOString();
    }
  }

  return normalized;
}

function normalizeConfig(config: Record<string, any> = {}): StaffListConfig {
  const intervalUnit = normalizeUnit(config.interval_unit);
  const staffRoleIds = uniqueIds(config.staff_role_ids);
  const requestedRankTiers = uniqueIds(config.rank_tier_role_ids);
  const rankTierRoleIds = requestedRankTiers.filter((roleId: string) => staffRoleIds.includes(roleId));
  const remainingStaffRoleIds = staffRoleIds.filter((roleId: string) => !rankTierRoleIds.includes(roleId));

  return {
    enabled: Boolean(config.enabled),
    channel_id: String(config.channel_id ?? '').trim(),
    update_mode: config.update_mode === 'edit_existing' ? 'edit_existing' : 'new_message',
    existing_message_link: String(config.existing_message_link ?? '').trim(),
    intro_text: String(config.intro_text ?? DEFAULT_CONFIG.intro_text).trim().slice(0, 800) || DEFAULT_CONFIG.intro_text,
    auto_update_on_role_change: config.auto_update_on_role_change !== false,
    show_join_date: config.show_join_date !== false,
    interval_value: normalizeIntervalValue(config.interval_value, intervalUnit),
    interval_unit: intervalUnit,
    staff_role_ids: staffRoleIds,
    rank_tier_role_ids: [...rankTierRoleIds, ...remainingStaffRoleIds],
    managed_message_channel_id: String(config.managed_message_channel_id ?? '').trim(),
    managed_message_id: String(config.managed_message_id ?? '').trim(),
    tracked_staff: normalizeTrackedStaff(config.tracked_staff),
  };
}

function parseMessageLink(link: string): MessageLink | null {
  const match = MESSAGE_LINK_PATTERN.exec(String(link ?? '').trim());
  if (!match) {
    return null;
  }

  return {
    guildId: match[1]!,
    channelId: match[2]!,
    messageId: match[3]!,
  };
}

function bucketForStatus(status: string | null): string {
  if (status === 'online') return 'active';
  if (status === 'idle') return 'partial';
  return 'inactive';
}

function buildOverallStatus(totalCount: number, activeCount: number): ActivityStatus {
  if (totalCount === 0) {
    return {
      label: 'No Staff',
      summary: 'No staff members are currently configured.',
    };
  }

  if (activeCount === totalCount) {
    return {
      label: 'Good',
      summary: `${activeCount}/${totalCount} staff are active right now.`,
    };
  }

  if (activeCount >= Math.ceil(totalCount / 2)) {
    return {
      label: 'Maybe',
      summary: `${activeCount}/${totalCount} staff are active right now.`,
    };
  }

  return {
    label: 'Bad',
    summary: `${activeCount}/${totalCount} staff are active right now.`,
  };
}

function buildBucketLines(title: string, members: StaffMemberEntry[]): string {
  if (!members.length) {
    return `## ${title}\nNo staff are in this bucket right now.`;
  }

  const visible = members.slice(0, 25);
  const lines = visible.map((member) => `- <@${member.id}>`);

  if (members.length > visible.length) {
    lines.push(`- +${members.length - visible.length} more`);
  }

  return `## ${title} (${members.length})\n${lines.join('\n')}`;
}

function buildComponents(params: BuildComponentsParams): any[] {
  return [
    {
      type: 17,
      components: [
        {
          type: 10,
          content: '# Staff Directory',
        },
        {
          type: 10,
          content: params.introText,
        },
        {
          type: 14,
          divider: true,
          spacing: 1,
        },
        {
          type: 10,
          content: [
            `Total Staff Count: ${params.totalCount}`,
            `Activity Status: ${params.activityStatus.label} - ${params.activityStatus.summary}`,
            `Buckets: ${params.counts.active} active, ${params.counts.partial} partially active, ${params.counts.inactive} inactive`,
            `Updated: <t:${Math.floor(Date.now() / 1000)}:R>`,
          ].join('\n'),
        },
        {
          type: 14,
          divider: true,
          spacing: 1,
        },
        ...params.sections.map((content) => ({
          type: 10,
          content,
        })),
      ],
    },
  ];
}

export class StaffListService {
  private client: Client;
  private configService: ConfigService;
  private configCache: any;
  private timers: Map<string, ReturnType<typeof setTimeout>>;

  constructor({ client, configService, configCache }: StaffListServiceOptions) {
    this.client = client;
    this.configService = configService;
    this.configCache = configCache;
    this.timers = new Map();
  }

  async getModuleRow(guildId: string): Promise<Record<string, any> | null> {
    return this.configService.getModuleConfig(guildId, 'tools').catch(() => null);
  }

  getConfigFromModuleRow(row: Record<string, any> | null): StaffListConfig {
    return normalizeConfig((row?.config as Record<string, any>)?.[FEATURE_KEY] ?? DEFAULT_CONFIG);
  }

  async getGuildConfig(guildId: string): Promise<StaffListConfig> {
    const cached = this.configCache.getModuleConfig(guildId, 'tools');
    if (cached) {
      return this.getConfigFromModuleRow(cached);
    }

    const row = await this.getModuleRow(guildId);
    return this.getConfigFromModuleRow(row);
  }

  async persistGuildConfig(guildId: string, nextConfig: StaffListConfig): Promise<void> {
    const row = await this.getModuleRow(guildId);
    await this.configService.upsertModuleConfig({
      guild_id: guildId,
      module_name: 'tools',
      enabled: (row?.enabled as boolean) ?? true,
      config: {
        ...(row?.config as Record<string, any> ?? {}),
        [FEATURE_KEY]: nextConfig,
      },
    });
    await this.configCache.refreshGuild(guildId);
  }

  async updateGuildConfig(guildId: string, updates: Record<string, any> = {}): Promise<StaffListConfig> {
    const row = await this.getModuleRow(guildId);
    const nextConfig = normalizeConfig({
      ...this.getConfigFromModuleRow(row),
      ...updates,
    });

    await this.configService.upsertModuleConfig({
      guild_id: guildId,
      module_name: 'tools',
      enabled: (row?.enabled as boolean) ?? true,
      config: {
        ...(row?.config as Record<string, any> ?? {}),
        [FEATURE_KEY]: nextConfig,
      },
    });

    await this.configCache.refreshGuild(guildId);
    return nextConfig;
  }

  clearGuildTimer(guildId: string): void {
    const timer = this.timers.get(guildId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(guildId);
    }
  }

  scheduleGuild(guildId: string, config: StaffListConfig): void {
    this.clearGuildTimer(guildId);

    if (!config.enabled || config.staff_role_ids.length === 0) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        await this.syncGuild(guildId, { publishNow: true });
      } catch (error: any) {
        logger.warn(`Staff list refresh failed for guild ${guildId}: ${error?.message || 'unknown error'}`);
      }
    }, intervalToMs(config));

    this.timers.set(guildId, timer);
  }

  async maybeWarmMembers(guild: Guild, config: StaffListConfig): Promise<void> {
    if (guild.memberCount > 1000 || guild.members.cache.size >= guild.memberCount) {
      return;
    }

    await guild.members.fetch().catch(() => null);
  }

  getTierLabel(member: GuildMember, guild: Guild, config: StaffListConfig): string {
    const rankedRoleId = config.rank_tier_role_ids.find((roleId) => member.roles.cache.has(roleId));
    if (rankedRoleId) {
      return guild.roles.cache.get(rankedRoleId)?.name ?? 'Staff';
    }

    const fallbackRole = config.staff_role_ids
      .map((roleId) => guild.roles.cache.get(roleId))
      .filter(Boolean)
      .find((role) => member.roles.cache.has((role as Role).id));

    return (fallbackRole as Role)?.name ?? 'Staff';
  }

  async collectStaffSnapshot(guild: Guild, config: StaffListConfig): Promise<StaffSnapshot> {
    await this.maybeWarmMembers(guild, config);

    const trackedStaff: Record<string, string> = { ...config.tracked_staff };
    const staffMembers = new Map<string, GuildMember>();
    const nowIso = new Date().toISOString();

    for (const roleId of config.staff_role_ids) {
      const role = guild.roles.cache.get(roleId) ?? await guild.roles.fetch(roleId).catch(() => null);
      if (!role) {
        continue;
      }

      for (const member of role.members.values()) {
        if (member.user?.bot) {
          continue;
        }
        staffMembers.set(member.id, member);
      }
    }

    let trackedChanged = false;
    for (const memberId of Object.keys(trackedStaff)) {
      if (!staffMembers.has(memberId)) {
        delete trackedStaff[memberId];
        trackedChanged = true;
      }
    }

    const entries = [...staffMembers.values()].map((member) => {
      if (!trackedStaff[member.id]) {
        trackedStaff[member.id] = nowIso;
        trackedChanged = true;
      }

      const rankIndex = config.rank_tier_role_ids.findIndex((roleId) => member.roles.cache.has(roleId));
      const status = member.presence?.status ?? 'offline';

      return {
        id: member.id,
        displayName: member.displayName ?? member.user.username,
        trackedAt: trackedStaff[member.id] ?? nowIso,
        rankIndex: rankIndex === -1 ? Number.MAX_SAFE_INTEGER : rankIndex,
        tierLabel: this.getTierLabel(member, guild, config),
        bucket: bucketForStatus(status),
        status,
      };
    });

    entries.sort((left, right) => {
      if (left.rankIndex !== right.rankIndex) {
        return left.rankIndex - right.rankIndex;
      }

      const timeDelta = new Date(left.trackedAt).getTime() - new Date(right.trackedAt).getTime();
      if (timeDelta !== 0) {
        return timeDelta;
      }

      return left.displayName.localeCompare(right.displayName);
    });

    return {
      entries,
      trackedStaff,
      trackedChanged,
    };
  }

  async buildRenderedPayload(guild: Guild, config: StaffListConfig): Promise<RenderedPayload> {
    const { entries, trackedStaff, trackedChanged } = await this.collectStaffSnapshot(guild, config);
    const buckets = {
      active: entries.filter((entry) => entry.bucket === 'active'),
      partial: entries.filter((entry) => entry.bucket === 'partial'),
      inactive: entries.filter((entry) => entry.bucket === 'inactive'),
    };
    const activityStatus = buildOverallStatus(entries.length, buckets.active.length);

    return {
      nextConfig: normalizeConfig({
        ...config,
        tracked_staff: trackedStaff,
      }),
      trackedChanged,
      components: buildComponents({
        introText: config.intro_text,
        totalCount: entries.length,
        activityStatus,
        counts: {
          active: buckets.active.length,
          partial: buckets.partial.length,
          inactive: buckets.inactive.length,
        },
        sections: [
          buildBucketLines('Active', buckets.active),
          buildBucketLines('Partially Active', buckets.partial),
          buildBucketLines('Inactive', buckets.inactive),
        ],
      }),
    };
  }

  async fetchTargetMessage(guild: Guild, config: StaffListConfig): Promise<TargetMessage | null> {
    const explicitTarget = config.update_mode === 'edit_existing'
      ? parseMessageLink(config.existing_message_link)
      : null;

    const target = explicitTarget ?? (
      config.managed_message_channel_id && config.managed_message_id
        ? {
            guildId: guild.id,
            channelId: config.managed_message_channel_id,
            messageId: config.managed_message_id,
          }
        : null
    );

    if (!target || target.guildId !== guild.id) {
      return null;
    }

    const channel = guild.channels.cache.get(target.channelId) ?? await guild.channels.fetch(target.channelId).catch(() => null);
    if (!channel || !channel.isTextBased() || !(channel as TextBasedChannel).messages?.fetch) {
      return null;
    }

    const message = await (channel as TextBasedChannel).messages.fetch(target.messageId).catch(() => null);
    if (!message) {
      return null;
    }

    return {
      channel: channel as TextBasedChannel,
      message,
    };
  }

  async sendNewMessage(guild: Guild, config: StaffListConfig, components: any[]): Promise<{ channelId: string; messageId: string }> {
    const channel = guild.channels.cache.get(config.channel_id) ?? await guild.channels.fetch(config.channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      throw new Error('Configured staff list channel could not be resolved.');
    }

    const message = await (channel as any).send({
      flags: MessageFlags.IsComponentsV2,
      components,
      allowedMentions: { parse: [] },
    });

    return {
      channelId: channel.id,
      messageId: message.id,
    };
  }

  async publishGuildList(guildId: string, options: SyncOptions = {}): Promise<PublishResult> {
    const config = await this.getGuildConfig(guildId);
    if (!config.enabled || config.staff_role_ids.length === 0) {
      this.clearGuildTimer(guildId);
      return { updated: false, reason: 'disabled' };
    }

    const guild = this.client.guilds.cache.get(guildId) ?? await this.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      return { updated: false, reason: 'missing_guild' };
    }

    const { nextConfig, trackedChanged, components } = await this.buildRenderedPayload(guild, config);
    const forceNewMessage = options.forceNewMessage && nextConfig.update_mode === 'new_message';

    let target: TargetMessage | null = null;
    if (!forceNewMessage) {
      target = await this.fetchTargetMessage(guild, nextConfig);
    }

    if (target?.message) {
      await (target.message as any).edit({
        flags: MessageFlags.IsComponentsV2,
        components,
        allowedMentions: { parse: [] },
      });

      if (nextConfig.update_mode === 'new_message') {
        nextConfig.managed_message_channel_id = target.channel.id;
        nextConfig.managed_message_id = target.message.id;
      }
    } else if (nextConfig.update_mode === 'edit_existing') {
      throw new Error('The configured staff list message link could not be found.');
    } else {
      const created = await this.sendNewMessage(guild, nextConfig, components);
      nextConfig.managed_message_channel_id = created.channelId;
      nextConfig.managed_message_id = created.messageId;
    }

    if (
      trackedChanged ||
      nextConfig.managed_message_channel_id !== config.managed_message_channel_id ||
      nextConfig.managed_message_id !== config.managed_message_id
    ) {
      await this.persistGuildConfig(guildId, nextConfig);
    }

    return { updated: true };
  }

  async syncGuild(guildId: string, options: SyncOptions = {}): Promise<StaffListConfig> {
    const config = await this.getGuildConfig(guildId);

    if (options.publishNow) {
      await this.publishGuildList(guildId, options);
    }

    this.scheduleGuild(guildId, config);
    return config;
  }

  async restoreAll(guildIds: string[] = []): Promise<void> {
    await Promise.all(guildIds.map((guildId) => this.syncGuild(guildId, { publishNow: true })));
  }

  async handleRoleChange(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    const config = await this.getGuildConfig(newMember.guild.id);
    if (!config.enabled || !config.auto_update_on_role_change || config.staff_role_ids.length === 0) {
      return;
    }

    const relevantChanged = config.staff_role_ids.some((roleId) =>
      oldMember.roles.cache.has(roleId) !== newMember.roles.cache.has(roleId)
    );

    if (!relevantChanged) {
      return;
    }

    await this.syncGuild(newMember.guild.id, { publishNow: true });
  }
}
