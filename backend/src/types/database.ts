// ─── Database Row Types ───────────────────────────────────────

export interface GuildRow {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  bot: boolean;
  created_at: string;
}

export interface GuildMemberRow {
  guild_id: string;
  user_id: string;
  roles: string[];
  joined_at: string;
  nick: string | null;
}

export interface ModuleConfigRow {
  guild_id: string;
  module_name: string;
  enabled: boolean;
  config: Record<string, any>;
  updated_at: string;
}

export interface CommandConfigRow {
  guild_id: string;
  command_name: string;
  enabled: boolean;
  overrides: Record<string, any> | null;
  updated_at: string;
}

export interface EmbedRow {
  id: string;
  guild_id: string;
  name: string;
  embed_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PlaceholderRow {
  id: string;
  name: string;
  value: string;
  guild_id: string | null;
}

export interface GuildLogRow {
  id: string;
  guild_id: string;
  event_type: string;
  channel_id: string;
  enabled: boolean;
  config: Record<string, any> | null;
}

export interface ErrorLogRow {
  id: string;
  guild_id: string | null;
  error_type: string;
  error_message: string;
  stack_trace: string | null;
  context: Record<string, any> | null;
  created_at: string;
}

export interface MemberAnalyticsRow {
  guild_id: string;
  user_id: string;
  message_count: number;
  voice_minutes: number;
  last_active: string;
  joined_at: string | null;
  left_at: string | null;
}

export interface StaffActivityRow {
  id: string;
  guild_id: string;
  user_id: string;
  action: string;
  target_id: string;
  reason: string | null;
  created_at: string;
}

export interface ModCaseRow {
  id: string;
  case_id: number;
  guild_id: string;
  user_id: string;
  moderator_id: string;
  action: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModConfigRow {
  guild_id: string;
  config: Record<string, any>;
  updated_at: string;
}

export interface AutoModRuleRow {
  id: string;
  guild_id: string;
  name: string;
  enabled: boolean;
  rule_type: string;
  config: Record<string, any>;
  created_at: string;
}

export interface AutoResponderRow {
  id: string;
  guild_id: string;
  trigger: string;
  response: string;
  enabled: boolean;
  match_type: string;
  created_at: string;
}

export interface TicketPanelRow {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  title: string;
  description: string | null;
  category_id: string | null;
  support_role_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface TicketRow {
  id: string;
  guild_id: string;
  channel_id: string;
  user_id: string;
  status: string;
  panel_id: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface AnalyticsRow {
  id: string;
  guild_id: string;
  metric: string;
  value: number;
  period: string;
  recorded_at: string;
}

export interface DashboardAccessRow {
  guild_id: string;
  user_id: string;
  access_level: string;
  created_at: string;
}

export interface StaffRatingRow {
  id: string;
  guild_id: string;
  target_id: string;
  rater_id: string;
  rating: number;
  created_at: string;
}

// ─── Config Schemas (typed) ───────────────────────────────────
export interface CommunityConfig {
  messages: Record<string, any>;
  dm_welcomer: {
    enabled: boolean;
    title: string;
    message: string;
    image_url: string;
  } | null;
  uwu: {
    delete_non_uwu: boolean;
    notify: boolean;
  } | null;
  staff_rating: {
    cooldown_seconds: number;
  } | null;
  role_color_rotation: {
    enabled: boolean;
    interval_value: number;
    interval_unit: string;
    role_ids: string[];
  } | null;
  meme_autopost: {
    enabled: boolean;
    interval_value: number;
    interval_unit: string;
    channel_id: string;
    ping_role_id: string;
    subreddits: string[];
  } | null;
  auto_responder: {
    enabled: boolean;
    entries: Array<{
      trigger: string;
      response: string;
      match_type: 'exact' | 'contains' | 'starts';
      cooldown_seconds: number;
    }>;
  } | null;
  sticky_messages: {
    enabled: boolean;
    message: string;
    channel_ids: string[];
  } | null;
  premium: {
    enabled: boolean;
    responses: Array<{
      keyword: string;
      response: string;
    }>;
  } | null;
}

export interface ModerationConfig {
  ghost_ping_window_seconds: number;
  ping_protection_roles: string[];
  afk: Record<string, any>;
  loa: Record<string, any>;
  case_command: {
    default_timeout_minutes: number;
    log_channel_id: string;
    allowed_role_ids: string[];
  };
}

export interface FunConfig {
  [key: string]: any;
}

export interface ToolsConfig {
  [key: string]: any;
}

export interface LeaderboardConfig {
  [key: string]: any;
}
