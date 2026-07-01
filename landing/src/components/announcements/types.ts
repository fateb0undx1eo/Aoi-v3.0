import { type ReactNode } from "react";
import { z } from "zod";

type ButtonStyle = 1 | 2 | 3 | 4 | 5 | 6;
type ComponentType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 17 | 18 | 19 | 21 | 22 | 23;

interface APIEmoji {
  id?: string;
  name?: string;
  animated?: boolean;
}

interface APIButtonComponent {
  type: 2;
  style: ButtonStyle;
  label?: string;
  emoji?: APIEmoji;
  custom_id?: string;
  url?: string;
  disabled?: boolean;
  sku_id?: string;
}

interface APISelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: APIEmoji;
  default?: boolean;
}

interface APIStringSelectComponent {
  type: 3;
  custom_id: string;
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  required?: boolean;
  disabled?: boolean;
  options: APISelectOption[];
}

interface SelectDefaultValue { id: string; type: "user" | "role" | "channel"; }

interface APIUserSelectComponent { type: 5; custom_id: string; placeholder?: string; min_values?: number; max_values?: number; default_values?: SelectDefaultValue[]; required?: boolean; disabled?: boolean; }
interface APIRoleSelectComponent { type: 6; custom_id: string; placeholder?: string; min_values?: number; max_values?: number; default_values?: SelectDefaultValue[]; required?: boolean; disabled?: boolean; }
interface APIMentionableSelectComponent { type: 7; custom_id: string; placeholder?: string; min_values?: number; max_values?: number; default_values?: SelectDefaultValue[]; required?: boolean; disabled?: boolean; }
interface APIChannelSelectComponent { type: 8; custom_id: string; placeholder?: string; min_values?: number; max_values?: number; default_values?: SelectDefaultValue[]; channel_types?: number[]; required?: boolean; disabled?: boolean; }

type APIComponentInActionRow = APIButtonComponent | APIStringSelectComponent
  | APIUserSelectComponent | APIRoleSelectComponent | APIMentionableSelectComponent | APIChannelSelectComponent;

interface APIActionRowComponent { type: 1; components: APIComponentInActionRow[]; }

interface UnfurledMediaItem { url: string; proxy_url?: string; width?: number; height?: number; placeholder?: string; placeholder_version?: number; content_type?: string; flags?: number; attachment_id?: string; }
interface MediaGalleryItem { media: UnfurledMediaItem; description?: string; spoiler?: boolean; }

interface APIV2TextDisplay { type: 10; id?: number; content: string; }
interface APIV2Separator { type: 14; id?: number; divider?: boolean; spacing?: number; }
interface APIV2MediaGallery { type: 12; id?: number; items: MediaGalleryItem[]; }
interface APIV2Thumbnail { type: 11; id?: number; media: UnfurledMediaItem; description?: string; spoiler?: boolean; }
interface APIV2File { type: 13; id?: number; file: UnfurledMediaItem; spoiler?: boolean; name?: string; size?: number; }

// ── Modal component interfaces ───────────────────────────────────
interface APITextInputComponent {
  type: 4;
  id?: number;
  custom_id: string;
  style: 1 | 2;
  label?: string;
  min_length?: number;
  max_length?: number;
  required?: boolean;
  value?: string;
  placeholder?: string;
}

interface APILabelComponent {
  type: 18;
  id?: number;
  label: string;
  description?: string;
  component: APITextInputComponent | APIStringSelectComponent | APIUserSelectComponent | APIRoleSelectComponent | APIMentionableSelectComponent | APIChannelSelectComponent | APIFileUploadComponent | APIRadioGroupComponent | APICheckboxGroupComponent | APICheckboxComponent;
}

interface APIFileUploadComponent {
  type: 19;
  id?: number;
  custom_id: string;
  min_values?: number;
  max_values?: number;
  required?: boolean;
}

interface APIRadioGroupComponent {
  type: 21;
  id?: number;
  custom_id: string;
  options: APIRadioCheckboxOption[];
  required?: boolean;
}

interface APICheckboxGroupComponent {
  type: 22;
  id?: number;
  custom_id: string;
  options: APIRadioCheckboxOption[];
  min_values?: number;
  max_values?: number;
  required?: boolean;
}

interface APICheckboxComponent {
  type: 23;
  id?: number;
  custom_id: string;
  default?: boolean;
}

interface APIRadioCheckboxOption {
  value: string;
  label: string;
  description?: string;
  default?: boolean;
}

type SectionAccessory = APIButtonComponent | APIV2Thumbnail;

interface APIV2Section {
  type: 9;
  id?: number;
  components: APIV2TextDisplay[];
  accessory?: SectionAccessory;
}

interface APIContainerComponent {
  type: 17;
  id?: number;
  components: APIV2ChildComponent[];
  accent_color?: number;
  spoiler?: boolean;
}

type APIV2ChildComponent = APIV2TextDisplay | APIV2Separator | APIV2MediaGallery | APIV2File | APIV2Section | APIActionRowComponent;

type APITopLevelComponent = APIActionRowComponent | APIContainerComponent | APIV2TextDisplay | APIV2Separator | APIV2MediaGallery | APIV2File | APIV2Section;

interface APIEmbedField { name: string; value: string; inline?: boolean; }
interface APIEmbedFooter { text: string; icon_url?: string; proxy_icon_url?: string; }
interface APIEmbedImage { url: string; proxy_url?: string; width?: number; height?: number; content_type?: string; placeholder?: string; placeholder_version?: number; description?: string; flags?: number; }
interface APIEmbedThumbnail { url: string; proxy_url?: string; width?: number; height?: number; content_type?: string; placeholder?: string; placeholder_version?: number; description?: string; flags?: number; }
interface APIEmbedVideo { url?: string; proxy_url?: string; width?: number; height?: number; content_type?: string; placeholder?: string; placeholder_version?: number; description?: string; flags?: number; }
interface APIEmbedAuthor { name: string; url?: string; icon_url?: string; proxy_icon_url?: string; }
interface APIEmbedProvider { name?: string; url?: string; }
interface APIEmbed {
  title?: string; type?: string; description?: string; url?: string; timestamp?: string;
  color?: number; footer?: APIEmbedFooter; image?: APIEmbedImage; thumbnail?: APIEmbedThumbnail;
  video?: APIEmbedVideo; author?: APIEmbedAuthor; fields?: APIEmbedField[]; provider?: APIEmbedProvider; flags?: number;
}

interface APIAllowedMentions { parse?: string[]; roles?: string[]; users?: string[]; replied_user?: boolean; }
interface APIAttachment { id: string; filename: string; description?: string; size: number; url: string; proxy_url: string; width?: number; height?: number; content_type?: string; duration_secs?: number; }

interface DraftFile {
  id: string;
  file?: File;
  url?: string;
  name: string;
  size: number;
  spoiler: boolean;
  description?: string;
  width?: number;
  height?: number;
  content_type?: string;
}

interface QueryDataMessageData {
  content?: string | null;
  embeds?: APIEmbed[] | null;
  components?: APITopLevelComponent[] | null;
  attachments?: APIAttachment[];
  flags?: number;
  username?: string;
  avatar_url?: string;
  thread_name?: string;
  allowed_mentions?: APIAllowedMentions;
}

interface QueryDataMessage {
  _id?: string;
  name?: string;
  data: QueryDataMessageData;
  reference?: string;
  thread_id?: string;
}

enum TargetType { Webhook = 1, Bot = 2 }
interface QueryDataTarget {
  type: TargetType;
  url?: string;
  application_id?: string;
  bot_id?: string;
  channel_id?: string;
}

interface QueryData {
  version: string;
  backup_id?: string;
  messages: QueryDataMessage[];
  targets?: QueryDataTarget[];
}

type ModuleRow = { name: string; display_name?: string; description?: string; category?: string; enabled?: boolean; config?: Record<string, any> };
type GuildChannel = { id: string; name: string; type: number };
type GuildRole = { id: string; name: string; color: number; managed: boolean; editable: boolean; position: number };
type GuildEmoji = { id: string; name: string; animated: boolean; mention: string; url: string };
type SaveState = "idle" | "success" | "error" | "info" | "sending";
type StatusMsg = { state: SaveState; text: string } | null;

type Token = { type: "text"; text: string } | { type: "br" } | { type: "codeBlock"; lang: string; code: string } | { type: "inlineCode"; code: string } | { type: "bold"; children: Token[] } | { type: "italic"; children: Token[] } | { type: "underline"; children: Token[] } | { type: "strikethrough"; children: Token[] } | { type: "maskedLink"; text: string; url: string } | { type: "emoji"; name: string; id: string; animated: boolean } | { type: "mention"; id: string } | { type: "nickMention"; id: string } | { type: "roleMention"; id: string } | { type: "channelMention"; id: string } | { type: "everyone" } | { type: "here" } | { type: "timestamp"; ts: string; style: string } | { type: "blockQuote"; children: Token[] } | { type: "listItem"; ordered: boolean; start?: number; children: Token[] } | { type: "customEmoji"; name: string; emoji: string };

// ── Flow Action types (from discohook's flows.ts) ────────────────────────────
interface FlowAction {
  type: "add_role" | "remove_role" | "send_message" | "send_dm" | "reply" | "edit_response" | "delete_response" | "create_thread" | "create_ticket" | "close_ticket" | "create_role" | "delete_role" | "webhook" | "modal" | "log" | "custom";
  label?: string;
  role_id?: string;
  role_name?: string;
  role_color?: string;
  role_permissions?: string;
  message_content?: string;
  thread_name?: string;
  channel_id?: string;
  webhook_url?: string;
  webhook_body?: string;
  modal_custom_id?: string;
  modal_title?: string;
  modal_components?: string;
  log_channel_id?: string;
  log_template?: string;
  reply_message_id?: string;
  reply_content?: string;
  edit_content?: string;
  custom_event?: string;
  custom_data?: string;
  option_value?: string;
  /** Flow-type action ID for conditional branching */
  _id?: string;
}

interface FlowActionPayload extends FlowAction {
  ri: number;
  ci: number;
}

// ── Discohook-style DraftFlow for interaction flows ─────────────────────────
interface DraftFlowAction {
  type: number;
  [key: string]: any;
}

interface DraftFlow {
  name?: string | null;
  actions: DraftFlowAction[];
}

// ── Discohook-style Zod schemas for validation ──────────────────────────────
const ZodAPIEmbedField = z.object({
  name: z.string().max(256),
  value: z.string().max(1024),
  inline: z.boolean().optional(),
}) satisfies z.ZodType<APIEmbedField>;

const ZodAPIEmbedFooter = z.object({
  text: z.string().max(2048),
  icon_url: z.string().max(1000).optional(),
}) satisfies z.ZodType<APIEmbedFooter>;

const ZodAPIEmbedAuthor = z.object({
  name: z.string().max(256),
  url: z.string().max(1000).optional(),
  icon_url: z.string().max(1000).optional(),
}) satisfies z.ZodType<APIEmbedAuthor>;

const ZodAPIEmbedMedia = z.object({
  url: z.string(),
  proxy_url: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  content_type: z.string().optional(),
  placeholder: z.string().optional(),
  placeholder_version: z.number().int().optional(),
  description: z.string().optional(),
  flags: z.number().int().optional(),
});

export const ZodAPIEmbed = z.object({
  title: z.string().max(256).optional(),
  type: z.string().optional(),
  description: z.string().max(4096).optional(),
  url: z.string().max(1000).optional(),
  timestamp: z.string().optional(),
  color: z.number().int().optional(),
  footer: ZodAPIEmbedFooter.optional(),
  image: ZodAPIEmbedMedia.optional(),
  thumbnail: ZodAPIEmbedMedia.optional(),
  video: ZodAPIEmbedMedia.optional(),
  provider: z.object({ name: z.string().optional(), url: z.string().optional() }).optional(),
  author: ZodAPIEmbedAuthor.optional(),
  fields: ZodAPIEmbedField.array().max(25).optional(),
  flags: z.number().int().optional(),
}) satisfies z.ZodType<APIEmbed>;

export const ZodAPIAllowedMentions = z.object({
  parse: z.string().array().optional(),
  roles: z.string().array().optional(),
  users: z.string().array().optional(),
  replied_user: z.boolean().optional(),
}) satisfies z.ZodType<APIAllowedMentions>;

export const ZodQueryDataMessageData = z.object({
  content: z.string().max(2000).nullable().optional(),
  embeds: ZodAPIEmbed.array().max(10).nullable().optional(),
  components: z.any().array().nullable().optional(),
  attachments: z.any().array().optional(),
  flags: z.number().int().optional(),
  username: z.string().max(80).optional(),
  avatar_url: z.string().max(1000).optional(),
  thread_name: z.string().max(100).optional(),
  allowed_mentions: ZodAPIAllowedMentions.optional(),
}) satisfies z.ZodType<QueryDataMessageData>;

// ── Embed flags ────────────────────────────────────────────────────────────
export const EMBED_FLAGS = {
  IS_CONTENT_INVENTORY_ENTRY: 1 << 5,
} as const;

// ── Embed media flags ──────────────────────────────────────────────────────
export const EMBED_MEDIA_FLAGS = {
  IS_ANIMATED: 1 << 5,
} as const;

// ── Limit constants from discohook ──────────────────────────────────────────
export enum LinkEmbedStrategy {
  Link = "link",
  Mastodon = "mastodon",
}

type SetImageModalData = React.Dispatch<
  React.SetStateAction<ImageModalProps | undefined>
>;

interface ImageModalProps {
  images?: { url: string; alt?: string }[];
  startIndex?: number;
}

export const DISCORD_LIMITS = {
  CONTENT: 2000,
  EMBEDS_PER_MESSAGE: 10,
  EMBED_TITLE: 256,
  EMBED_DESCRIPTION: 4096,
  EMBED_FIELDS: 25,
  FIELD_NAME: 256,
  FIELD_VALUE: 1024,
  FOOTER_TEXT: 2048,
  AUTHOR_NAME: 256,
  TOTAL_EMBED_CHARS: 6000,
  V1_ROWS: 5,
  V1_COMPONENTS_PER_ROW: 5,
  V2_TOTAL_COMPONENTS: 40,
} as const;

export type {
  ButtonStyle, ComponentType,
  APIEmoji, APIButtonComponent, APISelectOption, APIStringSelectComponent, APIUserSelectComponent, APIRoleSelectComponent, APIMentionableSelectComponent, APIChannelSelectComponent,
  APIComponentInActionRow, APIActionRowComponent, SelectDefaultValue,
  UnfurledMediaItem, MediaGalleryItem, APIV2TextDisplay, APIV2Separator, APIV2MediaGallery, APIV2Thumbnail, APIV2File, APIV2Section, APIContainerComponent, APIV2ChildComponent, APITopLevelComponent, SectionAccessory,
  APITextInputComponent, APILabelComponent, APIFileUploadComponent, APIRadioGroupComponent, APICheckboxGroupComponent, APICheckboxComponent, APIRadioCheckboxOption,
  APIEmbedField, APIEmbedFooter, APIEmbedImage, APIEmbedThumbnail, APIEmbedVideo, APIEmbedAuthor, APIEmbed, APIAllowedMentions, APIAttachment,
  DraftFile, QueryDataMessageData, QueryDataMessage, QueryDataTarget, QueryData,
  ModuleRow, GuildChannel, GuildRole, GuildEmoji, SaveState, StatusMsg,
  Token,
  FlowAction, FlowActionPayload,
  DraftFlow, DraftFlowAction,
  SetImageModalData, ImageModalProps,
};
export { TargetType };
