import { MessageFlags } from 'discord.js';
import { logger } from '../utils/logger.js';

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
  staff_role_ids: [],
  rank_tier_role_ids: [],
  managed_message_channel_id: '',
  managed_message_id: '',
  tracked_staff: {}
});
const MIN_SECONDS_INTERVAL = 30;
const MESSAGE_LINK_PATTERN = /https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/i;

function normalizeUnit(unit) {
  if (unit === 'seconds' || unit === 'hours') {
    return unit;
  }
  return 'minutes';
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeIntervalValue(value, unit) {
  const parsed = toPositiveInteger(value, DEFAULT_CONFIG.interval_value);
  if (unit === 'seconds') {
    return Math.max(MIN_SECONDS_INTERVAL, parsed);
  }
  return parsed;
}

function intervalToMs(config) {
  const unit = normalizeUnit(config.interval_unit);
  const value = normalizeIntervalValue(config.interval_value, unit);

  if (unit === 'seconds') return value * 1000;
  if (unit === 'hours') return value * 60 * 60 * 1000;
  return value * 60 * 1000;
}

function uniqueIds(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
  )];
}

function normalizeTrackedStaff(value) {
  const entries = Object.entries(value && typeof value === 'object' ? value : {});
  const normalized = {};

  for (const [memberId, trackedAt] of entries) {
    const date = new Date(trackedAt);
    if (!Number.isNaN(date.getTime())) {
      normalized[String(memberId)] = date.toISOString();
    }
  }

  return normalized;
}

function normalizeConfig(config = {}) {
  const intervalUnit = normalizeUnit(config.interval_unit);
  const staffRoleIds = uniqueIds(config.staff_role_ids);
  const requestedRankTiers = uniqueIds(config.rank_tier_role_ids);
  const rankTierRoleIds = requestedRankTiers.filter((roleId) => staffRoleIds.includes(roleId));
  const remainingStaffRoleIds = staffRoleIds.filter((roleId) => !rankTierRoleIds.includes(roleId));

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
    tracked_staff: normalizeTrackedStaff(config.tracked_staff)
  };
}

function parseMessageLink(link) {
  const match = MESSAGE_LINK_PATTERN.exec(String(link ?? '').trim());
  if (!match) {
    return null;
  }

  return {
    guildId: match[1],
    channelId: match[2],
    messageId: match[3]
  };
}

function bucketForStatus(status) {
  if (status === 'online') return 'active';
  if (status === 'idle') return 'partial';
  return 'inactive';
}

function buildOverallStatus(totalCount, activeCount) {
  if (totalCount === 0) {
    return {
      label: 'No Staff',
      summary: 'No staff members are currently configured.'
    };
  }

  if (activeCount === totalCount) {
    return {
      label: 'Good',
      summary: `${activeCount}/${totalCount} staff are active right now.`
    };
  }

  if (activeCount >= Math.ceil(totalCount / 2)) {
    return {
      label: 'Maybe',
      summary: `${activeCount}/${totalCount} staff are active right now.`
    };
  }

  return {
    label: 'Bad',
    summary: `${activeCount}/${totalCount} staff are active right now.`
  };
}

function buildBucketLines(title, members) {
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

function buildComponents({ introText, totalCount, activityStatus, counts, sections }) {
  return [
    {
      type: 17,
      components: [
        {
          type: 10,
          content: '# Staff Directory'
        },
        {
          type: 10,
          content: introText
        },
        {
          type: 14,
          divider: true,
          spacing: 1
        },
        {
          type: 10,
          content: [
            `Total Staff Count: ${totalCount}`,
            `Activity Status: ${activityStatus.label} - ${activityStatus.summary}`,
            `Buckets: ${counts.active} active, ${counts.partial} partially active, ${counts.inactive} inactive`,
            `Updated: <t:${Math.floor(Date.now() / 1000)}:R>`
          ].join('\n')
        },
        {
          type: 14,
          divider: true,
          spacing: 1
        },
        ...sections.map((content) => ({
          type: 10,
          content
        }))
      ]
    }
  ];
}

export class StaffListService {
  constructor({ client, configService, configCache }) {
    this.client = client;
    this.configService = configService;
    this.configCache = configCache;
    this.timers = new Map();
  }

  async getModuleRow(guildId) {
    return this.configService.getModuleConfig(guildId, 'tools').catch(() => null);
  }

  getConfigFromModuleRow(row) {
    return normalizeConfig(row?.config?.[FEATURE_KEY] ?? DEFAULT_CONFIG);
  }

  async getGuildConfig(guildId) {
    const cached = this.configCache.getModuleConfig(guildId, 'tools');
    if (cached) {
      return this.getConfigFromModuleRow(cached);
    }

    const row = await this.getModuleRow(guildId);
    return this.getConfigFromModuleRow(row);
  }

  async persistGuildConfig(guildId, nextConfig) {
    const row = await this.getModuleRow(guildId);
    await this.configService.upsertModuleConfig({
      guild_id: guildId,
      module_name: 'tools',
      enabled: row?.enabled ?? true,
      config: {
        ...(row?.config ?? {}),
        [FEATURE_KEY]: nextConfig
      }
    });
    await this.configCache.refreshGuild(guildId);
  }

  async updateGuildConfig(guildId, updates = {}) {
    const row = await this.getModuleRow(guildId);
    const nextConfig = normalizeConfig({
      ...this.getConfigFromModuleRow(row),
      ...updates
    });

    await this.configService.upsertModuleConfig({
      guild_id: guildId,
      module_name: 'tools',
      enabled: row?.enabled ?? true,
      config: {
        ...(row?.config ?? {}),
        [FEATURE_KEY]: nextConfig
      }
    });

    await this.configCache.refreshGuild(guildId);
    return nextConfig;
  }

  clearGuildTimer(guildId) {
    const timer = this.timers.get(guildId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(guildId);
    }
  }

  scheduleGuild(guildId, config) {
    this.clearGuildTimer(guildId);

    if (!config.enabled || config.staff_role_ids.length === 0) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        await this.syncGuild(guildId, { publishNow: true });
      } catch (error) {
        logger.warn(`Staff list refresh failed for guild ${guildId}: ${error?.message || 'unknown error'}`);
      }
    }, intervalToMs(config));

    this.timers.set(guildId, timer);
  }

  async maybeWarmMembers(guild, config) {
    if (guild.memberCount > 1000 || guild.members.cache.size >= guild.memberCount) {
      return;
    }

    // Small guilds can afford a full member warm for accurate role and presence snapshots.
    await guild.members.fetch().catch(() => null);
  }

  getTierLabel(member, guild, config) {
    const rankedRoleId = config.rank_tier_role_ids.find((roleId) => member.roles.cache.has(roleId));
    if (rankedRoleId) {
      return guild.roles.cache.get(rankedRoleId)?.name ?? 'Staff';
    }

    const fallbackRole = config.staff_role_ids
      .map((roleId) => guild.roles.cache.get(roleId))
      .filter(Boolean)
      .find((role) => member.roles.cache.has(role.id));

    return fallbackRole?.name ?? 'Staff';
  }

  async collectStaffSnapshot(guild, config) {
    await this.maybeWarmMembers(guild, config);

    const trackedStaff = { ...config.tracked_staff };
    const staffMembers = new Map();
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
        trackedAt: trackedStaff[member.id],
        rankIndex: rankIndex === -1 ? Number.MAX_SAFE_INTEGER : rankIndex,
        tierLabel: this.getTierLabel(member, guild, config),
        bucket: bucketForStatus(status),
        status
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
      trackedChanged
    };
  }

  async buildRenderedPayload(guild, config) {
    const { entries, trackedStaff, trackedChanged } = await this.collectStaffSnapshot(guild, config);
    const buckets = {
      active: entries.filter((entry) => entry.bucket === 'active'),
      partial: entries.filter((entry) => entry.bucket === 'partial'),
      inactive: entries.filter((entry) => entry.bucket === 'inactive')
    };
    const activityStatus = buildOverallStatus(entries.length, buckets.active.length);

    return {
      nextConfig: normalizeConfig({
        ...config,
        tracked_staff: trackedStaff
      }),
      trackedChanged,
      components: buildComponents({
        introText: config.intro_text,
        totalCount: entries.length,
        activityStatus,
        counts: {
          active: buckets.active.length,
          partial: buckets.partial.length,
          inactive: buckets.inactive.length
        },
        sections: [
          buildBucketLines('Active', buckets.active),
          buildBucketLines('Partially Active', buckets.partial),
          buildBucketLines('Inactive', buckets.inactive)
        ]
      })
    };
  }

  async fetchTargetMessage(guild, config) {
    const explicitTarget = config.update_mode === 'edit_existing'
      ? parseMessageLink(config.existing_message_link)
      : null;

    const target = explicitTarget ?? (
      config.managed_message_channel_id && config.managed_message_id
        ? {
            guildId: guild.id,
            channelId: config.managed_message_channel_id,
            messageId: config.managed_message_id
          }
        : null
    );

    if (!target || target.guildId !== guild.id) {
      return null;
    }

    const channel = guild.channels.cache.get(target.channelId) ?? await guild.channels.fetch(target.channelId).catch(() => null);
    if (!channel || !channel.isTextBased() || !channel.messages?.fetch) {
      return null;
    }

    const message = await channel.messages.fetch(target.messageId).catch(() => null);
    if (!message) {
      return null;
    }

    return {
      channel,
      message
    };
  }

  async sendNewMessage(guild, config, components) {
    const channel = guild.channels.cache.get(config.channel_id) ?? await guild.channels.fetch(config.channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      throw new Error('Configured staff list channel could not be resolved.');
    }

    const message = await channel.send({
      flags: MessageFlags.IsComponentsV2,
      components,
      allowedMentions: { parse: [] }
    });

    return {
      channelId: channel.id,
      messageId: message.id
    };
  }

  async publishGuildList(guildId, options = {}) {
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

    let target = null;
    if (!forceNewMessage) {
      target = await this.fetchTargetMessage(guild, nextConfig);
    }

    if (target?.message) {
      await target.message.edit({
        flags: MessageFlags.IsComponentsV2,
        components,
        allowedMentions: { parse: [] }
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

  async syncGuild(guildId, options = {}) {
    const config = await this.getGuildConfig(guildId);

    if (options.publishNow) {
      await this.publishGuildList(guildId, options);
    }

    this.scheduleGuild(guildId, config);
    return config;
  }

  async restoreAll(guildIds = []) {
    await Promise.all(guildIds.map((guildId) => this.syncGuild(guildId, { publishNow: true })));
  }

  async handleRoleChange(oldMember, newMember) {
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

