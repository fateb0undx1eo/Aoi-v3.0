import type {
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  Client,
  InteractionReplyOptions,
  MessagePayload,
  InteractionUpdateOptions,
  ModalBuilder,
  InteractionResponse,
  Message,
  Interaction,
} from 'discord.js';
import type { Redis } from 'ioredis';
import type { EnvConfig } from './env.js';

// ─── Re-export all types ──────────────────────────────────────
export * from './database.js';
export * from './env.js';
export * from './discord.js';

// ─── Context ──────────────────────────────────────────────────
export interface BotContext {
  database: typeof import('../database/repository.js');
  redis: RedisClient;
  discordClient: Client;
  rest: import('@discordjs/rest').REST;
  configCache: ConfigCache;
  configService: ConfigService;
  permissionService: PermissionService;
  rateLimiter: DynamicRateLimiter;
  authService: AuthService;
  guildService: GuildService;
  accessControlService: AccessControlService;
  analyticsService: AnalyticsService;
  moduleService: ModuleService;
  dashboardOverviewService: DashboardOverviewService;
  moderationService: ModerationService;
  settingsService: SettingsService;
  announcementService: AnnouncementService;
  dmBroadcastService: DmBroadcastService;
  roleColorRotationService: RoleColorRotationService;
  memeService: MemeService;
  botLooksService: BotLooksService;
  staffListService: StaffListService;
  profileStyleService: ProfileStyleService;
  staffRatingService: StaffRatingService;
  communityService: CommunityService;
  toolsService: ToolsService;
  funService: FunService;
  placeholderEngine: PlaceholderEngine;
  services: ServiceContainer;
  queueStats: () => QueueStats[];
  websocketStats: () => WebSocketStats;
  client: Client;
  env: EnvConfig;
  registry: ModuleRegistry;
}

// ─── Service Interfaces (lazy, will be replaced by actual classes) ──
export interface ConfigService {
  getGuildConfig(guildId: string, module: string, feature: string): Promise<Record<string, any> | null>;
  getModuleConfig(guildId: string, moduleName: string): Promise<Record<string, any>>;
  upsertModuleConfig(payload: Record<string, any>): Promise<void>;
}

export interface ConfigCache {
  getCommandConfig(guildId: string, commandName: string): { enabled?: boolean; overrides?: Record<string, any> | null } | null;
  getModuleConfig(guildId: string, moduleName: string): Record<string, any> | null;
  warmGuild(guildId: string): Promise<void>;
  startAutoRefresh(getGuildIds: () => string[]): void;
  stopAutoRefresh(): void;
  refreshGuild(guildId: string): Promise<void>;
  getWelcomeConfig?(guildId: string): Record<string, any> | null;
  getStats?(): Record<string, any>;
  invalidate?(guildId: string, module: string, feature?: string | null): void;
}

export interface PermissionService {
  isAllowed(interaction: Interaction, overrides: Record<string, any>): boolean;
}

export interface DynamicRateLimiter {
  check(interaction: Interaction, commandName: string): { allowed: boolean; retryAfter: number };
  warmGuild(guildId: string): Promise<void>;
}

export interface AuthService {
  validateSession(token: string): Promise<Record<string, any> | null>;
  createSession(userId: string): Promise<string>;
  destroySession(token: string): Promise<void>;
}

export interface GuildService {
  getGuilds(userId: string): Promise<any[]>;
  getGuild(guildId: string): Promise<any>;
}

export interface AccessControlService {
  hasAccess(userId: string, guildId: string): Promise<boolean>;
}

export interface AnalyticsService {
  getMemberAnalytics(guildId: string): Promise<any[]>;
  getStaffActivity(guildId: string): Promise<any[]>;
}

export interface ModuleService {
  getModules(guildId: string): Promise<any[]>;
  updateModule(guildId: string, moduleName: string, config: Record<string, any>): Promise<void>;
}

export interface DashboardOverviewService {
  getOverview(guildId: string): Promise<Record<string, any>>;
}

export interface ModerationService {
  getCases(guildId: string): Promise<any[]>;
  createCase(guildId: string, data: Record<string, any>): Promise<any>;
}

export interface SettingsService {
  getSettings(guildId: string): Promise<Record<string, any>>;
  updateSettings(guildId: string, settings: Record<string, any>): Promise<void>;
}

export interface AnnouncementService {
  sendAnnouncement(guildId: string, channelId: string, message: string): Promise<void>;
}

export interface DmBroadcastService {
  sendDm(userId: string, message: string): Promise<void>;
  runQueuedBroadcast(payload: Record<string, any>): Promise<void>;
}

export interface RoleColorRotationService {
  startRotation(guildId: string): Promise<void>;
  stopRotation(guildId: string): Promise<void>;
}

export interface MemeService {
  postMeme(guildId: string): Promise<void>;
}

export interface BotLooksService {
  updateBotProfile(guildId: string): Promise<void>;
}

export interface StaffListService {
  updateStaffList(guildId: string): Promise<void>;
  handleRoleChange(oldMember: any, newMember: any): Promise<void>;
  syncGuild(guildId: string, options?: any): Promise<any>;
  publishGuildList(guildId: string, options?: any): Promise<any>;
}

export interface ProfileStyleService {
  updateGuildConfig(guildId: string, config: Record<string, any>): Promise<void>;
  clearGuildConfig(guildId: string): Promise<void>;
  parseColorInput(input: string): string | null;
}

export interface StaffRatingService {
  getRating(userId: string): Promise<number>;
  submitRating(guildId: string, targetId: string, raterId: string, rating: number): Promise<void>;
}

export interface CommunityService {
  handleEvent(event: string, data: Record<string, any>): Promise<void>;
}

export interface ToolsService {
  executeTool(tool: string, params: Record<string, any>): Promise<any>;
  getModuleRow(guildId: string): Promise<Record<string, any> | null>;
  getChannelActivityConfig(guildId: string): Promise<any>;
  upsertAutoresponder(payload: Record<string, any>): Promise<void>;
  listAutoresponders(guildId: string): Promise<any[]>;
  upsertSticky(payload: Record<string, any>): Promise<void>;
  listStickies(guildId: string): Promise<any[]>;
  upsertEmbedTemplate(payload: Record<string, any>): Promise<void>;
  listEmbedTemplates(guildId: string): Promise<any[]>;
  scheduleBulkDelete(messages: any[], delaySeconds: number): void;
  broadcastToGuildChannels(guild: any, content: string, deleteAfterSeconds?: number): Promise<any>;
}

export interface FunService {
  executeCommand(command: string, interaction: Interaction): Promise<any>;
}

export interface PlaceholderEngine {
  render(template: string, context: Record<string, any>): string;
}

export interface ServiceContainer {
  configService: ConfigService;
  authService: AuthService;
  guildService: GuildService;
  accessControlService: AccessControlService;
  analyticsService: AnalyticsService;
  moduleService: ModuleService;
  dashboardOverviewService: DashboardOverviewService;
  moderationService: ModerationService;
  settingsService: SettingsService;
  announcementService: AnnouncementService;
  dmBroadcastService: DmBroadcastService;
  roleColorRotationService: RoleColorRotationService;
  memeService: MemeService;
  botLooksService: BotLooksService;
  staffListService: StaffListService;
  profileStyleService: ProfileStyleService;
  staffRatingService: StaffRatingService;
  communityService: CommunityService;
  toolsService: ToolsService;
  funService: FunService;
}

// ─── Registry ─────────────────────────────────────────────────
export interface ModuleRegistry {
  modules: Map<string, ModuleDefinition>;
  plugins: Map<string, ModuleDefinition>;
  commands: Map<string, ModuleCommand & { moduleName: string }>;
  events: Map<string, (ModuleEvent & { moduleName: string })[]>;
  registerModule(definition: ModuleDefinition, source?: string): void;
  registerAsyncModule(moduleName: string, initFunction: (deps: Record<string, any>) => Promise<ModuleDefinition>, source?: string): void;
  initializeAsyncModules(dependencies: Record<string, any>): Promise<void>;
  getCommand(name: string): (ModuleCommand & { moduleName: string }) | null;
  getEventHandlers(eventName: string): (ModuleEvent & { moduleName: string })[];
  listDefinitions(): ModuleDefinition[];
}

// ─── Queue ────────────────────────────────────────────────────
export interface QueueStats {
  name: string;
  size: number;
  active: number;
  failed: number;
}

export interface WebSocketStats {
  connections: number;
}

// ─── Module Definitions ───────────────────────────────────────
export interface PermissionOverrides {
  discordPermissions?: string[];
  roles?: string[];
  users?: string[];
  channels?: string[];
}

export interface ApplicationCommandOption {
  name: string;
  type: number;
  description: string;
  required?: boolean;
  choices?: { name: string; value: string | number }[];
  options?: ApplicationCommandOption[];
}

export interface ModuleCommand {
  name: string;
  description: string;
  ephemeral?: boolean;
  defer?: boolean;
  permissionOverrides?: PermissionOverrides;
  options?: ApplicationCommandOption[];
  execute: (interaction: BotInteraction, context: BotContext) => Promise<InteractionResult>;
}

export interface ModuleEvent {
  name: string;
  execute: (...args: any[]) => Promise<InteractionResult | void>;
}

export interface ModuleDefinition {
  name: string;
  display_name?: string;
  description?: string;
  category?: string;
  configSchema: Record<string, any>;
  commands: ModuleCommand[];
  events: ModuleEvent[];
  shutdown?: () => Promise<void>;
}

// ─── Interaction Result Discriminated Union ───────────────────
export type InteractionResult =
  | { type: 'IGNORE' }
  | { type: 'REPLY' | 'ERROR'; message: string; ephemeral?: boolean; components?: any[]; files?: any[]; embeds?: any[]; allowedMentions?: any; flags?: number }
  | { type: 'EDIT_REPLY'; content: string; components?: any[]; files?: any[]; embeds?: any[]; allowedMentions?: any; flags?: number }
  | { type: 'UPDATE'; content?: string; components?: any[]; files?: any[]; embeds?: any[] }
  | { type: 'MODAL'; modal: ModalBuilder }
  | { type: 'FOLLOW_UP'; content: string; components?: any[]; ephemeral?: boolean; embeds?: any[]; after?: (msg: Message) => Promise<void> }
  | { type: 'DEFER_UPDATE' }
  | { type: 'ASYNC_RESULT'; execute: () => Promise<InteractionResult> }
  | { type: 'MULTI'; results: InteractionResult[] };

// ─── Discord Interaction Union ────────────────────────────────
export type BotInteraction =
  | ChatInputCommandInteraction
  | MessageContextMenuCommandInteraction
  | Interaction;

// ─── Redis ────────────────────────────────────────────────────
export interface RedisClient {
  connect(): Promise<boolean>;
  isReady(): boolean;
  isEnabled(): boolean;
  disconnect(): Promise<void>;
  getClient(): Redis | null;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: Record<string, any>): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<boolean>;
  del(...keys: string[]): Promise<number>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  incr(key: string): Promise<number | null>;
  incrBy(key: string, amount?: number): Promise<number | null>;
  mget(...keys: string[]): Promise<(string | null)[]>;
  keys(pattern: string, count?: number): Promise<string[]>;
  expire(key: string, ttl: number): Promise<boolean>;
  setNX(key: string, value: string): Promise<boolean>;
  setWithTTL(key: string, value: string, ttl: number): Promise<boolean>;
  acquireLock(key: string, ttl: number, value?: string | null): Promise<string | null>;
  releaseLock(key: string, value: string): Promise<boolean>;
  pipeline(pipelineFn: (pipeline: any) => void): Promise<any[]>;
  lRange(key: string, start: number, stop: number): Promise<string[]>;
  lPop(key: string): Promise<string | null>;
  lLen(key: string): Promise<number>;
  lPush(key: string, value: string): Promise<number>;
  lTrim(key: string, start: number, stop: number): Promise<string | null>;
  hSet(key: string, values: Record<string, any>): Promise<boolean>;
  hGetAll(key: string): Promise<Record<string, string> | null>;
  hDel(key: string, field: string): Promise<boolean>;
  append(key: string, value: string): Promise<number>;
  eval(script: string, opts: { keys: string[]; arguments: string[] }): Promise<any>;
}

// ─── Logger ───────────────────────────────────────────────────
export interface Logger {
  debug(message: any, meta?: any): void;
  info(message: any, meta?: any): void;
  warn(message: any, meta?: any): void;
  error(message: any, meta?: any): void;
  child(context: Record<string, any>): Logger;
}

// ─── Queue Job Types ──────────────────────────────────────────
export interface DmBroadcastJobData {
  type: 'dm_broadcast';
  payload: {
    message: string;
    guildId: string;
    userId?: string;
    placeholderContext?: Record<string, any>;
  };
}

export type QueueJobData = DmBroadcastJobData;
