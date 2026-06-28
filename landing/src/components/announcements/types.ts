import { type ReactNode } from "react";

type ButtonStyle = 1 | 2 | 3 | 4 | 5 | 6;
type ComponentType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

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
  disabled?: boolean;
  options: APISelectOption[];
}

interface APIUserSelectComponent { type: 5; custom_id: string; placeholder?: string; disabled?: boolean; }
interface APIRoleSelectComponent { type: 6; custom_id: string; placeholder?: string; disabled?: boolean; }
interface APIMentionableSelectComponent { type: 7; custom_id: string; placeholder?: string; disabled?: boolean; }
interface APIChannelSelectComponent { type: 8; custom_id: string; placeholder?: string; disabled?: boolean; }

type APIComponentInActionRow = APIButtonComponent | APIStringSelectComponent
  | APIUserSelectComponent | APIRoleSelectComponent | APIMentionableSelectComponent | APIChannelSelectComponent;

interface APIActionRowComponent { type: 1; components: APIComponentInActionRow[]; }

interface UnfurledMediaItem { url: string; }
interface MediaGalleryItem { media: UnfurledMediaItem; description?: string; spoiler?: boolean; }

interface APIV2TextDisplay { type: 10; id?: number; content: string; }
interface APIV2Separator { type: 14; id?: number; divider?: boolean; spacing?: number; }
interface APIV2MediaGallery { type: 12; id?: number; items: MediaGalleryItem[]; }
interface APIV2Thumbnail { type: 11; id?: number; media: UnfurledMediaItem; description?: string; spoiler?: boolean; }
interface APIV2File { type: 13; id?: number; file: UnfurledMediaItem; spoiler?: boolean; name?: string; size?: number; }

type SectionAccessory = APIButtonComponent | APIStringSelectComponent | APIUserSelectComponent | APIRoleSelectComponent | APIMentionableSelectComponent | APIChannelSelectComponent | APIV2Thumbnail;

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

type APIV2ChildComponent = APIV2TextDisplay | APIV2Separator | APIV2MediaGallery | APIV2Thumbnail | APIV2File | APIV2Section | APIActionRowComponent;

type APITopLevelComponent = APIActionRowComponent | APIContainerComponent;

interface APIEmbedField { name: string; value: string; inline?: boolean; }
interface APIEmbedFooter { text: string; icon_url?: string; proxy_icon_url?: string; }
interface APIEmbedImage { url: string; proxy_url?: string; width?: number; height?: number; }
interface APIEmbedThumbnail { url: string; proxy_url?: string; width?: number; height?: number; }
interface APIEmbedVideo { url?: string; proxy_url?: string; width?: number; height?: number; }
interface APIEmbedAuthor { name: string; url?: string; icon_url?: string; proxy_icon_url?: string; }
interface APIEmbedProvider { name?: string; url?: string; icon_url?: string; }
interface APIEmbed {
  title?: string; type?: string; description?: string; url?: string; timestamp?: string;
  color?: number; footer?: APIEmbedFooter; image?: APIEmbedImage; thumbnail?: APIEmbedThumbnail;
  video?: APIEmbedVideo; author?: APIEmbedAuthor; fields?: APIEmbedField[]; provider?: APIEmbedProvider;
}

interface APIAllowedMentions { parse?: string[]; roles?: string[]; users?: string[]; replied_user?: boolean; }
interface APIAttachment { id: string; filename: string; size: number; url: string; proxy_url: string; width?: number; height?: number; content_type?: string; duration_secs?: number; }

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

interface FlowAction {
  type: "add_role" | "remove_role" | "send_message" | "create_thread" | "custom";
  label?: string;
  role_id?: string;
  message_content?: string;
  thread_name?: string;
  channel_id?: string;
  custom_event?: string;
  custom_data?: string;
  option_value?: string;
}

interface FlowActionPayload extends FlowAction {
  ri: number;
  ci: number;
}

export type {
  ButtonStyle, ComponentType,
  APIEmoji, APIButtonComponent, APISelectOption, APIStringSelectComponent, APIUserSelectComponent, APIRoleSelectComponent, APIMentionableSelectComponent, APIChannelSelectComponent,
  APIComponentInActionRow, APIActionRowComponent,
  UnfurledMediaItem, MediaGalleryItem, APIV2TextDisplay, APIV2Separator, APIV2MediaGallery, APIV2Thumbnail, APIV2File, APIV2Section, APIContainerComponent, APIV2ChildComponent, APITopLevelComponent, SectionAccessory,
  APIEmbedField, APIEmbedFooter, APIEmbedImage, APIEmbedThumbnail, APIEmbedVideo, APIEmbedAuthor, APIEmbed, APIAllowedMentions, APIAttachment,
  DraftFile, QueryDataMessageData, QueryDataMessage, QueryDataTarget, QueryData,
  ModuleRow, GuildChannel, GuildRole, GuildEmoji, SaveState, StatusMsg,
  Token,
  FlowAction, FlowActionPayload,
};
export { TargetType };
