import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { BoneyardCard } from "@/components/ui/boneyard-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Megaphone, Plus, Copy, Trash2, ChevronDown, ChevronUp,
  Send, Save, X, Palette, Eye, ExternalLink, Check, Bot, Globe, Webhook, 
  Search, Hash, Folder, Flag, Activity, CloudSun, Gift, Clock, ArrowUpDown,
  Smile, MessageSquare, FileText, Image, Music, Video, Minus,
  Zap, Layers, ToggleLeft,
} from "lucide-react";

// ── Discord API types ──────────────────────────────────────────────

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

// ── V2 component types ──────────────────────────────────────────────

interface APIV2TextDisplay { type: 10; content: string; }
interface APIV2Separator { type: 14; divider: boolean; spacing: number; }
interface APIV2MediaItem { media: { url: string }; }
interface APIV2MediaGallery { type: 12; items: APIV2MediaItem[]; }
interface APIV2Thumbnail { type: 11; items: APIV2MediaItem[]; }
interface APIV2File { type: 13; items: APIV2MediaItem[]; }

interface APIV2Section {
  type: 9;
  components: APIV2ChildComponent[];
  accessory?: APIButtonComponent | APIV2Thumbnail;
}

interface APIContainerComponent {
  type: 17;
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
interface APIEmbed {
  title?: string; type?: string; description?: string; url?: string; timestamp?: string;
  color?: number; footer?: APIEmbedFooter; image?: APIEmbedImage; thumbnail?: APIEmbedThumbnail;
  video?: APIEmbedVideo; author?: APIEmbedAuthor; fields?: APIEmbedField[];
}

interface APIAllowedMentions { parse?: string[]; roles?: string[]; users?: string[]; replied_user?: boolean; }
interface APIAttachment { id: string; filename: string; size: number; url: string; proxy_url: string; width?: number; height?: number; content_type?: string; }

// ── QueryData-like message format ───────────────────────────────────

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

// ── Guild data types ────────────────────────────────────────────────

type ModuleRow = { name: string; display_name?: string; description?: string; category?: string; enabled?: boolean; config?: Record<string, any> };
type GuildChannel = { id: string; name: string; type: number };
type GuildRole = { id: string; name: string; color: number; managed: boolean; editable: boolean; position: number };
type GuildEmoji = { id: string; name: string; animated: boolean; mention: string; url: string };
type SaveState = "idle" | "success" | "error" | "info" | "sending";
type StatusMsg = { state: SaveState; text: string } | null;

// ── Constants ───────────────────────────────────────────────────────

const ACCENT = "#06b6d4";
const EMBED_BG = "#2b2d31";
const TEXT_COLOR = "#dbdee1";

const BUTTON_STYLES: Record<number, { label: string; color: string; bg: string; border: string; discordClass: string }> = {
  1: { label: "Primary", color: "#fff", bg: "#5865f2", border: "#5865f2", discordClass: "bg-[#5865f2] text-white border-[#5865f2]" },
  2: { label: "Secondary", color: "#dbdee1", bg: "#4e5058", border: "#4e5058", discordClass: "bg-[#4e5058] text-[#dbdee1] border-[#4e5058]" },
  3: { label: "Success", color: "#fff", bg: "#248046", border: "#248046", discordClass: "bg-[#248046] text-white border-[#248046]" },
  4: { label: "Danger", color: "#fff", bg: "#da373c", border: "#da373c", discordClass: "bg-[#da373c] text-white border-[#da373c]" },
  5: { label: "Link", color: "#00a8fc", bg: "transparent", border: "#00a8fc", discordClass: "bg-transparent text-[#00a8fc] border-[#00a8fc]" },
  6: { label: "Premium", color: "#fff", bg: "#9b59b6", border: "#9b59b6", discordClass: "bg-[#9b59b6] text-white border-[#9b59b6]" },
};

const EMBED_PRESETS = [
  { label: "Green", value: 0x57f287 }, { label: "Red", value: 0xed4245 },
  { label: "Blue", value: 0x5865f2 }, { label: "Yellow", value: 0xfee75c },
  { label: "Orange", value: 0xf57c00 }, { label: "Purple", value: 0x9b59b6 },
  { label: "Pink", value: 0xeb459e }, { label: "Teal", value: 0x1abc9c },
  { label: "White", value: 0xffffff }, { label: "Black", value: 0x000000 },
];

const UNICODE_EMOJI_CATEGORIES = [
  { id: "people", icon: "😀", label: "People" },
  { id: "nature", icon: "🌿", label: "Nature" },
  { id: "food", icon: "🍕", label: "Food" },
  { id: "activities", icon: "⚽", label: "Activities" },
  { id: "travel", icon: "✈️", label: "Travel" },
  { id: "objects", icon: "🔧", label: "Objects" },
  { id: "symbols", icon: "💡", label: "Symbols" },
  { id: "flags", icon: "🏁", label: "Flags" },
];

const UNICODE_EMOJIS: Record<string, string[]> = {
  people: ["😀","😃","😄","😁","😅","😂","🤣","😊","😇","🙂","😉","😌","😍","🥰","😘","😗","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥴","😵","🤯","🤠","🥳","🥺","😢","😭","😤","😠","😡","🤬","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾"],
  nature: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🦟","🦗","🕷️","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐈","🐓","🦃","🦚","🦜","🦢","🦩","🕊️","🐇","🦝","🦨","🦡","🦦","🦥","🐁","🐀","🐿️","🦔","🐾","🐉","🐲","🌵","🎄","🌲","🌳","🌴","🌱","🌿","☘️","🍀","🎍","🪴","🎋","🍃","🍂","🍁","🍄","🌾","💐","🌷","🌹","🥀","🌺","🌸","🌼","🌻","🌞","🌝","🌛","🌜","🌚","🌕","🌖","🌗","🌘","🌑","🌒","🌓","🌔","🌙","🌎","🌍","🌏","🪐","💫","⭐","🌟","✨","⚡","☄️","💥","🔥","🌪️","🌈","☀️","🌤️","⛅","🌥️","☁️","🌦️","🌧️","⛈️","🌩️","🌨️","❄️","☃️","⛄","🌬️","💨","💧","💦","🌊"],
  food: ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🧄","🧅","🥔","🍠","🥐","🍞","🥖","🥨","🧀","🥚","🍳","🥞","🧇","🥓","🥩","🍗","🍖","🦴","🌭","🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🥗","🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🧂","🥤","🧃","🧉","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🍾","🥄","🍴","🥄","🔪","🏺"],
  activities: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥅","⛳","🪁","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌","🎿","⛷️","🏂","🪂","🏋️","🤼","🤸","🤺","⛹️","🤾","🏌️","🏇","🧘","🏄","🏊","🤽","🚣","🧗","🚵","🚴","🎪","🎭","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🪘","🎷","🎺","🪗","🎸","🪕","🎻","🎲","♟️","🎯","🎳","🎮","🕹️","🎰","🧩"],
  travel: ["🚗","🚙","🚕","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍️","🛵","🛺","🚲","🛴","🛹","🚏","🛣️","🛤️","⛽","🛳️","⛵","🛶","🚤","🛥️","🚢","✈️","🛩️","🛫","🛬","🪂","💺","🚁","🚟","🚠","🚡","🛰️","🚀","🛸","🏠","🏡","🏘️","🏚️","🏗️","🏢","🏭","🏣","🏤","🏥","🏦","🏨","🏩","🏪","🏫","🏬","🏯","🏰","💒","🗼","🗽","⛪","🕌","🕍","⛩️","🕋","⛲","⛺","🌁","🌃","🏙️","🌄","🌅","🌆","🌇","🌉","🗾","🏔️","⛰️","🌋","🗻","🏕️","🏖️","🏜️","🏝️","🏞️"],
  objects: ["⌚","📱","💻","⌨️","🖥️","🖨️","🖱️","🖲️","🕹️","🗜️","💽","💾","💿","📀","📼","📷","📸","📹","🎥","📽️","🎞️","📞","☎️","📟","📠","📺","📻","🎙️","🎚️","🎛️","🧭","⏱️","⏲️","⏰","🕰️","⌛","⏳","📡","🔋","🪫","🔌","💡","🔦","🕯️","🪔","🧯","🗑️","🛢️","💸","💵","💴","💶","💷","🪙","💰","💳","💎","⚖️","🪜","🧰","🪛","🔧","🔨","⚒️","🛠️","⛏️","🪚","🔩","⚙️","🧱","⛓️","🧲","🔫","💣","🧨","🪓","🔪","🗡️","⚔️","🛡️","🚬","⚰️","🪦","⚱️","🏺","🔮","📿","🧿","🪬","💈","⚗️","🔭","🔬","🕳️","🩻","🩹","🩺","💊","💉","🩸","🧬","🦠","🧫","🧪","🌡️","🧹","🪠","🧺","🧻","🚽","🚰","🚿","🛁","🛀","🧼","🪥","🪒","🧽","🪣","🧴","🛎️","🔑","🗝️","🚪","🪑","🛋️","🛏️","🛌","🧸","🪆","🖼️","🪞","🪟","🛍️","🛒","🎁","🎈","🎏","🎀","🪄","🪅","🎊","🎉","🎎","🏮","🎐","🧧","✉️","📩","📨","📧","💌","📥","📤","📦","🏷️","📪","📫","📬","📭","📮","📯","📜","📃","📄","📑","🧾","📊","📈","📉","🗒️","🗓️","📆","📅","📇","🗃️","🗳️","🗄️","📋","📁","📂","🗂️","🗞️","📰","📓","📔","📒","📕","📗","📘","📙","📚","📖","🔖","🧷","🔗","📎","🖇️","📐","📏","🧮","📌","📍","✂️","🖊️","🖋️","✒️","🖌️","🖍️","📝","✏️","🔍","🔎","🔏","🔐","🔒","🔓"],
  symbols: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚧️","✴️","🉐","🈹","🆚","🈲","🉑","🈸","🈴","🈳","㊗️","㊙️","🈺","🈵","🔴","🟠","🟡","🟢","🔵","🟣","🟤","⚫","⚪","🟥","🟧","🟨","🟩","🟦","🟪","🟫","⬛","⬜","◼️","◻️","◾","◽","▪️","▫️","🔶","🔷","🔸","🔹","🔺","🔻","💠","🔘","🔲","🔳","🈁","🈂️","🈷️","🈶","🈚","🈸","🈺","🉐","🈹","🆚","🈲","🉑","🈴","🈳","㊗️","㊙️","🈺","🈵","🔠","🔡","🔤","🔢","🔣","🔟","🆖","🆗","🆙","🆒","🆕","🆓","🆑","🆎","🆔","🚹","🚺","🚻","🚼","🚾","🛂","🛃","🛄","🛅","⚠️","🚸","⛔","🚫","🚳","🚭","🚯","🚱","📵","🔞","☢️","☣️","💢","💬","💭","🗯️","♨️","💤","🕳️","♿️","🅿️","🛗","🈳","🈹","🈲","🈴","🈵","🈶","🈸","🈺","🈁","🆚","🉑","🆖","🆗","🆙","🆒","🆕","🆓","🆖","🆗"],
  flags: ["🏳️","🏴","🏁","🚩","🎌","🏴‍☠️","🇺🇳","🇦🇫","🇦🇱","🇩🇿","🇦🇸","🇦🇩","🇦🇴","🇦🇮","🇦🇶","🇦🇬","🇦🇷","🇦🇲","🇦🇼","🇦🇺","🇦🇹","🇦🇿","🇧🇸","🇧🇭","🇧🇩","🇧🇧","🇧🇾","🇧🇪","🇧🇿","🇧🇯","🇧🇲","🇧🇹","🇧🇴","🇧🇦","🇧🇼","🇧🇷","🇮🇴","🇻🇬","🇧🇳","🇧🇬","🇧🇫","🇧🇮","🇰🇭","🇨🇲","🇨🇦","🇮🇨","🇨🇻","🇧🇶","🇰🇾","🇨🇫","🇹🇩","🇨🇱","🇨🇳","🇨🇽","🇨🇨","🇨🇴","🇰🇲","🇨🇬","🇨🇩","🇨🇰","🇨🇷","🇭🇷","🇨🇺","🇨🇼","🇨🇾","🇨🇿","🇩🇰","🇩🇯","🇩🇲","🇩🇴","🇪🇨","🇪🇬","🇸🇻","🇬🇶","🇪🇷","🇪🇪","🇸🇿","🇪🇹","🇫🇰","🇫🇴","🇫🇯","🇫🇮","🇫🇷","🇬🇫","🇵🇫","🇹🇫","🇬🇦","🇬🇲","🇬🇪","🇩🇪","🇬🇭","🇬🇮","🇬🇷","🇬🇱","🇬🇩","🇬🇵","🇬🇺","🇬🇹","🇬🇬","🇬🇳","🇬🇼","🇬🇾","🇭🇹","🇭🇳","🇭🇰","🇭🇺","🇮🇸","🇮🇳","🇮🇩","🇮🇷","🇮🇶","🇮🇪","🇮🇲","🇮🇱","🇮🇹","🇨🇮","🇯🇲","🇯🇵","🇯🇪","🇯🇴","🇰🇿","🇰🇪","🇰🇮","🇽🇰","🇰🇼","🇰🇬","🇱🇦","🇱🇻","🇱🇧","🇱🇸","🇱🇷","🇱🇾","🇱🇮","🇱🇹","🇱🇺","🇲🇴","🇲🇬","🇲🇼","🇲🇾","🇲🇻","🇲🇱","🇲🇹","🇲🇭","🇲🇶","🇲🇷","🇲🇺","🇾🇹","🇲🇽","🇫🇲","🇲🇩","🇲🇨","🇲🇳","🇲🇪","🇲🇸","🇲🇦","🇲🇿","🇲🇲","🇳🇦","🇳🇷","🇳🇵","🇳🇱","🇳🇨","🇳🇿","🇳🇮","🇳🇪","🇳🇬","🇳🇺","🇳🇫","🇰🇵","🇲🇰","🇲🇵","🇳🇴","🇴🇲","🇵🇰","🇵🇼","🇵🇸","🇵🇦","🇵🇬","🇵🇾","🇵🇪","🇵🇭","🇵🇳","🇵🇱","🇵🇹","🇵🇷","🇶🇦","🇷🇪","🇷🇴","🇷🇺","🇷🇼","🇼🇸","🇸🇲","🇸🇹","🇸🇦","🇸🇳","🇷🇸","🇸🇨","🇸🇱","🇸🇬","🇸🇽","🇸🇰","🇸🇮","🇸🇧","🇸🇴","🇿🇦","🇬🇸","🇰🇷","🇸🇸","🇪🇸","🇱🇰","🇧🇱","🇸🇭","🇰🇳","🇱🇨","🇵🇲","🇻🇨","🇸🇩","🇸🇷","🇸🇪","🇨🇭","🇸🇾","🇹🇼","🇹🇯","🇹🇿","🇹🇭","🇹🇱","🇹🇬","🇹🇰","🇹🇴","🇹🇹","🇹🇳","🇹🇷","🇹🇲","🇹🇨","🇹🇻","🇻🇮","🇺🇬","🇺🇦","🇦🇪","🇬🇧","🇺🇸","🇺🇾","🇺🇿","🇻🇺","🇻🇦","🇻🇪","🇻🇳","🇼🇫","🇪🇭","🇾🇪","🇿🇲","🇿🇼"],
};

// ── Helper functions ────────────────────────────────────────────────

const MessageFlagsEnum = { IsComponentsV2: 1 << 15, SuppressEmbeds: 1 << 2, SuppressNotifications: 1 << 12 };

function intToHex(num: number | null | undefined): string {
  if (num == null) return "#57f287";
  return `#${num.toString(16).padStart(6, "0")}`;
}
function hexToInt(hex: string): number | null {
  const raw = hex.replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(raw)) return null;
  return Number.parseInt(raw, 16);
}

function randomId(): string { return Math.random().toString(36).slice(2, 10); }

function createMessage(flags?: number): QueryDataMessage {
  return { _id: randomId(), data: { flags }, reference: undefined, thread_id: undefined };
}

function createDefaultComponent(): APIButtonComponent {
  return { type: 2, style: 1, label: "Button", custom_id: `btn_${randomId()}`, disabled: false };
}

function cloneQueryData(data: QueryData): QueryData {
  return JSON.parse(JSON.stringify(data));
}

function isComponentsV2(flags?: number): boolean {
  return !!(flags && (flags & (1 << 15)));
}

function hasFlag(flags: number | undefined | null, bit: number): boolean {
  return !!(flags && (flags & bit));
}

// ── Discord API Limits ──────────────────────────────────────────────

const DISCORD_LIMITS = {
  CONTENT: 2000,
  EMBEDS_PER_MESSAGE: 10,
  EMBED_TITLE: 256,
  EMBED_DESCRIPTION: 4000,
  EMBED_FIELDS: 25,
  FIELD_NAME: 256,
  FIELD_VALUE: 1024,
  FOOTER_TEXT: 2048,
  AUTHOR_NAME: 256,
  TOTAL_EMBED_CHARS: 6000,
  V1_ROWS: 5,
  V1_COMPONENTS_PER_ROW: 5,
  V2_TOTAL_COMPONENTS: 40,
  V2_COMPONENT_CHARS: 4000,
} as const;

function getMessageLimitWarnings(msg: QueryDataMessageData): string[] {
  const warnings: string[] = [];
  const c = msg.content || "";
  if (c.length > DISCORD_LIMITS.CONTENT) warnings.push(`Content exceeds ${DISCORD_LIMITS.CONTENT} characters (${c.length}).`);

  const embeds = msg.embeds || [];
  if (embeds.length > DISCORD_LIMITS.EMBEDS_PER_MESSAGE) warnings.push(`Too many embeds (${embeds.length}/${DISCORD_LIMITS.EMBEDS_PER_MESSAGE}).`);

  let totalEmbedChars = 0;
  for (const e of embeds) {
    if ((e.title?.length || 0) > DISCORD_LIMITS.EMBED_TITLE) warnings.push(`Embed title exceeds ${DISCORD_LIMITS.EMBED_TITLE} characters.`);
    if ((e.description?.length || 0) > DISCORD_LIMITS.EMBED_DESCRIPTION) warnings.push(`Embed description exceeds ${DISCORD_LIMITS.EMBED_DESCRIPTION} characters.`);
    if ((e.footer?.text?.length || 0) > DISCORD_LIMITS.FOOTER_TEXT) warnings.push(`Embed footer exceeds ${DISCORD_LIMITS.FOOTER_TEXT} characters.`);
    if ((e.author?.name?.length || 0) > DISCORD_LIMITS.AUTHOR_NAME) warnings.push(`Embed author name exceeds ${DISCORD_LIMITS.AUTHOR_NAME} characters.`);
    const fields = e.fields || [];
    if (fields.length > DISCORD_LIMITS.EMBED_FIELDS) warnings.push(`Embed has ${fields.length} fields (max ${DISCORD_LIMITS.EMBED_FIELDS}).`);
    for (const f of fields) {
      if ((f.name?.length || 0) > DISCORD_LIMITS.FIELD_NAME) warnings.push(`Field name exceeds ${DISCORD_LIMITS.FIELD_NAME} characters.`);
      if ((f.value?.length || 0) > DISCORD_LIMITS.FIELD_VALUE) warnings.push(`Field value exceeds ${DISCORD_LIMITS.FIELD_VALUE} characters.`);
    }
    totalEmbedChars += (e.title?.length || 0) + (e.description?.length || 0) + (e.author?.name?.length || 0) + (e.footer?.text?.length || 0);
    totalEmbedChars += fields.reduce((a, f) => a + (f.name?.length || 0) + (f.value?.length || 0), 0);
  }
  if (totalEmbedChars > DISCORD_LIMITS.TOTAL_EMBED_CHARS) warnings.push(`Total embed content exceeds ${DISCORD_LIMITS.TOTAL_EMBED_CHARS} characters (${totalEmbedChars}).`);

  const comps = msg.components || [];
  const isV2 = comps.some((r) => r.type !== 1);
  if (!isV2) {
    if (comps.length > DISCORD_LIMITS.V1_ROWS) warnings.push(`Too many action rows (${comps.length}/${DISCORD_LIMITS.V1_ROWS}).`);
    for (const row of comps) {
      if (row.type === 1 && row.components.length > DISCORD_LIMITS.V1_COMPONENTS_PER_ROW) warnings.push(`Action row has ${row.components.length} components (max ${DISCORD_LIMITS.V1_COMPONENTS_PER_ROW}).`);
    }
  } else {
    const total = comps.reduce((a, r) => a + 1 + ("components" in r ? (r as any).components?.length || 0 : 0), 0);
    if (total > DISCORD_LIMITS.V2_TOTAL_COMPONENTS) warnings.push(`Too many V2 components (${total}/${DISCORD_LIMITS.V2_TOTAL_COMPONENTS}).`);
  }

  return warnings;
}

function formatTimestamp(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  } catch { return iso; }
}

function getMessageDisplayName(t: string | undefined, i: number, msg: QueryDataMessage): string {
  if (msg.name) return msg.name;
  const c = msg.data.content;
  if (c) return c.length > 40 ? c.slice(0, 40) + "…" : c;
  if (msg.data.embeds && msg.data.embeds.length > 0) {
    const t = msg.data.embeds[0].title;
    if (t) return t.length > 40 ? t.slice(0, 40) + "…" : t;
  }
  return `Message ${i + 1}`;
}

function renderDiscordText(text: string | null | undefined): ReactNode[] {
  const val = text || "";
  const parts: ReactNode[] = [];
  const pattern = /<a?:([a-zA-Z0-9_]+):(\d+)>/g;
  let lastIndex = 0, match: RegExpExecArray | null = null;
  while ((match = pattern.exec(val)) !== null) {
    if (match.index > lastIndex) parts.push(val.slice(lastIndex, match.index));
    parts.push(<span key={`e-${match.index}`} className="inline-flex items-center gap-0.5 rounded bg-white/5 px-1 text-xs text-zinc-300">:{match[1]}:</span>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < val.length) parts.push(val.slice(lastIndex));
  return parts.length ? parts : [val];
}

function renderUnicodeEmoji(text: string): ReactNode {
  return <span>{text}</span>;
}

// ── Emoji Picker Component ──────────────────────────────────────────

function EmojiPickerPopover({ open, onClose, onEmojiSelect, serverEmojis }: {
  open: boolean; onClose: () => void; onEmojiSelect: (emoji: APIEmoji) => void; serverEmojis: GuildEmoji[];
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("people");
  const [customTab, setCustomTab] = useState<"unicode" | "server">("unicode");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setSearch(""); return; }
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const filteredServer = serverEmojis.filter((e) => !search || e.name.toLowerCase().includes(search.toLowerCase()));

  const allUnicode = Object.values(UNICODE_EMOJIS).flat();
  const filteredUnicode = search
    ? allUnicode.filter((e) => e.includes(search))
    : UNICODE_EMOJIS[category] || [];

  const content = (
    <div ref={ref} className="fixed left-1/2 top-1/2 z-[100] w-[352px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
      {/* Search */}
      <div className="border-b border-zinc-800 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emojis..."
            className="w-full rounded-lg border border-zinc-700 bg-black py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-500" />
        </div>
      </div>
      {!search && (
        <div className="flex border-b border-zinc-800">
          {(["unicode", "server"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setCustomTab(tab)}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${customTab === tab ? "border-b-2 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              style={customTab === tab ? { borderColor: ACCENT, color: ACCENT } : {}}>
              {tab === "unicode" ? "Unicode" : `Server (${serverEmojis.length})`}
            </button>
          ))}
        </div>
      )}
      {customTab === "unicode" && !search && (
        <div className="flex border-b border-zinc-800 px-2 py-1">
          {UNICODE_EMOJI_CATEGORIES.map((cat) => (
            <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
              className={`rounded px-1.5 py-1 text-sm transition-colors ${category === cat.id ? "bg-zinc-700" : "hover:bg-zinc-800"}`}
              title={cat.label}>{cat.icon}</button>
          ))}
        </div>
      )}
      <div className="max-h-60 overflow-y-auto p-2">
        {customTab === "unicode" ? (
          <div className="grid grid-cols-8 gap-0.5">
            {filteredUnicode.map((emo, i) => (
              <button key={`${emo}-${i}`} type="button" onClick={() => { onEmojiSelect({ name: emo }); onClose(); }}
                className="flex aspect-square items-center justify-center rounded p-0.5 text-xl hover:bg-zinc-800">{emo}</button>
            ))}
            {filteredUnicode.length === 0 && <div className="col-span-8 py-6 text-center text-xs text-zinc-500">No emojis found</div>}
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-1">
            {filteredServer.map((emo) => (
              <button key={emo.id} type="button" title={`:${emo.name}:`}
                onClick={() => { onEmojiSelect({ id: emo.id, name: emo.name, animated: emo.animated }); onClose(); }}
                className="flex items-center justify-center rounded p-1 hover:bg-zinc-800">
                <img src={emo.url} alt={emo.name} className="h-7 w-7 object-contain" />
              </button>
            ))}
            {filteredServer.length === 0 && <div className="col-span-6 py-6 text-center text-xs text-zinc-500">No server emojis</div>}
          </div>
        )}
      </div>
      {customTab === "server" && (
        <div className="border-t border-zinc-800 p-2">
          <p className="mb-1 text-[10px] text-zinc-500">Add custom emoji by ID or name:</p>
          <div className="flex gap-1">
            <input type="text" placeholder=":name:id or emoji ID"
              className="min-w-0 flex-1 rounded border border-zinc-700 bg-black px-2 py-1 text-[10px] text-zinc-200 placeholder-zinc-600 outline-none" />
            <button type="button" className="rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-700">Add</button>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(
    <div>
      <div className="fixed inset-0 z-[99] bg-black/50" onClick={onClose} />
      {content}
    </div>,
    document.body
  );
}

// ── Component Edit Modal ────────────────────────────────────────────

function ComponentEditModal({ open, onClose, component, onChange, serverEmojis }: {
  open: boolean; onClose: () => void;
  component: APIComponentInActionRow | null;
  onChange: (c: APIComponentInActionRow) => void;
  serverEmojis: GuildEmoji[];
}) {
  const [draft, setDraft] = useState<APIComponentInActionRow | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  useEffect(() => { if (open && component) setDraft(JSON.parse(JSON.stringify(component))); }, [open, component]);

  if (!open || !draft) return null;

  const isButton = draft.type === 2;
  const isSelect = draft.type >= 3 && draft.type <= 8;
  const isStringSelect = draft.type === 3;

  const update = (updates: Partial<APIComponentInActionRow>) => {
    setDraft({ ...draft, ...updates } as APIComponentInActionRow);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-border/70 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" style={{ color: ACCENT }} />
            Edit {isButton ? "Button" : "Select Menu"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Configure the {isButton ? "button label, style, emoji, and behavior" : "select menu options and settings"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isButton && (
            <>
              {/* Emoji + Label + Disabled */}
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-zinc-500">Emoji</span>
                  <div className="relative">
                    <button type="button" onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-black text-lg hover:border-zinc-500">
                      {draft.emoji?.id ? (
                        <img src={`https://cdn.discordapp.com/emojis/${draft.emoji.id}.${draft.emoji.animated ? "gif" : "png"}?size=48`}
                          alt="" className="h-6 w-6 object-contain" />
                      ) : draft.emoji?.name ? (
                        <span>{draft.emoji.name}</span>
                      ) : (
                        <Smile className="h-4 w-4 text-zinc-500" />
                      )}
                    </button>
                    <EmojiPickerPopover open={emojiPickerOpen} onClose={() => setEmojiPickerOpen(false)}
                      onEmojiSelect={(emo) => update({ emoji: emo })} serverEmojis={serverEmojis} />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <Label className="text-xs text-zinc-400">Label</Label>
                  <input type="text" value={draft.label || ""} onChange={(e) => update({ label: e.target.value || undefined })}
                    placeholder="Button label" maxLength={80}
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600" />
                </div>
                <div className="mt-4 flex items-center gap-1.5">
                  <label className="text-[10px] text-zinc-500">Disabled</label>
                  <input type="checkbox" checked={draft.disabled || false}
                    onChange={(e) => update({ disabled: e.target.checked || undefined })}
                    className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800" />
                </div>
              </div>

              {/* Style picker */}
              {draft.style !== 5 ? (
                <div>
                  <Label className="text-xs text-zinc-400">Style</Label>
                  <div className="mt-1 grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((s) => {
                      const bs = BUTTON_STYLES[s];
                      return (
                        <button key={s} type="button" onClick={() => update({ style: s as ButtonStyle })}
                          className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
                            draft.style === s ? "ring-2 ring-white/40" : ""
                          } ${bs?.discordClass}`}>
                          {draft.style === s && <Check className="h-3 w-3" />}
                          {bs?.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* URL (link style) or custom_id */}
              {draft.style === 5 ? (
                <div>
                  <Label className="text-xs text-zinc-400">URL (Link button)</Label>
                  <input type="url" value={(draft as APIButtonComponent).url || ""}
                    onChange={(e) => update({ url: e.target.value } as Partial<APIButtonComponent>)}
                    placeholder="https://discord.com"
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600" />
                </div>
              ) : (
                <div>
                  <Label className="text-xs text-zinc-400">Custom ID</Label>
                  <input type="text" value={(draft as APIButtonComponent).custom_id || ""}
                    onChange={(e) => update({ custom_id: e.target.value } as Partial<APIButtonComponent>)}
                    placeholder="my_button_id"
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600" />
                </div>
              )}
            </>
          )}

          {isSelect && (
            <>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <Label className="text-xs text-zinc-400">Placeholder</Label>
                  <input type="text" value={(draft as APIStringSelectComponent).placeholder || ""}
                    onChange={(e) => update({ placeholder: e.target.value || undefined })}
                    placeholder={isStringSelect ? "Choose an option" : "Select..."} maxLength={150}
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600" />
                </div>
                <div className="mt-4 flex items-center gap-1.5">
                  <label className="text-[10px] text-zinc-500">Disabled</label>
                  <input type="checkbox" checked={draft.disabled || false}
                    onChange={(e) => update({ disabled: e.target.checked || undefined })}
                    className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800" />
                </div>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Custom ID</Label>
                <input type="text" value={draft.custom_id || ""} onChange={(e) => update({ custom_id: e.target.value })}
                  placeholder="select_menu_id"
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600" />
              </div>

              {isStringSelect && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="text-xs text-zinc-400">Options ({(draft as APIStringSelectComponent).options.length}/25)</Label>
                  </div>
                  <div className="space-y-2">
                    {(draft as APIStringSelectComponent).options.map((opt, oi) => (
                      <div key={oi} className="rounded-lg border border-zinc-800 bg-black/50 p-2">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[10px] text-zinc-500">Option {oi + 1}</span>
                          <div className="flex items-center gap-1">
                            <button type="button" disabled={oi === 0}
                              onClick={() => {
                                const opts = [...(draft as APIStringSelectComponent).options];
                                [opts[oi - 1], opts[oi]] = [opts[oi], opts[oi - 1]];
                                update({ options: opts } as Partial<APIStringSelectComponent>);
                              }}
                              className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                            <button type="button" disabled={oi === (draft as APIStringSelectComponent).options.length - 1}
                              onClick={() => {
                                const opts = [...(draft as APIStringSelectComponent).options];
                                [opts[oi], opts[oi + 1]] = [opts[oi + 1], opts[oi]];
                                update({ options: opts } as Partial<APIStringSelectComponent>);
                              }}
                              className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
                            <button type="button"
                              onClick={() => {
                                const cloned = JSON.parse(JSON.stringify(opt));
                                cloned.value = randomId();
                                const opts = [...(draft as APIStringSelectComponent).options];
                                opts.splice(oi + 1, 0, cloned);
                                update({ options: opts } as Partial<APIStringSelectComponent>);
                              }}
                              className="text-zinc-600 hover:text-zinc-300"><Copy className="h-3 w-3" /></button>
                            <button type="button"
                              onClick={() => {
                                const opts = (draft as APIStringSelectComponent).options.filter((_, i) => i !== oi);
                                update({ options: opts } as Partial<APIStringSelectComponent>);
                              }}
                              className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
                          </div>
                        </div>
                        <div className="mb-1 flex items-center gap-2">
                          <input type="text" value={opt.label} onChange={(e) => {
                            const opts = [...(draft as APIStringSelectComponent).options];
                            opts[oi] = { ...opts[oi], label: e.target.value };
                            update({ options: opts } as Partial<APIStringSelectComponent>);
                          }} placeholder="Label" maxLength={100}
                            className="min-w-0 flex-1 rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
                          <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                            <input type="checkbox" checked={opt.default || false}
                              onChange={(e) => {
                                const opts = [...(draft as APIStringSelectComponent).options];
                                opts[oi] = { ...opts[oi], default: e.target.checked };
                                update({ options: opts } as Partial<APIStringSelectComponent>);
                              }}
                              className="h-3 w-3 rounded border-zinc-700 bg-zinc-800" />
                            Default
                          </label>
                        </div>
                        <input type="text" value={opt.description || ""} onChange={(e) => {
                          const opts = [...(draft as APIStringSelectComponent).options];
                          opts[oi] = { ...opts[oi], description: e.target.value || undefined };
                          update({ options: opts } as Partial<APIStringSelectComponent>);
                        }} placeholder="Description (optional)" maxLength={100}
                          className="mb-1 w-full rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
                        <input type="text" value={opt.value} onChange={(e) => {
                          const opts = [...(draft as APIStringSelectComponent).options];
                          opts[oi] = { ...opts[oi], value: e.target.value };
                          update({ options: opts } as Partial<APIStringSelectComponent>);
                        }} placeholder="Value" maxLength={100}
                          className="w-full rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none font-mono" />
                      </div>
                    ))}
                    <button type="button" disabled={(draft as APIStringSelectComponent).options.length >= 25}
                      onClick={() => {
                        const opts = [...(draft as APIStringSelectComponent).options, { label: "", value: randomId() }];
                        update({ options: opts } as Partial<APIStringSelectComponent>);
                      }}
                      className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 py-1.5 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 disabled:opacity-40">
                      <Plus className="h-3 w-3" /> Add Option
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Min/Max values for select */}
          {isStringSelect && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-zinc-400">Min Values</Label>
                <input type="number" value={(draft as APIStringSelectComponent).min_values ?? 1}
                  onChange={(e) => update({ min_values: Math.max(0, Number(e.target.value)) } as Partial<APIStringSelectComponent>)}
                  min={0} max={(draft as APIStringSelectComponent).max_values ?? 1}
                  className="mt-1 w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 outline-none" />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Max Values</Label>
                <input type="number" value={(draft as APIStringSelectComponent).max_values ?? 1}
                  onChange={(e) => update({ max_values: Math.max(1, Number(e.target.value)) } as Partial<APIStringSelectComponent>)}
                  min={1} max={25}
                  className="mt-1 w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 outline-none" />
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="rounded-lg border border-zinc-800 bg-black/30 p-3">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">Preview</p>
          <div className="flex flex-wrap gap-2">
            {isButton && (
              <div className={`inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm font-medium ${draft.style === 5 ? "bg-transparent" : ""}`}
                style={draft.style === 5 ? { color: "#00a8fc", border: "1px solid #00a8fc" } : { color: BUTTON_STYLES[draft.style]?.color || "#fff", backgroundColor: BUTTON_STYLES[draft.style]?.bg || "#5865f2", border: `1px solid ${BUTTON_STYLES[draft.style]?.border || "#5865f2"}` }}>
                {draft.emoji?.name && <span>{draft.emoji.name}</span>}
                {draft.label || "Button"}
                {draft.style === 5 && <ExternalLink className="h-3 w-3" />}
              </div>
            )}
            {isStringSelect && (
              <div className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm text-zinc-400" style={{ backgroundColor: "#4e5058" }}>
                <ChevronDown className="h-3 w-3" />
                {(draft as APIStringSelectComponent).placeholder || "Select an option"}
              </div>
            )}
            {(draft.type === 5 || draft.type === 6 || draft.type === 7 || draft.type === 8) && (
              <div className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm text-zinc-400" style={{ backgroundColor: "#4e5058" }}>
                <ChevronDown className="h-3 w-3" />
                {draft.placeholder || "Select..."}
              </div>
            )}
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
          <button type="button" onClick={() => { onChange(draft); onClose(); }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: ACCENT }}>
            <Check className="mr-1 inline h-4 w-4" /> Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Discord Message Preview ─────────────────────────────────────────

function DiscordPreview({ message, isV2, targets, onEditComponent }: { message: QueryDataMessageData; isV2?: boolean; targets?: QueryDataTarget[]; onEditComponent?: (comp: APIComponentInActionRow) => void }) {
  const hasContent = !!message.content;
  const hasEmbeds = message.embeds && message.embeds.length > 0;
  const hasComponents = message.components && message.components.length > 0 && message.components.some((r) => (r.type === 1 && r.components.length > 0) || r.type === 17);

  const webhookName = targets?.find((t) => t.type === TargetType.Webhook)?.url ? "Webhook" : undefined;

  if (!hasContent && !hasEmbeds && !hasComponents) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg px-6 py-12 text-center" style={{ backgroundColor: EMBED_BG }}>
        <Eye className="mb-3 h-10 w-10 text-zinc-600" />
        <p className="text-sm text-zinc-500">Your message preview will appear here</p>
        <p className="mt-1 text-xs text-zinc-600">Add content, embeds, or components to get started</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg px-4 py-3 text-sm leading-relaxed" style={{ backgroundColor: EMBED_BG }}>
      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-500 text-sm font-bold text-white">
          {webhookName ? "W" : "A"}
        </div>
        <div>
          <span className="font-semibold" style={{ color: !webhookName ? ACCENT : undefined }}>
            {webhookName || "AOI Bot"}
          </span>
          {isV2 && <span className="ml-1 rounded bg-zinc-700 px-1 py-0.5 text-[9px] text-zinc-400">V2</span>}
          <span className="ml-2 text-zinc-500">Today at 12:00 AM</span>
        </div>
      </div>

      {hasContent && <div className="whitespace-pre-wrap text-[15px]" style={{ color: TEXT_COLOR }}>{renderDiscordText(message.content)}</div>}

      {hasEmbeds && message.embeds!.map((embed, ei) => (
        <div key={ei} className={`overflow-hidden rounded-lg border-l-4 ${hasContent || ei > 0 ? "mt-2" : ""}`}
          style={{ borderLeftColor: intToHex(embed.color), backgroundColor: "#2f3136" }}>
          <div className="px-3 py-2">
            {embed.author && (
              <div className="mb-1 flex items-center gap-2 text-xs text-zinc-400">
                {embed.author.icon_url && <img src={embed.author.icon_url} alt="" className="h-4 w-4 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                {embed.author.url ? (
                  <a href={embed.author.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: "#00a8fc" }}>{embed.author.name}</a>
                ) : <span className="font-semibold text-white">{embed.author.name}</span>}
              </div>
            )}
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                {embed.title && (
                  <div className="mb-1">
                    {embed.url ? (
                      <a href={embed.url} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold hover:underline" style={{ color: "#00a8fc" }}>{renderDiscordText(embed.title)}</a>
                    ) : <h3 className="text-lg font-semibold text-white">{renderDiscordText(embed.title)}</h3>}
                  </div>
                )}
                {embed.description && <div className="whitespace-pre-wrap text-sm" style={{ color: TEXT_COLOR }}>{renderDiscordText(embed.description)}</div>}
                {embed.fields && embed.fields.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {embed.fields.map((f, fi) => (
                      <div key={fi} className={f.inline ? "col-span-1" : "col-span-3"}>
                        <div className="text-xs font-semibold text-white">{renderDiscordText(f.name)}</div>
                        <div className="whitespace-pre-wrap text-xs" style={{ color: TEXT_COLOR }}>{renderDiscordText(f.value)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {embed.image && <img src={embed.image.url} alt="" className="mt-2 max-h-80 w-full rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
              </div>
              {embed.thumbnail && <img src={embed.thumbnail.url} alt="" className="mt-1 h-20 w-20 flex-shrink-0 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
            </div>
            {(embed.footer || embed.timestamp) && (
              <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                {embed.footer?.icon_url && <img src={embed.footer.icon_url} alt="" className="h-4 w-4 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                {embed.footer?.text && <span>{embed.footer.text}</span>}
                {embed.footer?.text && embed.timestamp && <span>•</span>}
                {embed.timestamp && <span>{formatTimestamp(embed.timestamp)}</span>}
              </div>
            )}
          </div>
        </div>
      ))}

      {hasComponents && message.components!.map((row, ri) =>
        row.type === 1 && row.components.length > 0 ? (
          <div key={ri} className={`flex flex-wrap gap-2 ${hasContent || hasEmbeds ? "mt-2" : ""}`}>
            {row.components.map((comp, ci) => {
              if (comp.type === 2) {
                const s = BUTTON_STYLES[comp.style] || BUTTON_STYLES[1];
                if (comp.style === 5) {
                  return (
                    <a key={ci} href={comp.url || "#"} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm font-medium transition-colors hover:brightness-110"
                      style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                      {comp.emoji?.name && <span>{comp.emoji.name}</span>}{comp.label || "Link"}<ExternalLink className="h-3 w-3" />
                    </a>
                  );
                }
                return (
                  <button key={ci} type="button" disabled={comp.disabled}
                    onClick={() => onEditComponent?.(comp)}
                    className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm font-medium transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                    {comp.emoji?.name && <span>{comp.emoji.name}</span>}{comp.label || "Button"}
                  </button>
                );
              }
              if (comp.type === 3) {
                return (
                  <div key={ci} onClick={() => onEditComponent?.(comp)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-zinc-400 hover:brightness-110" style={{ backgroundColor: "#4e5058" }}>
                    <ChevronDown className="h-3 w-3" />{comp.placeholder || "Select an option"}
                  </div>
                );
              }
              if (comp.type >= 5 && comp.type <= 8) {
                return (
                  <div key={ci} onClick={() => onEditComponent?.(comp)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-zinc-400 hover:brightness-110" style={{ backgroundColor: "#4e5058" }}>
                    <ChevronDown className="h-3 w-3" />{comp.placeholder || "Select..."}
                  </div>
                );
              }
              return null;
            })}
          </div>
        ) : row.type === 17 ? (
          <ContainerPreview key={ri} container={row} hasTopMargin={hasContent || hasEmbeds} onEditComponent={onEditComponent} />
        ) : null
      )}
    </div>
  );
}

// ── Container Preview (V2) ─────────────────────────────────────────

function ContainerPreview({ container, hasTopMargin, onEditComponent }: { container: APIContainerComponent; hasTopMargin: boolean; onEditComponent?: (comp: APIComponentInActionRow) => void }) {
  const accentColor = container.accent_color != null ? intToHex(container.accent_color) : null;
  return (
    <div className={`flex ${hasTopMargin ? "mt-2" : ""}`}>
      {accentColor && (
        <div className="mr-2 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: accentColor }} />
      )}
      <div className="min-w-0 flex-1 space-y-1">
        {container.components.map((item, ci) => {
          if (item.type === 10) {
            return <div key={ci} className="whitespace-pre-wrap text-sm" style={{ color: TEXT_COLOR }}>{item.content}</div>;
          }
          if (item.type === 11 || item.type === 12) {
            const url = item.items?.[0]?.media?.url;
            return url ? <img key={ci} src={url} alt="" className="max-h-80 w-full rounded-lg object-cover" /> : null;
          }
          if (item.type === 13) {
            const url = item.items?.[0]?.media?.url;
            if (!url) return null;
            const filename = url.split("/").pop() || "file";
            return (
              <div key={ci} className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-black/30 px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-xs hover:underline" style={{ color: "#00a8fc" }}>{filename}</a>
              </div>
            );
          }
          if (item.type === 14) {
            return <div key={ci} className="h-px w-full bg-zinc-700" />;
          }
          if (item.type === 9) {
            const textChild = item.components?.find((c): c is APIV2TextDisplay => c.type === 10);
            const thumbChild = item.components?.find((c): c is APIV2Thumbnail => c.type === 11);
            const accessory = item.accessory;
            return (
              <div key={ci} className="flex items-start gap-3 rounded-lg bg-black/20 px-3 py-2">
                <div className="min-w-0 flex-1">
                  {textChild && <div className="whitespace-pre-wrap text-sm" style={{ color: TEXT_COLOR }}>{textChild.content}</div>}
                  {thumbChild && (() => {
                    const url = thumbChild.items?.[0]?.media?.url;
                    return url ? <img src={url} alt="" className="mt-1 max-h-40 rounded-lg object-cover" /> : null;
                  })()}
                </div>
                {accessory?.type === 2 && (() => {
                  const btn = accessory as APIButtonComponent;
                  const s = BUTTON_STYLES[btn.style] || BUTTON_STYLES[1];
                  if (btn.style === 5) {
                    return (
                      <a key="acc" href={btn.url || "#"} target="_blank" rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors hover:brightness-110"
                        style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                        {btn.label || "Link"}<ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    );
                  }
                  return (
                    <button key="acc" type="button" disabled={btn.disabled}
                      onClick={() => onEditComponent?.(btn)}
                      className="inline-flex shrink-0 items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors hover:brightness-110 disabled:opacity-50"
                      style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                      {btn.label || "Button"}
                    </button>
                  );
                })()}
                {accessory?.type === 11 && (() => {
                  const url = (accessory as APIV2Thumbnail).items?.[0]?.media?.url;
                  return url ? <img src={url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" /> : null;
                })()}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

// ── Status Banner ──────────────────────────────────────────────────

function StatusBanner({ status }: { status: StatusMsg }) {
  if (!status || status.state === "idle") return null;
  const m: Record<string, string> = {
    success: "border-emerald-700/60 bg-emerald-500/10 text-emerald-300",
    error: "border-red-700/60 bg-red-500/10 text-red-300",
    info: "border-sky-700/60 bg-sky-500/10 text-sky-300",
    sending: "border-amber-700/60 bg-amber-500/10 text-amber-300",
  };
  return <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${m[status.state] || "text-zinc-400"}`}>{status.text}</div>;
}

// ── Color Swatch ────────────────────────────────────────────────────

function ColorSwatch({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) { document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler); }
  }, [open]);
  const hex = intToHex(value);
  useEffect(() => { if (open) setHexInput(hex.replace("#", "")); }, [open, hex]);
  const commitHex = (raw: string) => {
    const clean = raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    if (clean.length === 6) onChange(Number.parseInt(clean, 16));
    else if (!clean) onChange(null);
    setHexInput(clean);
  };
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="flex h-8 w-12 items-center justify-center rounded border border-zinc-700" style={{ backgroundColor: hex }}>
        <ChevronDown className="h-3 w-3 text-white/70" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
          <div className="mb-2 grid grid-cols-5 gap-1">
            {EMBED_PRESETS.map((p) => (
              <button key={p.value} type="button" title={p.label}
                onClick={() => { onChange(p.value); setOpen(false); }}
                className="h-6 w-full rounded border border-zinc-700 hover:scale-110 hover:border-white" style={{ backgroundColor: intToHex(p.value) }} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">#</span>
            <input type="text" value={hexInput}
              onChange={(e) => commitHex(e.target.value)}
              onBlur={() => onChange(hexInput.length >= 3 ? Number.parseInt(hexInput, 16) : null)}
              className="flex-1 rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200" placeholder="000000" />
          </div>
          <input type="color" value={value != null ? intToHex(value) : "#57f287"} onChange={(e) => { onChange(hexToInt(e.target.value)); setHexInput(e.target.value.replace("#", "")); }} className="mt-2 h-6 w-full cursor-pointer rounded border border-zinc-700" />
        </div>
      )}
    </div>
  );
}

// ── Embed Field Editor ──────────────────────────────────────────────

function EmbedFieldEditor({ fields, onChange }: { fields: APIEmbedField[]; onChange: (f: APIEmbedField[]) => void }) {
  return (
    <div className="space-y-2">
      {fields.map((f, i) => (
        <div key={i} className="rounded-lg border border-zinc-800 bg-black/50 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-zinc-500">Field {i + 1}</span>
            <label className="flex items-center gap-1 text-xs text-zinc-400">
              <input type="checkbox" checked={f.inline || false} onChange={(e) => onChange(fields.map((x, j) => j === i ? { ...x, inline: e.target.checked } : x))} className="h-3 w-3 rounded border-zinc-700 bg-zinc-800" /> Inline
            </label>
          </div>
          <input type="text" value={f.name} placeholder="Field name" onChange={(e) => onChange(fields.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
            className="mb-1 w-full rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
          <textarea value={f.value} placeholder="Field value" rows={2} onChange={(e) => onChange(fields.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
            className="w-full rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 resize-none outline-none" />
          <button type="button" onClick={() => onChange(fields.filter((_, j) => j !== i))} className="mt-1 text-[10px] text-zinc-600 hover:text-red-400"><X className="mr-0.5 inline h-3 w-3" /> Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...fields, { name: "", value: "", inline: false }])}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 py-1.5 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300">
        <Plus className="h-3 w-3" /> Add Field
      </button>
    </div>
  );
}

// ── Embed Editor ────────────────────────────────────────────────────

function EmbedEditor({ embed, onChange }: { embed: APIEmbed; onChange: (e: APIEmbed) => void }) {
  const update = (updates: Partial<APIEmbed>) => onChange({ ...embed, ...updates });

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <input type="text" value={embed.title || ""} onChange={(e) => update({ title: e.target.value || undefined })}
            placeholder="Embed title" maxLength={256}
            className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600" />
          <input type="text" value={embed.url || ""} onChange={(e) => update({ url: e.target.value || undefined })}
            placeholder="Title URL (optional)"
            className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600" />
          <textarea value={embed.description || ""} onChange={(e) => update({ description: e.target.value || undefined })}
            placeholder="Embed description" rows={3} maxLength={4000}
            className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none outline-none focus:border-zinc-600" />
        </div>
        <div className="flex flex-col items-center gap-1.5 pt-1">
          <span className="text-[10px] text-zinc-500">Color</span>
          <ColorSwatch value={embed.color ?? null} onChange={(v) => update({ color: v ?? undefined })} />
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <h3 className="mb-2 text-xs font-medium text-zinc-400">Author</h3>
        <div className="grid grid-cols-2 gap-2">
          <input type="text" value={embed.author?.name || ""} onChange={(e) => update({ author: { ...embed.author, name: e.target.value } })}
            placeholder="Author name" className="rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
          <input type="text" value={embed.author?.icon_url || ""} onChange={(e) => update({ author: { ...embed.author, icon_url: e.target.value || undefined } })}
            placeholder="Icon URL" className="rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
          <input type="text" value={embed.author?.url || ""} onChange={(e) => update({ author: { ...embed.author, url: e.target.value || undefined } })}
            placeholder="Author URL" className="rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <h3 className="mb-2 text-xs font-medium text-zinc-400">Fields ({embed.fields?.length || 0}/25)</h3>
        <EmbedFieldEditor fields={embed.fields || []} onChange={(fields) => update({ fields })} />
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <h3 className="mb-2 text-xs font-medium text-zinc-400">Images</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">Thumbnail URL</label>
            <input type="text" value={embed.thumbnail?.url || ""} onChange={(e) => update({ thumbnail: e.target.value ? { url: e.target.value } : undefined })}
              placeholder="https://..." className="w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">Image URL</label>
            <input type="text" value={embed.image?.url || ""} onChange={(e) => update({ image: e.target.value ? { url: e.target.value } : undefined })}
              placeholder="https://..." className="w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <h3 className="mb-2 text-xs font-medium text-zinc-400">Footer &amp; Timestamp</h3>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={embed.footer?.text || ""} onChange={(e) => update({ footer: { ...embed.footer, text: e.target.value } })}
              placeholder="Footer text" className="rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
            <input type="text" value={embed.footer?.icon_url || ""} onChange={(e) => update({ footer: { ...embed.footer, icon_url: e.target.value || undefined } })}
              placeholder="Icon URL" className="rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
          </div>
          <input type="datetime-local" value={embed.timestamp?.slice(0, 16) || ""} onChange={(e) => update({ timestamp: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
            className="w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 outline-none" />
        </div>
      </div>
    </div>
  );
}

// ── Component Editor ────────────────────────────────────────────────

function V2ChildEditor({ child, onChange, onRemove, serverEmojis }: {
  child: APIV2ChildComponent;
  onChange: (c: APIV2ChildComponent) => void;
  onRemove: () => void;
  serverEmojis: GuildEmoji[];
}) {
  const [sectionAccessoryOpen, setSectionAccessoryOpen] = useState(false);

  if (child.type === 10) {
    return (
      <div className="rounded border border-zinc-700 bg-black/30 p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] text-zinc-500">Text Display</span>
          <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
        </div>
        <textarea value={child.content} onChange={(e) => onChange({ ...child, content: e.target.value })}
          placeholder="Text content..." rows={2} maxLength={2000}
          className="w-full rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 resize-none outline-none" />
      </div>
    );
  }

  if (child.type === 11 || child.type === 12) {
    const label = child.type === 11 ? "Thumbnail" : "Media Gallery";
    return (
      <div className="rounded border border-zinc-700 bg-black/30 p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] text-zinc-500">{label}</span>
          <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
        </div>
        <input type="text" value={child.items?.[0]?.media?.url || ""}
          onChange={(e) => onChange({ ...child, items: [{ media: { url: e.target.value } }] } as any)}
          placeholder="Image URL..." className="w-full rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
      </div>
    );
  }

  if (child.type === 13) {
    return (
      <div className="rounded border border-zinc-700 bg-black/30 p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] text-zinc-500">File</span>
          <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
        </div>
        <input type="text" value={child.items?.[0]?.media?.url || ""}
          onChange={(e) => onChange({ ...child, items: [{ media: { url: e.target.value } }] } as any)}
          placeholder="File URL..." className="w-full rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
      </div>
    );
  }

  if (child.type === 14) {
    return (
      <div className="flex items-center gap-2 rounded border border-zinc-700 bg-black/30 px-2 py-1">
        <div className="h-px flex-1 bg-zinc-700" />
        <span className="text-[10px] text-zinc-500">Separator</span>
        <div className="h-px flex-1 bg-zinc-700" />
        <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
      </div>
    );
  }

  if (child.type === 9) {
    const textChild = child.components?.find((c): c is APIV2TextDisplay => c.type === 10);
    const thumbChild = child.components?.find((c): c is APIV2Thumbnail => c.type === 11);
    return (
      <div className="rounded border border-zinc-700 bg-black/30 p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] text-zinc-500">Section</span>
          <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
        </div>
        <textarea value={textChild?.content || ""}
          onChange={(e) => onChange({ ...child, components: [{ type: 10, content: e.target.value }] } as any)}
          placeholder="Section text..." rows={2} maxLength={2000}
          className="mb-1 w-full rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 resize-none outline-none" />
        {thumbChild && (
          <input type="text" value={thumbChild.items?.[0]?.media?.url || ""}
            onChange={(e) => onChange({ ...child, components: [textChild || { type: 10, content: "" }, { type: 11, items: [{ media: { url: e.target.value } }] }] } as any)}
            placeholder="Thumbnail URL..." className="mb-1 w-full rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
        )}
        <div className="flex gap-1">
          {!thumbChild && (
            <button type="button" onClick={() => onChange({ ...child, components: [...(child.components || []), { type: 11, items: [{ media: { url: "" } }] }] } as any)}
              className="rounded px-1.5 py-0.5 text-[9px] uppercase text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"><Image className="mr-0.5 inline h-2.5 w-2.5" />+Thumbnail</button>
          )}
          {thumbChild && (
            <button type="button" onClick={() => onChange({ ...child, components: child.components.filter((c) => c.type !== 11) } as any)}
              className="rounded px-1.5 py-0.5 text-[9px] uppercase text-zinc-500 hover:bg-zinc-800 hover:text-red-300">-Thumbnail</button>
          )}
          <div className="relative">
            <button type="button" onClick={() => setSectionAccessoryOpen(!sectionAccessoryOpen)}
              className="rounded px-1.5 py-0.5 text-[9px] uppercase text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
              {child.accessory ? "Edit Acc" : "+Acc"}
            </button>
            {sectionAccessoryOpen && (
              <div className="absolute bottom-full left-0 z-10 mb-1 w-44 rounded border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
                {child.accessory?.type === 2 && (
                  <div className="space-y-1">
                    <p className="text-[9px] text-zinc-500">Button Accessory</p>
                    <input type="text" value={(child.accessory as APIButtonComponent).label || ""}
                      onChange={(e) => onChange({ ...child, accessory: { ...child.accessory, label: e.target.value } as APIButtonComponent } as any)}
                      placeholder="Label" className="w-full rounded border border-zinc-700 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none" />
                    <input type="text" value={(child.accessory as APIButtonComponent).url || (child.accessory as APIButtonComponent).custom_id || ""}
                      onChange={(e) => {
                        const acc = child.accessory as APIButtonComponent;
                        if (acc.style === 5) onChange({ ...child, accessory: { ...acc, url: e.target.value } } as any);
                        else onChange({ ...child, accessory: { ...acc, custom_id: e.target.value } } as any);
                      }}
                      placeholder="URL / Custom ID" className="w-full rounded border border-zinc-700 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none" />
                    <select value={(child.accessory as APIButtonComponent).style}
                      onChange={(e) => onChange({ ...child, accessory: { ...child.accessory, style: Number(e.target.value) as ButtonStyle } } as any)}
                      className="w-full rounded border border-zinc-700 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none">
                      {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{BUTTON_STYLES[s]?.label || s}</option>)}
                    </select>
                  </div>
                )}
                {child.accessory?.type === 11 && (
                  <div className="space-y-1">
                    <p className="text-[9px] text-zinc-500">Thumbnail Accessory</p>
                    <input type="text" value={(child.accessory as APIV2Thumbnail).items?.[0]?.media?.url || ""}
                      onChange={(e) => onChange({ ...child, accessory: { type: 11, items: [{ media: { url: e.target.value } }] } } as any)}
                      placeholder="URL..." className="w-full rounded border border-zinc-700 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none" />
                  </div>
                )}
                {!child.accessory && (
                  <div className="space-y-1">
                    <button type="button" onClick={() => onChange({ ...child, accessory: { type: 2, style: 1, label: "Button", custom_id: `btn_${randomId()}` } } as any)}
                      className="block w-full rounded px-1.5 py-1 text-[10px] text-left text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">Button</button>
                    <button type="button" onClick={() => onChange({ ...child, accessory: { type: 11, items: [{ media: { url: "" } }] } } as any)}
                      className="block w-full rounded px-1.5 py-1 text-[10px] text-left text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">Thumbnail</button>
                  </div>
                )}
                {(child.accessory) && (
                  <button type="button" onClick={() => onChange({ ...child, accessory: undefined } as any)}
                    className="mt-1 w-full rounded px-1.5 py-0.5 text-[9px] text-red-400 hover:bg-zinc-800">Remove</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function V2ContainerEditor({ container, onContainerChange, onRemove, serverEmojis }: {
  container: APIContainerComponent;
  onContainerChange: (c: APIContainerComponent) => void;
  onRemove: () => void;
  serverEmojis: GuildEmoji[];
}) {
  const addChild = (type: APIV2ChildComponent["type"]) => {
    const item: APIV2ChildComponent = type === 10 ? { type: 10, content: "" }
      : type === 11 ? { type: 11, items: [{ media: { url: "" } }] }
      : type === 12 ? { type: 12, items: [{ media: { url: "" } }] }
      : type === 13 ? { type: 13, items: [{ media: { url: "" } }] }
      : type === 14 ? { type: 14, divider: true, spacing: 1 }
      : { type: 9, components: [{ type: 10, content: "" }] };
    onContainerChange({ ...container, components: [...container.components, item] });
  };
  const updateChild = (ci: number, c: APIV2ChildComponent) => {
    const next = [...container.components];
    next[ci] = c;
    onContainerChange({ ...container, components: next });
  };
  const removeChild = (ci: number) => {
    onContainerChange({ ...container, components: container.components.filter((_, i) => i !== ci) });
  };

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">V2 Container ({container.components.length} items)</span>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5">
            <ColorSwatch value={container.accent_color ?? null} onChange={(v) => onContainerChange({ ...container, accent_color: v ?? undefined })} />
          </div>
          <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
        </div>
      </div>
      <div className="mb-1 space-y-1">
        {container.components.length === 0 ? (
          <div className="py-1 text-center text-[10px] text-zinc-600">Empty container</div>
        ) : (
          container.components.map((child, ci) => (
            <V2ChildEditor key={ci} child={child} onChange={(c) => updateChild(ci, c)} onRemove={() => removeChild(ci)} serverEmojis={serverEmojis} />
          ))
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {([10, 14, 12, 11, 13, 9] as const).map((t) => (
          <button key={t} type="button" onClick={() => addChild(t)}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] uppercase text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
            +{t === 10 ? "Text" : t === 11 ? "Thumb" : t === 12 ? "Media" : t === 13 ? "File" : t === 14 ? "Divider" : "Section"}
          </button>
        ))}
      </div>
    </div>
  );
}

function ComponentEditorForMessage({ components, onChange, onEditComponent, serverEmojis, isV2 }: {
  components: APITopLevelComponent[];
  onChange: (c: APITopLevelComponent[]) => void;
  onEditComponent: (comp: APIComponentInActionRow) => void;
  serverEmojis: GuildEmoji[];
  isV2?: boolean;
}) {
  const addRow = () => onChange([...components, { type: 1, components: [] }]);
  const removeRow = (ri: number) => onChange(components.filter((_, i) => i !== ri));
  const addButton = (ri: number, style: ButtonStyle = 1) => {
    onChange(components.map((r, i) => {
      if (i !== ri || r.type !== 1) return r;
      if (r.components.length >= 5) return r;
      return { ...r, components: [...r.components, { type: 2 as const, style, label: "Button", custom_id: `btn_${randomId()}`, disabled: false } as APIButtonComponent] };
    }));
  };
  const addStringSelect = (ri: number) => {
    onChange(components.map((r, i) => {
      if (i !== ri || r.type !== 1) return r;
      if (r.components.length >= 5) return r;
      return { ...r, components: [...r.components, { type: 3 as const, custom_id: `select_${randomId()}`, placeholder: "Choose an option", options: [] } as APIStringSelectComponent] };
    }));
  };
  const removeComp = (ri: number, ci: number) => {
    onChange(components.map((r, i) => i === ri && r.type === 1 ? { ...r, components: r.components.filter((_, j) => j !== ci) } : r));
  };

  const addV2Container = (itemType: APIV2ChildComponent["type"]) => {
    const item: APIV2ChildComponent = itemType === 10 ? { type: 10, content: "" }
      : itemType === 11 ? { type: 11, items: [{ media: { url: "" } }] }
      : itemType === 12 ? { type: 12, items: [{ media: { url: "" } }] }
      : itemType === 13 ? { type: 13, items: [{ media: { url: "" } }] }
      : itemType === 14 ? { type: 14, divider: true, spacing: 1 }
      : { type: 9, components: [{ type: 10, content: "" }] };
    onChange([...components, { type: 17, components: [item] }]);
  };

  const updateContainer = (ri: number, updated: APIContainerComponent) => {
    onChange(components.map((r, i) => i === ri ? updated : r));
  };

  const v2AddLabels: { type: APIV2ChildComponent["type"]; label: string }[] = [
    { type: 10, label: "Text" },
    { type: 14, label: "Divider" },
    { type: 12, label: "Media" },
    { type: 11, label: "Thumb" },
    { type: 13, label: "File" },
    { type: 9, label: "Section" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-zinc-500">{isV2 ? "Layout Containers (V2)" : "Action Rows"}</p>
        {isV2 && (
          <div className="flex gap-1">
            {v2AddLabels.map(({ type, label }) => (
              <button key={type} type="button" onClick={() => addV2Container(type)}
                className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] uppercase text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
                <Plus className="h-2.5 w-2.5" /> {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {components.map((row, ri) =>
        row.type === 1 ? (
          <div key={ri} className="rounded-lg border border-zinc-800 bg-black/50 p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Row {ri + 1} ({row.components.length}/5)</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => addButton(ri)} className="rounded px-2 py-0.5 text-[10px] uppercase text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">+Btn</button>
                <button type="button" onClick={() => addStringSelect(ri)} className="rounded px-2 py-0.5 text-[10px] uppercase text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">+Sel</button>
                {components.length > 1 && <button type="button" onClick={() => removeRow(ri)} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>}
              </div>
            </div>
            {row.components.length === 0 ? (
              <div className="py-2 text-center text-[10px] text-zinc-600">Empty row</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {row.components.map((comp, ci) => (
                  <button key={ci} type="button"
                    onClick={() => onEditComponent(comp)}
                    className="group relative rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-500">
                    {comp.type === 2 ? (
                      <span>{comp.label || "Button"} <span className="text-zinc-500">({BUTTON_STYLES[comp.style]?.label || "?"})</span></span>
                    ) : (
                      <span>Select{comp.placeholder ? `: ${comp.placeholder}` : ""}</span>
                    )}
                    <span className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-red-500 p-0.5 group-hover:block"
                      onClick={(e) => { e.stopPropagation(); removeComp(ri, ci); }}>
                      <X className="h-2.5 w-2.5 text-white" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : row.type === 17 ? (
          <V2ContainerEditor key={ri} container={row} onContainerChange={(c) => updateContainer(ri, c)} onRemove={() => removeRow(ri)} serverEmojis={serverEmojis} />
        ) : null
      )}
      {!isV2 && (
        <button type="button" onClick={addRow}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 py-1.5 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300">
          <Plus className="h-3 w-3" /> Add Row
        </button>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────

export default function GuildAnnouncementsPage() {
  const router = useRouter();
  const { guildId } = router.query;

  // Guild data
  const [loading, setLoading] = useState(true);
  const [guild, setGuild] = useState<Record<string, any> | null>(null);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [serverEmojis, setServerEmojis] = useState<GuildEmoji[]>([]);

  // QueryData state
  const [data, setData] = useState<QueryData>(() => ({
    version: "d2",
    messages: [{ _id: randomId(), data: {} }],
    targets: [],
  }));
  const [selectedMessageIndex, setSelectedMessageIndex] = useState(0);
  const [status, setStatus] = useState<StatusMsg>(null);
  const [editTab, setEditTab] = useState<"content" | "embed" | "components">("content");
  const [editingComponent, setEditingComponent] = useState<APIComponentInActionRow | null>(null);
  const [componentModalOpen, setComponentModalOpen] = useState(false);
  const [newMsgFlags, setNewMsgFlags] = useState<number | undefined>(undefined);
  const [addMsgOpen, setAddMsgOpen] = useState(false);
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());

  // Presets
  const [presets, setPresets] = useState<{ id: string; name: string; kind: "draft" | "template"; data: QueryData }[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetsOpen, setPresetsOpen] = useState(false);

  const message = data.messages[selectedMessageIndex];
  const isV2 = isComponentsV2(message?.data.flags);

  // Load guild data
  useEffect(() => {
    if (!guildId || typeof guildId !== "string") return;
    (async () => {
      try {
        const [ovRes, chRes, emRes] = await Promise.all([
          fetch(`/api/dashboard/guild/${guildId}/overview`),
          fetch(`/api/guilds/${guildId}/channels`),
          fetch(`/api/guilds/${guildId}/emojis`),
        ]);
        if ([ovRes.status, chRes.status, emRes.status].some((s) => s === 401)) { router.replace("/api/auth/discord"); return; }
        const ov = await ovRes.json();
        const ch = await chRes.json().catch(() => ({ channels: [] }));
        const em = await emRes.json().catch(() => ({ emojis: [] }));
        setGuild(ov.guild);
        setModules(ov.modules || []);
        setChannels(Array.isArray(ch.channels) ? ch.channels.filter((c: GuildChannel) => c.type === 0) : []);
        setServerEmojis(Array.isArray(em.emojis) ? em.emojis : []);
        const communityModule = (ov.modules || []).find((m: ModuleRow) => m.name === "community");
        const savedPresets = communityModule?.config?.announcements_studio?.dashboardPresets;
        if (Array.isArray(savedPresets) && savedPresets.length > 0) {
          setPresets(savedPresets.map((p: any) => ({
            id: p.id || `preset-${Date.now()}`,
            name: String(p.name || "").slice(0, 80),
            kind: p.kind === "template" ? "template" as const : "draft" as const,
            data: p.data || { version: "d2", messages: [{ _id: randomId(), data: {} }], targets: [] },
          })));
        }
      } catch { } finally { setLoading(false); }
    })();
  }, [guildId, router]);

  const setD = useCallback((next: QueryData) => setData(cloneQueryData(next)), []);

  const updateMessageData = useCallback((updates: Partial<QueryDataMessageData>) => {
    setD({ ...data, messages: data.messages.map((m, i) => i === selectedMessageIndex ? { ...m, data: { ...m.data, ...updates } } : m) });
  }, [data, selectedMessageIndex, setD]);

  const addMessage = useCallback((isComponentsV2Msg?: boolean) => {
    const flags = isComponentsV2Msg ? (1 << 15) : undefined;
    const msg = createMessage(flags);
    const next = [...data.messages, msg];
    setD({ ...data, messages: next });
    setSelectedMessageIndex(next.length - 1);
    setAddMsgOpen(false);
  }, [data, setD]);

  const duplicateMessage = useCallback((idx: number) => {
    const msg = JSON.parse(JSON.stringify(data.messages[idx]));
    msg._id = randomId();
    const next = [...data.messages];
    next.splice(idx + 1, 0, msg);
    setD({ ...data, messages: next });
  }, [data, setD]);

  const removeMessage = useCallback((idx: number) => {
    let next = data.messages.filter((_, i) => i !== idx);
    if (next.length === 0) next = [{ _id: randomId(), data: {} }];
    const newIdx = Math.min(selectedMessageIndex, next.length - 1);
    setSelectedMessageIndex(idx === selectedMessageIndex ? newIdx : (selectedMessageIndex > idx ? selectedMessageIndex - 1 : selectedMessageIndex));
    setD({ ...data, messages: next });
  }, [data, selectedMessageIndex, setD]);

  const moveMessage = useCallback((idx: number, dir: "up" | "down") => {
    const t = dir === "up" ? idx - 1 : idx + 1;
    if (t < 0 || t >= data.messages.length) return;
    const next = [...data.messages];
    [next[idx], next[t]] = [next[t], next[idx]];
    setD({ ...data, messages: next });
    setSelectedMessageIndex(t);
  }, [data, setD]);

  const addEmbed = useCallback(() => {
    const embeds = [...(data.messages[selectedMessageIndex]?.data.embeds || [])];
    if (embeds.length >= 10) return;
    embeds.push({});
    updateMessageData({ embeds });
  }, [data, selectedMessageIndex, updateMessageData]);

  const removeEmbed = useCallback((ei: number) => {
    const embeds = data.messages[selectedMessageIndex]?.data.embeds?.filter((_, i) => i !== ei) || [];
    updateMessageData({ embeds: embeds.length > 0 ? embeds : undefined });
  }, [data, selectedMessageIndex, updateMessageData]);

  const updateEmbed = useCallback((ei: number, updates: Partial<APIEmbed>) => {
    const embeds = [...(data.messages[selectedMessageIndex]?.data.embeds || [])];
    if (!embeds[ei]) return;
    embeds[ei] = { ...embeds[ei], ...updates };
    updateMessageData({ embeds });
  }, [data, selectedMessageIndex, updateMessageData]);

  // Webhook target management
  const [webhookUrl, setWebhookUrl] = useState("");
  const addTarget = useCallback(() => {
    if (!webhookUrl) return;
    const targets = [...(data.targets || [])];
    targets.push({ type: TargetType.Webhook, url: webhookUrl });
    setD({ ...data, targets });
    setWebhookUrl("");
  }, [data, webhookUrl, setD]);
  const removeTarget = useCallback((ti: number) => {
    setD({ ...data, targets: data.targets?.filter((_, i) => i !== ti) });
  }, [data, setD]);

  // Channel selection
  const toggleChannel = useCallback((channelId: string) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  }, []);

  const selectAllChannels = useCallback(() => {
    setSelectedChannelIds(new Set(channels.map((c) => c.id)));
  }, [channels]);

  const deselectAllChannels = useCallback(() => {
    setSelectedChannelIds(new Set());
  }, []);

  // Preset management
  const savePreset = useCallback(async (kind: "draft" | "template") => {
    const name = presetName.trim().slice(0, 80);
    if (!name) { setStatus({ state: "error", text: "Enter a name before saving." }); return; }
    const existingIdx = presets.findIndex((p) => p.kind === kind && p.name.toLowerCase() === name.toLowerCase());
    const next = [...presets];
    const preset = { id: existingIdx >= 0 ? next[existingIdx].id : `preset-${Date.now()}-${randomId()}`, name, kind, data: cloneQueryData(data) };
    if (existingIdx >= 0) next[existingIdx] = preset;
    else next.unshift(preset);
    setPresets(next);
    try {
      const communityModule = modules.find((m) => m.name === "community");
      await fetch(`/api/modules/${guildId}/community`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: communityModule?.enabled ?? true,
          config: { ...(communityModule?.config ?? {}), announcements_studio: { ...(communityModule?.config?.announcements_studio ?? {}), dashboardPresets: next.map((p) => ({ id: p.id, name: p.name, kind: p.kind, data: p.data })) } },
        }),
      });
      setStatus({ state: "success", text: `${kind === "template" ? "Template" : "Draft"} saved.` });
    } catch { setStatus({ state: "error", text: "Failed to save preset." }); }
  }, [presetName, presets, data, modules, guildId]);

  const loadPreset = useCallback((preset: { id: string; name: string; kind: "draft" | "template"; data: QueryData }) => {
    setData(cloneQueryData(preset.data));
    setPresetName(preset.name);
    setSelectedMessageIndex(0);
    setStatus({ state: "info", text: `Loaded ${preset.kind} "${preset.name}".` });
  }, [setData]);

  const deletePreset = useCallback(async (presetId: string) => {
    const next = presets.filter((p) => p.id !== presetId);
    setPresets(next);
    try {
      const communityModule = modules.find((m) => m.name === "community");
      await fetch(`/api/modules/${guildId}/community`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: communityModule?.enabled ?? true,
          config: { ...(communityModule?.config ?? {}), announcements_studio: { ...(communityModule?.config?.announcements_studio ?? {}), dashboardPresets: next.map((p) => ({ id: p.id, name: p.name, kind: p.kind, data: p.data })) } },
        }),
      });
      setStatus({ state: "success", text: "Preset deleted." });
    } catch { setStatus({ state: "error", text: "Failed to delete preset." }); }
  }, [presets, modules, guildId]);

  // Send
  const handleSend = useCallback(async () => {
    if (!guildId || typeof guildId !== "string") return;
    if (selectedChannelIds.size === 0) {
      setStatus({ state: "error", text: "Select at least one channel to send to." }); return;
    }
    if (!data.messages.some((m) => m.data.content || m.data.embeds?.length)) {
      setStatus({ state: "error", text: "Add content to at least one message." }); return;
    }
    setStatus({ state: "sending", text: "Sending announcement..." });
    try {
      const res = await fetch(`/api/guilds/${guildId}/announcements`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_ids: Array.from(selectedChannelIds),
          entries: data.messages.map((m) => ({
            id: m._id,
            content: m.data.content || undefined,
            embeds: m.data.embeds?.filter((e) => e.title || e.description || (e.fields && e.fields.length > 0) || e.image?.url || e.thumbnail?.url || e.footer?.text || e.author?.name),
            components: m.data.components?.map((row) => row.type === 1 ? { type: 1, components: row.components } : row),
            flags: m.data.flags,
            edit_existing: !!m.reference,
            message_link: m.reference || undefined,
            thread_name: m.data.thread_name || undefined,
            allowed_mentions: m.data.allowed_mentions || undefined,
          })),
        }),
      });
      const responseData = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(responseData?.error || "Failed to send");
      setStatus({ state: "success", text: "Announcement sent successfully!" });
    } catch (err) {
      setStatus({ state: "error", text: err instanceof Error ? err.message : "Failed to send" });
    }
  }, [guildId, data, selectedChannelIds]);

  if (loading) {
    return (
      <DashboardLayout guildId={String(guildId || "")} guildName="Guild" heading="Announcements" modules={[]}>
        <BoneyardCard lines={6} />
      </DashboardLayout>
    );
  }

  const msg = message?.data;

  return (
    <DashboardLayout guildId={String(guildId || "")} guildName={guild?.name || "Guild"} heading="Announcements" modules={modules}>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Megaphone className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Announcements Studio</h1>
          <p className="text-muted-foreground">Compose rich messages with embeds, components, and webhook targets.</p>
        </div>
      </div>

      <StatusBanner status={status} />

      {/* Component Edit Modal */}
      <ComponentEditModal open={componentModalOpen} onClose={() => setComponentModalOpen(false)}
        component={editingComponent}
        onChange={(comp) => {
          const components = [...(msg?.components || [])];
          for (const row of components) {
            if (row.type === 1) {
              const idx = row.components.findIndex((c) => c.custom_id && c.custom_id === (comp as any).custom_id);
              if (idx >= 0) { row.components[idx] = comp; break; }
            }
          }
          updateMessageData({ components });
        }}
        serverEmojis={serverEmojis} />

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* ── Editor Panel ── */}
        <div className="dashboard-panel rounded-2xl p-5 space-y-6">

          {/* Messages Section */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Messages ({data.messages.length})</h2>
              <div className="relative">
                <button type="button" onClick={() => setAddMsgOpen(!addMsgOpen)}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20">
                  <Plus className="h-3 w-3" /> Add
                  <ChevronDown className="h-3 w-3" />
                </button>
                {addMsgOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
                    <button type="button" onClick={() => addMessage(false)} className="flex w-full items-center gap-2 rounded-t-lg px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800">
                      <MessageSquare className="h-3.5 w-3.5" /> Standard Message
                    </button>
                    <button type="button" onClick={() => addMessage(true)} className="flex w-full items-center gap-2 rounded-b-lg px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800">
                      <Layers className="h-3.5 w-3.5" /> Components V2 Message
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1">
              {data.messages.map((m, i) => (
                <div key={m._id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  selectedMessageIndex === i ? "border-primary/40 bg-primary/5" : "border-border/60 bg-background/50 hover:bg-background/80"
                }`}>
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => moveMessage(i, "up")} disabled={i === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                    <button type="button" onClick={() => moveMessage(i, "down")} disabled={i === data.messages.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
                  </div>
                  <button type="button" onClick={() => setSelectedMessageIndex(i)} className="min-w-0 flex-1 text-left truncate text-foreground/80">
                    {isComponentsV2(m.data.flags) && <span className="mr-1 rounded bg-zinc-700 px-1 py-0.5 text-[9px] text-zinc-400">V2</span>}
                    {getMessageDisplayName(undefined, i, m)}
                  </button>
                  <button type="button" onClick={() => duplicateMessage(i)} title="Duplicate" className="text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => removeMessage(i)} title="Remove" className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </section>

          {/* Active Message Editor */}
          {message && (
            <section>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                Edit Message
                {isV2 && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Components V2</span>}
              </h2>

              {/* Limit warnings */}
              {(() => {
                const ws = getMessageLimitWarnings(message.data);
                if (!ws.length) return null;
                return (
                  <div className="mb-3 space-y-1">
                    {ws.map((w, i) => (
                      <div key={i} className="flex items-start gap-1.5 rounded-lg border border-red-700/40 bg-red-500/10 px-3 py-2 text-[10px] text-red-300">
                        <span className="mt-0.5 shrink-0">⚠</span>
                        <span>{w}</span>
                      </div>
                    ))}
                    {ws.length >= 2 && (
                      <div className="rounded-lg border border-amber-700/40 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-300">
                        <strong>Consider splitting into multiple messages.</strong> Use the +Add button to create additional messages.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Flags */}
              <div className="mb-3 flex flex-wrap gap-2">
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                  <input type="checkbox" checked={hasFlag(message.data.flags, 4)}
                    onChange={(e) => {
                      let f = message.data.flags || 0;
                      f = e.target.checked ? f | 4 : f & ~4;
                      updateMessageData({ flags: f || undefined });
                    }}
                    className="h-3 w-3 rounded border-zinc-700 bg-zinc-800" />
                  Suppress Embeds
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                  <input type="checkbox" checked={hasFlag(message.data.flags, 4096)}
                    onChange={(e) => {
                      let f = message.data.flags || 0;
                      f = e.target.checked ? f | 4096 : f & ~4096;
                      updateMessageData({ flags: f || undefined });
                    }}
                    className="h-3 w-3 rounded border-zinc-700 bg-zinc-800" />
                  Suppress Notifications
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                  <input type="checkbox" checked={!!message.data.allowed_mentions}
                    onChange={(e) => updateMessageData({ allowed_mentions: e.target.checked ? { parse: ["users", "roles"] } : undefined })}
                    className="h-3 w-3 rounded border-zinc-700 bg-zinc-800" />
                  Allowed Mentions
                </label>
              </div>

              {/* Tabs */}
              <div className="mb-3 flex gap-1 rounded-lg border border-border/60 bg-background/40 p-1">
                {(["content", "embed", "components"] as const).map((tab) => (
                  <button key={tab} type="button" onClick={() => setEditTab(tab)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      editTab === tab ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    {tab === "content" ? "Content" : tab === "embed" ? `Embeds (${msg?.embeds?.length || 0})` : "Components"}
                  </button>
                ))}
              </div>

              {editTab === "content" && (
                <div className="space-y-3">
                  <Textarea value={msg?.content || ""} onChange={(e) => updateMessageData({ content: e.target.value || undefined })}
                    placeholder="Type your announcement message here..." rows={5} maxLength={2000}
                    className="w-full border-border/60 bg-background/50 text-foreground placeholder:text-muted-foreground resize-none" />
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Message Name</Label>
                    <input type="text" value={message.name || ""} onChange={(e) => {
                      const next = [...data.messages];
                      next[selectedMessageIndex] = { ...next[selectedMessageIndex], name: e.target.value || undefined };
                      setD({ ...data, messages: next });
                    }} placeholder="Optional message name" maxLength={50}
                      className="flex-1 rounded border border-border/60 bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Thread Name</Label>
                    <input type="text" value={message.data.thread_name || ""} onChange={(e) => updateMessageData({ thread_name: e.target.value || undefined })}
                      placeholder="Optional forum thread name" maxLength={100}
                      className="flex-1 rounded border border-border/60 bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Edit Reference</Label>
                    <input type="text" value={message.reference || ""} onChange={(e) => {
                      const next = [...data.messages];
                      next[selectedMessageIndex] = { ...next[selectedMessageIndex], reference: e.target.value || undefined };
                      setD({ ...data, messages: next });
                    }} placeholder="https://discord.com/channels/..."
                      className="flex-1 rounded border border-border/60 bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none" />
                  </div>
                </div>
              )}

              {editTab === "embed" && (
                <div className="space-y-3">
                  {(msg?.embeds || []).map((embed, ei) => (
                    <div key={ei} className="rounded-xl border border-zinc-800 bg-black/40 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-medium text-zinc-500">Embed {ei + 1}</span>
                        <button type="button" onClick={() => removeEmbed(ei)} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
                      </div>
                      <EmbedEditor embed={embed} onChange={(e) => updateEmbed(ei, e)} />
                    </div>
                  ))}
                  <button type="button" onClick={addEmbed} disabled={(msg?.embeds?.length || 0) >= 10}
                    className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 py-2 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 disabled:opacity-40">
                    <Plus className="h-3 w-3" /> Add Embed
                  </button>
                </div>
              )}

              {editTab === "components" && (
                <ComponentEditorForMessage
                  components={msg?.components || []}
                  onChange={(components) => updateMessageData({ components })}
                  onEditComponent={(comp) => { setEditingComponent(comp); setComponentModalOpen(true); }}
                  serverEmojis={serverEmojis}
                  isV2={isV2} />
              )}
            </section>
          )}
        </div>

        {/* ── Preview + Controls ── */}
        <div className="space-y-4">
          {/* Preview */}
          <div className="dashboard-panel rounded-2xl p-5">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Preview</h2>
            {msg ? (
              <DiscordPreview message={msg} isV2={isV2} targets={data.targets} onEditComponent={(comp) => { setEditingComponent(comp); setComponentModalOpen(true); }} />
            ) : (
              <div className="flex items-center justify-center rounded-lg bg-background/50 py-12 text-sm text-muted-foreground">No message selected</div>
            )}
          </div>

          {/* Webhook Targets */}
          <div className="dashboard-panel rounded-2xl p-5">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              <Webhook className="mr-1 inline h-3.5 w-3.5" /> Targets ({data.targets?.length || 0})
            </h2>
            <div className="flex gap-2">
              <input type="text" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="Webhook URL or Bot channel..."
                className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
              <button type="button" onClick={addTarget}
                className="rounded-lg px-3 py-2 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20">
                <Plus className="h-3 w-3" />
              </button>
            </div>
            {data.targets && data.targets.length > 0 && (
              <div className="mt-2 space-y-1">
                {data.targets.map((t, ti) => (
                  <div key={ti} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-xs">
                    <Bot className="h-3.5 w-3.5 text-zinc-500" />
                    <span className="min-w-0 flex-1 truncate text-foreground/70">
                      {t.type === TargetType.Webhook ? t.url || "Webhook" : `Bot: ${t.channel_id}`}
                    </span>
                    <button type="button" onClick={() => removeTarget(ti)} className="text-muted-foreground hover:text-red-400"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-[10px] text-muted-foreground">Add a webhook URL to send as a webhook instead of the bot.</p>
          </div>

          {/* Channels */}
          <div className="dashboard-panel rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <Hash className="mr-1 inline h-3.5 w-3.5" /> Channels ({selectedChannelIds.size})
              </h2>
              <div className="flex gap-1">
                <button type="button" onClick={selectAllChannels}
                  className="text-[9px] uppercase text-muted-foreground hover:text-foreground">All</button>
                <button type="button" onClick={deselectAllChannels}
                  className="text-[9px] uppercase text-muted-foreground hover:text-foreground">None</button>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-border/60 bg-background/30 p-2">
              {channels.length === 0 ? (
                <div className="text-xs text-muted-foreground">No text channels available.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {channels.map((ch) => {
                    const sel = selectedChannelIds.has(ch.id);
                    return (
                      <button key={ch.id} type="button" title={`#${ch.name}`}
                        onClick={() => toggleChannel(ch.id)}
                        className={`rounded border px-2 py-1 text-[10px] font-medium transition-colors ${
                          sel
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/60 text-muted-foreground hover:border-zinc-600 hover:text-foreground"
                        }`}>
                        {sel && <Check className="mr-0.5 inline h-2.5 w-2.5" />}
                        # {ch.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">Select channels to send this announcement to.</p>
          </div>

          {/* Presets */}
          <div className="dashboard-panel rounded-2xl p-5">
            <button type="button" onClick={() => setPresetsOpen(!presetsOpen)}
              className="flex w-full items-center justify-between">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <Save className="mr-1 inline h-3.5 w-3.5" /> Presets ({presets.length})
              </h2>
              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${presetsOpen ? "rotate-180" : ""}`} />
            </button>
            {presetsOpen && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <input type="text" value={presetName} onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset name..." maxLength={80}
                    className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none" />
                  <button type="button" onClick={() => savePreset("draft")}
                    className="rounded-lg px-2 py-1 text-[10px] font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20">Draft</button>
                  <button type="button" onClick={() => savePreset("template")}
                    className="rounded-lg px-2 py-1 text-[10px] font-medium bg-violet-500/10 text-violet-400 hover:bg-violet-500/20">Template</button>
                </div>
                {presets.length > 0 && (
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {presets.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-xs">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <button type="button" onClick={() => loadPreset(p)}
                          className="min-w-0 flex-1 truncate text-left text-foreground/70 hover:text-foreground">
                          {p.name}
                        </button>
                        <span className={`shrink-0 text-[9px] uppercase ${p.kind === "template" ? "text-violet-400" : "text-amber-400"}`}>{p.kind === "template" ? "T" : "D"}</span>
                        <button type="button" onClick={() => deletePreset(p.id)} className="text-muted-foreground hover:text-red-400"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Send */}
          <div className="dashboard-panel rounded-2xl p-5">
            <button type="button" onClick={handleSend} disabled={status?.state === "sending"}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}>
              {status?.state === "sending" ? <>Sending...</> : <><Send className="h-4 w-4" /> Send</>}
            </button>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              {data.messages.length} message{data.messages.length !== 1 ? "s" : ""}
              {data.targets?.length ? ` · ${data.targets.length} target${data.targets.length !== 1 ? "s" : ""}` : ""}
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
