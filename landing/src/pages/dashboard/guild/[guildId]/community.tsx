import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { BoneyardCard } from "@/components/ui/boneyard-skeleton";
import { FeatureCard } from "@/components/feature-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Palette, Users, LogIn, LogOut, Zap, Lock, Star, Shield, Save, RefreshCcw, X, ChevronDown, ImageIcon, Bot, Eye, Megaphone, Plus, Copy, GripVertical } from "lucide-react";

type ModuleRow = {
  name: string;
  display_name?: string;
  description?: string;
  category?: string;
  enabled?: boolean;
  config?: Record<string, any>;
};

type GuildPayload = {
  guild: Record<string, any>;
  modules: ModuleRow[];
};

type GuildRole = {
  id: string;
  name: string;
  color: number;
  managed: boolean;
  editable: boolean;
  position: number;
};

type GuildChannel = {
  id: string;
  name: string;
  type: number;
};

type GuildMember = {
  id: string;
  username: string;
  display_name: string;
};

type GuildEmoji = {
  id: string;
  name: string;
  animated: boolean;
  mention: string;
  url: string;
};

type RoleColorConfig = {
  enabled: boolean;
  interval_value: number;
  interval_unit: "seconds" | "minutes" | "hours";
  role_ids: string[];
};

type MemeAutopostConfig = {
  enabled: boolean;
  interval_value: number;
  interval_unit: "seconds" | "minutes" | "hours";
  channel_id: string;
  ping_role_id: string;
  subreddits: string[];
};

type BotLooksConfig = {
  enabled: boolean;
  status: "online" | "idle" | "dnd" | "invisible";
  activity_type: "playing" | "streaming" | "listening" | "watching" | "competing" | "custom";
  activity_text: string;
  custom_status: string;
  streaming_url: string;
};

type DmWelcomerConfig = {
  enabled: boolean;
  title: string;
  message: string;
  image_url: string;
};

type PremiumFeatureTrigger = {
  id: string;
  trigger: string;
  response_links: string[];
  footer_text: string;
  delete_trigger_message: boolean;
  use_main_roles: boolean;
  role_ids: string[];
};

type PremiumFeatureConfig = {
  enabled: boolean;
  cooldown_seconds: number;
  webhook_enabled: boolean;
  webhook_url: string;
  role_ids: string[];
  triggers: PremiumFeatureTrigger[];
};

type DmBroadcastBlock = {
  type: "text" | "image" | "separator";
  content: string;
};

type DmBroadcastPlainMessage = {
  id: string;
  content: string;
};

type DmBroadcastForm = {
  target_mode: "member" | "everyone";
  member_id: string;
  plain_messages: DmBroadcastPlainMessage[];
  container_blocks: DmBroadcastBlock[];
  delay_seconds: number;
};

type DmBroadcastJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  requested: number;
  processed: number;
  sent: number;
  failed: number;
  error?: string | null;
};

type AnnouncementBlock = {
  type: "text" | "image" | "separator";
  content: string;
};

type AnnouncementEntry = {
  id: string;
  type: "normal" | "embed" | "container";
  edit_existing: boolean;
  message_link: string;
  content: string;
  embed: {
    title: string;
    description: string;
    footer_text: string;
    image_url: string;
    color: string;
  };
  container_blocks: AnnouncementBlock[];
};

type AnnouncementForm = {
  channel_ids: string[];
  entries: AnnouncementEntry[];
};

type AnnouncementPreset = {
  id: string;
  name: string;
  kind: "draft" | "template";
  form: AnnouncementForm;
};

type AnnouncementEmojiTarget =
  | { kind: "normal"; entryId: string }
  | { kind: "embedTitle"; entryId: string }
  | { kind: "embedDescription"; entryId: string }
  | { kind: "embedFooter"; entryId: string }
  | { kind: "containerText"; entryId: string; blockIndex: number };

const DEFAULT_ROLE_COLOR_CONFIG: RoleColorConfig = {
  enabled: false,
  interval_value: 1,
  interval_unit: "minutes",
  role_ids: [],
};

const DEFAULT_MEME_AUTPOST_CONFIG: MemeAutopostConfig = {
  enabled: false,
  interval_value: 30,
  interval_unit: "minutes",
  channel_id: "",
  ping_role_id: "",
  subreddits: [],
};

const DEFAULT_BOT_LOOKS_CONFIG: BotLooksConfig = {
  enabled: false,
  status: "online",
  activity_type: "custom",
  activity_text: "",
  custom_status: "",
  streaming_url: "",
};

const DEFAULT_DM_WELCOMER_CONFIG: DmWelcomerConfig = {
  enabled: false,
  title: "Welcome to {server_name}",
  message: "Hey {username}, welcome to {server_name}. We are glad to have you here.",
  image_url: "",
};

const DEFAULT_PREMIUM_FEATURE_CONFIG: PremiumFeatureConfig = {
  enabled: false,
  cooldown_seconds: 0,
  webhook_enabled: false,
  webhook_url: "",
  role_ids: [],
  triggers: [],
};

const DEFAULT_DM_BROADCAST_FORM: DmBroadcastForm = {
  target_mode: "member",
  member_id: "",
  plain_messages: [
    {
      id: "dm-message-1",
      content: "Hey {username}, this is a DM from {server_name}.",
    },
  ],
  container_blocks: [
    { type: "text", content: "Add your container text here." },
  ],
  delay_seconds: 1.2,
};

const DEFAULT_ANNOUNCEMENT_FORM: AnnouncementForm = {
  channel_ids: [],
  entries: [
    {
      id: "announcement-entry-1",
      type: "normal",
      edit_existing: false,
      message_link: "",
      content: "",
      embed: {
        title: "",
        description: "",
        footer_text: "",
        image_url: "",
        color: "#57f287",
      },
      container_blocks: [
        { type: "text", content: "" },
      ],
    },
  ],
};

const DEFAULT_ANNOUNCEMENT_PRESETS: AnnouncementPreset[] = [];

const MIN_ROLE_SECONDS_INTERVAL = 10;
const MIN_MEME_SECONDS_INTERVAL = 30;

function clampRoleIntervalValue(value: number, unit: RoleColorConfig["interval_unit"]) {
  const normalized = Math.max(1, value || 1);
  if (unit === "seconds") {
    return Math.max(MIN_ROLE_SECONDS_INTERVAL, normalized);
  }
  return normalized;
}

function normalizeRoleColorConfig(config: Record<string, any> | null | undefined): RoleColorConfig {
  const intervalUnit =
    config?.interval_unit === "seconds" || config?.interval_unit === "hours"
      ? config.interval_unit
      : "minutes";

  return {
    enabled: Boolean(config?.enabled),
    interval_value: clampRoleIntervalValue(Number.parseInt(String(config?.interval_value ?? 1), 10) || 1, intervalUnit),
    interval_unit: intervalUnit,
    role_ids: Array.isArray(config?.role_ids) ? config.role_ids.map((roleId: unknown) => String(roleId)) : [],
  };
}

function sanitizeSubreddits(value: string | string[]) {
  const items = Array.isArray(value) ? value : value.split(/[\n,]/g);
  return Array.from(
    new Set(
      items
        .map((item) => String(item ?? "").trim().replace(/^r\//i, ""))
        .map((item) => item.replace(/[^a-zA-Z0-9_]/g, ""))
        .filter(Boolean)
    )
  );
}

function clampMemeIntervalValue(value: number, unit: MemeAutopostConfig["interval_unit"]) {
  const normalized = Math.max(1, value || 1);
  if (unit === "seconds") {
    return Math.max(MIN_MEME_SECONDS_INTERVAL, normalized);
  }
  return normalized;
}

function normalizeMemeAutopostConfig(config: Record<string, any> | null | undefined): MemeAutopostConfig {
  const intervalUnit =
    config?.interval_unit === "seconds" || config?.interval_unit === "hours"
      ? config.interval_unit
      : "minutes";

  return {
    enabled: Boolean(config?.enabled),
    interval_value: clampMemeIntervalValue(Number.parseInt(String(config?.interval_value ?? 30), 10) || 30, intervalUnit),
    interval_unit: intervalUnit,
    channel_id: String(config?.channel_id ?? ""),
    ping_role_id: String(config?.ping_role_id ?? ""),
    subreddits: sanitizeSubreddits(Array.isArray(config?.subreddits) ? config.subreddits : []),
  };
}

function normalizeBotLooksConfig(config: Record<string, any> | null | undefined): BotLooksConfig {
  const status =
    config?.status === "idle" || config?.status === "dnd" || config?.status === "invisible"
      ? config.status
      : "online";

  const activityType =
    config?.activity_type === "playing" ||
    config?.activity_type === "streaming" ||
    config?.activity_type === "listening" ||
    config?.activity_type === "watching" ||
    config?.activity_type === "competing"
      ? config.activity_type
      : "custom";

  return {
    enabled: Boolean(config?.enabled),
    status,
    activity_type: activityType,
    activity_text: String(config?.activity_text ?? "").trim().slice(0, 128),
    custom_status: String(config?.custom_status ?? "").trim().slice(0, 128),
    streaming_url: String(config?.streaming_url ?? "").trim().slice(0, 256),
  };
}

function normalizeDmWelcomerConfig(config: Record<string, any> | null | undefined): DmWelcomerConfig {
  return {
    enabled: Boolean(config?.enabled),
    title: String(config?.title ?? DEFAULT_DM_WELCOMER_CONFIG.title).trim().slice(0, 120) || DEFAULT_DM_WELCOMER_CONFIG.title,
    message: String(config?.message ?? DEFAULT_DM_WELCOMER_CONFIG.message).trim().slice(0, 1200) || DEFAULT_DM_WELCOMER_CONFIG.message,
    image_url: String(config?.image_url ?? "").trim().slice(0, 300),
  };
}

function normalizeAnnouncementEntry(entry: Record<string, any> | null | undefined, index: number): AnnouncementEntry {
  const type =
    entry?.type === "embed" || entry?.type === "container"
      ? entry.type
      : "normal";

  const containerBlocks = Array.isArray(entry?.container_blocks)
    ? entry.container_blocks
      .map((block: Record<string, any>) => ({
        type: block?.type === "image" || block?.type === "separator" ? block.type : "text",
        content: String(block?.content ?? "").slice(0, 2000),
      }))
      .filter((block: AnnouncementBlock) => block.type === "separator" || block.content)
    : [{ type: "text", content: "" }];

  return {
    id: typeof entry?.id === "string" && entry.id ? entry.id : `announcement-entry-${index + 1}`,
    type,
    edit_existing: Boolean(entry?.edit_existing),
    message_link: String(entry?.message_link ?? "").slice(0, 500),
    content: String(entry?.content ?? "").slice(0, 2000),
    embed: {
      title: String(entry?.embed?.title ?? "").slice(0, 256),
      description: String(entry?.embed?.description ?? "").slice(0, 4000),
      footer_text: String(entry?.embed?.footer_text ?? "").slice(0, 2048),
      image_url: String(entry?.embed?.image_url ?? "").slice(0, 1000),
      color: String(entry?.embed?.color ?? "#57f287").slice(0, 7),
    },
    container_blocks: containerBlocks.length > 0 ? containerBlocks : [{ type: "text", content: "" }],
  };
}

function normalizeAnnouncementForm(config: Record<string, any> | null | undefined): AnnouncementForm {
  const entries = Array.isArray(config?.entries)
    ? config.entries.map((entry: Record<string, any>, index: number) => normalizeAnnouncementEntry(entry, index))
    : DEFAULT_ANNOUNCEMENT_FORM.entries.map((entry, index) => normalizeAnnouncementEntry(entry, index));

  return {
    channel_ids: Array.isArray(config?.channel_ids)
      ? Array.from(new Set(config.channel_ids.map((entry: unknown) => String(entry ?? "").trim()).filter(Boolean)))
      : [],
    entries,
  };
}

function cloneAnnouncementForm(form: AnnouncementForm): AnnouncementForm {
  return normalizeAnnouncementForm({
    channel_ids: form.channel_ids,
    entries: form.entries,
  });
}

function normalizeAnnouncementPresets(config: Record<string, any> | null | undefined): AnnouncementPreset[] {
  if (!Array.isArray(config?.presets)) {
    return DEFAULT_ANNOUNCEMENT_PRESETS;
  }

  return config.presets
    .map((preset: Record<string, any>, index: number) => ({
      id: typeof preset?.id === "string" && preset.id ? preset.id : `announcement-preset-${index + 1}`,
      name: String(preset?.name ?? "").trim().slice(0, 80),
      kind: (preset?.kind === "template" ? "template" : "draft") as AnnouncementPreset["kind"],
      form: normalizeAnnouncementForm(preset?.form),
    }))
    .filter((preset: AnnouncementPreset) => Boolean(preset.name));
}

function sanitizePremiumLinks(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter((entry) => /^https?:\/\//i.test(entry))
    )
  );
}

function normalizePremiumFeatureConfig(config: Record<string, any> | null | undefined): PremiumFeatureConfig {
  const triggers = Array.isArray(config?.triggers)
    ? config.triggers
        .map((trigger: Record<string, any>, index: number) => ({
          id: typeof trigger?.id === "string" && trigger.id ? trigger.id : `premium-trigger-${index + 1}`,
          trigger: String(trigger?.trigger ?? "").trim().slice(0, 100),
          response_links: Array.isArray(trigger?.response_links)
            ? Array.from(
                new Set(
                  trigger.response_links
                    .map((entry: unknown) => String(entry ?? "").trim())
                    .filter((entry: string) => /^https?:\/\//i.test(entry))
                )
              )
            : [],
          footer_text: String(trigger?.footer_text ?? "").trim().slice(0, 500),
          delete_trigger_message: Boolean(trigger?.delete_trigger_message),
          use_main_roles: trigger?.use_main_roles !== false,
          role_ids: Array.isArray(trigger?.role_ids)
            ? Array.from(new Set(trigger.role_ids.map((entry: unknown) => String(entry ?? "").trim()).filter(Boolean)))
            : [],
        }))
        .filter((trigger: PremiumFeatureTrigger) => trigger.trigger || trigger.response_links.length > 0 || trigger.footer_text)
    : [];

  return {
    enabled: Boolean(config?.enabled),
    cooldown_seconds: Math.max(0, Number.parseInt(String(config?.cooldown_seconds ?? 0), 10) || 0),
    webhook_enabled:
      Boolean(config?.webhook_enabled) &&
      /^https:\/\/discord(?:app)?\.com\/api\/webhooks\//i.test(String(config?.webhook_url ?? "").trim()),
    webhook_url: String(config?.webhook_url ?? "").trim().slice(0, 500),
    role_ids: Array.isArray(config?.role_ids)
      ? Array.from(new Set(config.role_ids.map((entry: unknown) => String(entry ?? "").trim()).filter(Boolean)))
      : [],
    triggers,
  };
}

function scrollDialogSection(sectionId: string) {
  if (typeof window === "undefined") return;
  const target = document.getElementById(sectionId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

type SaveState = "idle" | "success" | "error" | "info";

export default function CommunityPage() {
  const router = useRouter();
  const { guildId } = router.query;

  const [payload, setPayload] = useState<GuildPayload | null>(null);
  const [roles, setRoles] = useState<GuildRole[]>([]);
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [emojis, setEmojis] = useState<GuildEmoji[]>([]);
  const [loading, setLoading] = useState(true);

  const [roleColorOpen, setRoleColorOpen] = useState(false);
  const [memeOpen, setMemeOpen] = useState(false);
  const [botLooksOpen, setBotLooksOpen] = useState(false);
  const [dmWelcomerOpen, setDmWelcomerOpen] = useState(false);
  const [dmAllOpen, setDmAllOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [premiumFeatureOpen, setPremiumFeatureOpen] = useState(false);

  const [roleQuery, setRoleQuery] = useState("");
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [premiumRoleQuery, setPremiumRoleQuery] = useState("");
  const [premiumRolePickerOpen, setPremiumRolePickerOpen] = useState(false);
  const [announcementChannelQuery, setAnnouncementChannelQuery] = useState("");
  const [announcementChannelPickerOpen, setAnnouncementChannelPickerOpen] = useState(false);
  const [roleLoadMessage, setRoleLoadMessage] = useState("");
  const [channelLoadMessage, setChannelLoadMessage] = useState("");
  const [memberLoadMessage, setMemberLoadMessage] = useState("");
  const [emojiLoadMessage, setEmojiLoadMessage] = useState("");

  const [roleColorSaving, setRoleColorSaving] = useState(false);
  const [roleColorReloading, setRoleColorReloading] = useState(false);
  const [roleColorSaveMessage, setRoleColorSaveMessage] = useState("");
  const [roleColorSaveState, setRoleColorSaveState] = useState<SaveState>("idle");
  const [roleColorForm, setRoleColorForm] = useState<RoleColorConfig>(DEFAULT_ROLE_COLOR_CONFIG);

  const [memeSaving, setMemeSaving] = useState(false);
  const [memeReloading, setMemeReloading] = useState(false);
  const [memeSaveMessage, setMemeSaveMessage] = useState("");
  const [memeSaveState, setMemeSaveState] = useState<SaveState>("idle");
  const [memeForm, setMemeForm] = useState<MemeAutopostConfig>(DEFAULT_MEME_AUTPOST_CONFIG);
  const [subredditDraft, setSubredditDraft] = useState("");

  const [botLooksSaving, setBotLooksSaving] = useState(false);
  const [botLooksReloading, setBotLooksReloading] = useState(false);
  const [botLooksResetting, setBotLooksResetting] = useState(false);
  const [botLooksSaveMessage, setBotLooksSaveMessage] = useState("");
  const [botLooksSaveState, setBotLooksSaveState] = useState<SaveState>("idle");
  const [botLooksForm, setBotLooksForm] = useState<BotLooksConfig>(DEFAULT_BOT_LOOKS_CONFIG);
  const [dmWelcomerSaving, setDmWelcomerSaving] = useState(false);
  const [dmWelcomerReloading, setDmWelcomerReloading] = useState(false);
  const [dmWelcomerSaveMessage, setDmWelcomerSaveMessage] = useState("");
  const [dmWelcomerSaveState, setDmWelcomerSaveState] = useState<SaveState>("idle");
  const [dmWelcomerForm, setDmWelcomerForm] = useState<DmWelcomerConfig>(DEFAULT_DM_WELCOMER_CONFIG);
  const [memberQuery, setMemberQuery] = useState("");
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [dmBroadcastSending, setDmBroadcastSending] = useState(false);
  const [dmBroadcastMessage, setDmBroadcastMessage] = useState("");
  const [dmBroadcastState, setDmBroadcastState] = useState<SaveState>("idle");
  const [dmBroadcastForm, setDmBroadcastForm] = useState<DmBroadcastForm>(DEFAULT_DM_BROADCAST_FORM);
  const [dmBroadcastJobId, setDmBroadcastJobId] = useState("");
  const [announcementSending, setAnnouncementSending] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementState, setAnnouncementState] = useState<SaveState>("idle");
  const [announcementForm, setAnnouncementForm] = useState<AnnouncementForm>(DEFAULT_ANNOUNCEMENT_FORM);
  const [announcementPresetName, setAnnouncementPresetName] = useState("");
  const [announcementPresets, setAnnouncementPresets] = useState<AnnouncementPreset[]>(DEFAULT_ANNOUNCEMENT_PRESETS);
  const [announcementPresetMessage, setAnnouncementPresetMessage] = useState("");
  const [announcementPresetState, setAnnouncementPresetState] = useState<SaveState>("idle");
  const [announcementEmojiTarget, setAnnouncementEmojiTarget] = useState<AnnouncementEmojiTarget | null>(null);
  const [announcementDragEntryId, setAnnouncementDragEntryId] = useState("");
  const [premiumFeatureSaving, setPremiumFeatureSaving] = useState(false);
  const [premiumFeatureReloading, setPremiumFeatureReloading] = useState(false);
  const [premiumFeatureSaveMessage, setPremiumFeatureSaveMessage] = useState("");
  const [premiumFeatureSaveState, setPremiumFeatureSaveState] = useState<SaveState>("idle");
  const [premiumFeatureForm, setPremiumFeatureForm] = useState<PremiumFeatureConfig>(DEFAULT_PREMIUM_FEATURE_CONFIG);
  const [activePremiumPreviewId, setActivePremiumPreviewId] = useState("");
  const [expandedPremiumTriggerIds, setExpandedPremiumTriggerIds] = useState<string[]>([]);
  const [premiumTriggerRolePickerId, setPremiumTriggerRolePickerId] = useState("");
  const [premiumTriggerRoleQuery, setPremiumTriggerRoleQuery] = useState("");

  const loadGuildData = useCallback(async () => {
    if (!guildId || typeof guildId !== "string") return;

    try {
      const [overviewResponse, rolesResponse, channelsResponse, emojisResponse] = await Promise.all([
        fetch(`/api/dashboard/guild/${guildId}/overview`),
        fetch(`/api/guilds/${guildId}/roles`),
        fetch(`/api/guilds/${guildId}/channels`),
        fetch(`/api/guilds/${guildId}/emojis`),
      ]);

      if (overviewResponse.status === 401 || rolesResponse.status === 401 || channelsResponse.status === 401 || emojisResponse.status === 401) {
        router.replace("/api/auth/discord");
        return;
      }

      const overviewData = await overviewResponse.json();
      const rolesData = await rolesResponse.json().catch(() => ({ roles: [] }));
      const channelsData = await channelsResponse.json().catch(() => ({ channels: [] }));
      const emojisData = await emojisResponse.json().catch(() => ({ emojis: [] }));

      if (!overviewResponse.ok) {
        throw new Error(overviewData?.error || "Failed to load guild data");
      }

      setPayload(overviewData);
      setRoles(Array.isArray(rolesData.roles) ? rolesData.roles : []);
      setChannels(Array.isArray(channelsData.channels) ? channelsData.channels : []);
      setEmojis(Array.isArray(emojisData.emojis) ? emojisData.emojis : []);
      setRoleLoadMessage(rolesResponse.ok ? "" : rolesData?.error || "Failed to load roles from the backend.");
      setChannelLoadMessage(channelsResponse.ok ? "" : channelsData?.error || "Failed to load channels from the backend.");
      setEmojiLoadMessage(emojisResponse.ok ? "" : emojisData?.error || "Failed to load server emojis from the backend.");

      const communityModule = (overviewData.modules || []).find((module: ModuleRow) => module.name === "community");
      const nextRoleColor = normalizeRoleColorConfig(communityModule?.config?.role_color_rotation);
      const nextMemeAutopost = normalizeMemeAutopostConfig(communityModule?.config?.meme_autopost);
      const nextBotLooks = normalizeBotLooksConfig(communityModule?.config?.bot_looks);
      const nextDmWelcomer = normalizeDmWelcomerConfig(communityModule?.config?.dm_welcomer);
      const nextAnnouncementPresets = normalizeAnnouncementPresets(communityModule?.config?.announcements_studio);
      const nextPremiumFeature = normalizePremiumFeatureConfig(communityModule?.config?.premium_feature_1);

      setRoleColorForm(nextRoleColor);
      setMemeForm(nextMemeAutopost);
      setBotLooksForm(nextBotLooks);
      setDmWelcomerForm(nextDmWelcomer);
      setAnnouncementPresets(nextAnnouncementPresets);
      setPremiumFeatureForm(nextPremiumFeature);
      setActivePremiumPreviewId(nextPremiumFeature.triggers[0]?.id || "");
      setExpandedPremiumTriggerIds(nextPremiumFeature.triggers.map((trigger) => trigger.id));
      setPremiumTriggerRolePickerId("");
      setPremiumTriggerRoleQuery("");
      setSubredditDraft(nextMemeAutopost.subreddits.join(", "));
    } catch (error) {
      console.error("Failed to load guild data:", error);
    } finally {
      setLoading(false);
    }
  }, [guildId, router]);

  useEffect(() => {
    loadGuildData();
  }, [loadGuildData]);

  const loadMembers = useCallback(async () => {
    if (!guildId || typeof guildId !== "string" || !dmAllOpen || dmBroadcastForm.target_mode !== "member") return;

    try {
      const response = await fetch(`/api/guilds/${guildId}/members?q=${encodeURIComponent(memberQuery)}&limit=25`);
      if (response.status === 401) {
        router.replace("/api/auth/discord");
        return;
      }

      const data = await response.json().catch(() => ({ members: [] }));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load members");
      }

      setMembers(Array.isArray(data.members) ? data.members : []);
      setMemberLoadMessage("");
    } catch (error) {
      setMemberLoadMessage(error instanceof Error ? error.message : "Failed to load members");
    }
  }, [guildId, dmAllOpen, dmBroadcastForm.target_mode, memberQuery, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadMembers();
    }, 200);

    return () => clearTimeout(timer);
  }, [loadMembers]);

  useEffect(() => {
    if (!announcementOpen || !guildId || typeof guildId !== "string") return;

    let cancelled = false;

    async function refreshAnnouncementEmojis() {
      try {
        const response = await fetch(`/api/guilds/${guildId}/emojis`);
        const data = await response.json().catch(() => ({ emojis: [] }));
        if (!cancelled) {
          setEmojis(Array.isArray(data.emojis) ? data.emojis : []);
          setEmojiLoadMessage(response.ok ? "" : data?.error || "Failed to load server emojis from the backend.");
        }
      } catch (error) {
        if (!cancelled) {
          setEmojiLoadMessage(error instanceof Error ? error.message : "Failed to load server emojis from the backend.");
        }
      }
    }

    refreshAnnouncementEmojis();

    return () => {
      cancelled = true;
    };
  }, [announcementOpen, guildId]);

  const guild = payload?.guild || null;
  const modules = payload?.modules || [];
  const communityModule = useMemo(
    () => modules.find((module) => module.name === "community"),
    [modules]
  );

  const filteredRoles = useMemo(() => {
    const normalizedQuery = roleQuery.trim().toLowerCase();
    return roles
      .filter((role) => !normalizedQuery || role.name.toLowerCase().includes(normalizedQuery));
  }, [roleQuery, roles]);

  const filteredPremiumRoles = useMemo(() => {
    const normalizedQuery = premiumRoleQuery.trim().toLowerCase();
    return roles
      .filter((role) => !normalizedQuery || role.name.toLowerCase().includes(normalizedQuery));
  }, [premiumRoleQuery, roles]);

  const filteredPremiumTriggerRoles = useMemo(() => {
    const normalizedQuery = premiumTriggerRoleQuery.trim().toLowerCase();
    return roles
      .filter((role) => !normalizedQuery || role.name.toLowerCase().includes(normalizedQuery));
  }, [premiumTriggerRoleQuery, roles]);

  const filteredAnnouncementChannels = useMemo(() => {
    const normalizedQuery = announcementChannelQuery.trim().toLowerCase();
    return channels.filter((channel) => !normalizedQuery || channel.name.toLowerCase().includes(normalizedQuery));
  }, [announcementChannelQuery, channels]);

  const selectablePingRoles = useMemo(
    () => roles,
    [roles]
  );

  const selectedRoleColors = useMemo(() => {
    const selected = new Set(roleColorForm.role_ids);
    return roles.filter((role) => selected.has(role.id));
  }, [roleColorForm.role_ids, roles]);

  const selectedPremiumRoles = useMemo(() => {
    const selected = new Set(premiumFeatureForm.role_ids);
    return roles.filter((role) => selected.has(role.id));
  }, [premiumFeatureForm.role_ids, roles]);

  const availableRoleCount = roles.length;
  const memeSubredditPreview = useMemo(
    () => sanitizeSubreddits(subredditDraft),
    [subredditDraft]
  );
  const selectedDmMember = useMemo(
    () => members.find((member) => member.id === dmBroadcastForm.member_id) || null,
    [members, dmBroadcastForm.member_id]
  );
  const selectedAnnouncementChannels = useMemo(() => {
    const selected = new Set(announcementForm.channel_ids);
    return channels.filter((channel) => selected.has(channel.id));
  }, [announcementForm.channel_ids, channels]);
  const emojiById = useMemo(
    () => new Map(emojis.map((emoji) => [emoji.id, emoji])),
    [emojis]
  );
  const activePremiumPreview = useMemo(
    () => premiumFeatureForm.triggers.find((trigger) => trigger.id === activePremiumPreviewId) || premiumFeatureForm.triggers[0] || null,
    [activePremiumPreviewId, premiumFeatureForm.triggers]
  );

  useEffect(() => {
    if (premiumFeatureForm.triggers.length === 0) {
      if (activePremiumPreviewId) {
        setActivePremiumPreviewId("");
      }
      return;
    }

    if (!premiumFeatureForm.triggers.some((trigger) => trigger.id === activePremiumPreviewId)) {
      setActivePremiumPreviewId(premiumFeatureForm.triggers[0].id);
    }
  }, [activePremiumPreviewId, premiumFeatureForm.triggers]);

  const hasPersistedRoleColorConfig = useMemo(() => {
    const persisted = normalizeRoleColorConfig(communityModule?.config?.role_color_rotation);
    return (
      persisted.enabled ||
      persisted.role_ids.length > 0 ||
      persisted.interval_value !== DEFAULT_ROLE_COLOR_CONFIG.interval_value ||
      persisted.interval_unit !== DEFAULT_ROLE_COLOR_CONFIG.interval_unit
    );
  }, [communityModule]);

  const hasPersistedMemeConfig = useMemo(() => {
    const persisted = normalizeMemeAutopostConfig(communityModule?.config?.meme_autopost);
    return (
      persisted.enabled ||
      persisted.channel_id !== "" ||
      persisted.ping_role_id !== "" ||
      persisted.subreddits.length > 0 ||
      persisted.interval_value !== DEFAULT_MEME_AUTPOST_CONFIG.interval_value ||
      persisted.interval_unit !== DEFAULT_MEME_AUTPOST_CONFIG.interval_unit
    );
  }, [communityModule]);

  const hasPersistedBotLooksConfig = useMemo(() => {
    const persisted = normalizeBotLooksConfig(communityModule?.config?.bot_looks);
    return (
      persisted.enabled ||
      persisted.status !== DEFAULT_BOT_LOOKS_CONFIG.status ||
      persisted.activity_type !== DEFAULT_BOT_LOOKS_CONFIG.activity_type ||
      persisted.activity_text !== "" ||
      persisted.custom_status !== "" ||
      persisted.streaming_url !== ""
    );
  }, [communityModule]);

  const hasPersistedDmWelcomerConfig = useMemo(() => {
    const persisted = normalizeDmWelcomerConfig(communityModule?.config?.dm_welcomer);
    return (
      persisted.enabled ||
      persisted.title !== DEFAULT_DM_WELCOMER_CONFIG.title ||
      persisted.message !== DEFAULT_DM_WELCOMER_CONFIG.message ||
      persisted.image_url !== ""
    );
  }, [communityModule]);

  const hasPersistedPremiumFeatureConfig = useMemo(() => {
    const persisted = normalizePremiumFeatureConfig(communityModule?.config?.premium_feature_1);
    return (
      persisted.enabled ||
      persisted.cooldown_seconds !== DEFAULT_PREMIUM_FEATURE_CONFIG.cooldown_seconds ||
      persisted.webhook_enabled ||
      persisted.webhook_url !== "" ||
      persisted.role_ids.length > 0 ||
      persisted.triggers.length > 0
    );
  }, [communityModule]);

  const botLooksSummary = useMemo(() => {
    if (!botLooksForm.enabled) {
      return "Presence is currently off. Save to keep the bot on its default Discord look.";
    }

    if (botLooksForm.activity_type === "custom") {
      return botLooksForm.custom_status
        ? `${botLooksForm.status} with custom status "${botLooksForm.custom_status}".`
        : `${botLooksForm.status} with no custom status text yet.`;
    }

    return botLooksForm.activity_text
      ? `${botLooksForm.status} while ${botLooksForm.activity_type} "${botLooksForm.activity_text}".`
      : `${botLooksForm.status} with ${botLooksForm.activity_type} selected but no activity text yet.`;
  }, [botLooksForm]);

  const premiumFeatureSummary = useMemo(() => {
    if (!premiumFeatureForm.enabled) {
      return "Create role-gated trigger replies with container images, footer text, and a shared cooldown.";
    }

    return `${premiumFeatureForm.triggers.length} trigger${premiumFeatureForm.triggers.length === 1 ? "" : "s"} live for ${selectedPremiumRoles.length} selected role${selectedPremiumRoles.length === 1 ? "" : "s"} with a ${premiumFeatureForm.cooldown_seconds}s shared cooldown${premiumFeatureForm.webhook_enabled ? " via webhook delivery" : ""}.`;
  }, [premiumFeatureForm, selectedPremiumRoles.length]);

  function toggleRole(roleId: string) {
    setRoleColorForm((current) => {
      const selected = new Set(current.role_ids);
      if (selected.has(roleId)) {
        selected.delete(roleId);
      } else {
        selected.add(roleId);
      }

      return {
        ...current,
        role_ids: Array.from(selected),
      };
    });
    setRolePickerOpen(true);
  }

  function togglePremiumRole(roleId: string) {
    setPremiumFeatureForm((current) => {
      const selected = new Set(current.role_ids);
      if (selected.has(roleId)) {
        selected.delete(roleId);
      } else {
        selected.add(roleId);
      }

      return {
        ...current,
        role_ids: Array.from(selected),
      };
    });
    setPremiumRolePickerOpen(true);
  }

  function togglePremiumTriggerExpansion(triggerId: string) {
    setExpandedPremiumTriggerIds((current) =>
      current.includes(triggerId)
        ? current.filter((id) => id !== triggerId)
        : [...current, triggerId]
    );
  }

  function togglePremiumTriggerRole(triggerId: string, roleId: string) {
    setPremiumFeatureForm((current) => ({
      ...current,
      triggers: current.triggers.map((trigger) => {
        if (trigger.id !== triggerId) return trigger;

        const selected = new Set(trigger.role_ids);
        if (selected.has(roleId)) {
          selected.delete(roleId);
        } else {
          selected.add(roleId);
        }

        return {
          ...trigger,
          role_ids: Array.from(selected),
        };
      }),
    }));
    setPremiumTriggerRolePickerId(triggerId);
  }

  function createPremiumTrigger(): PremiumFeatureTrigger {
    return {
      id: `premium-trigger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      trigger: "",
      response_links: [],
      footer_text: "",
      delete_trigger_message: false,
      use_main_roles: true,
      role_ids: [],
    };
  }

  function updatePremiumTrigger(triggerId: string, updates: Partial<PremiumFeatureTrigger>) {
    setPremiumFeatureForm((current) => ({
      ...current,
      triggers: current.triggers.map((trigger) =>
        trigger.id === triggerId ? { ...trigger, ...updates } : trigger
      ),
    }));
  }

  function addPremiumTrigger() {
    const nextTrigger = createPremiumTrigger();
    setPremiumFeatureForm((current) => ({
      ...current,
      triggers: [...current.triggers, nextTrigger],
    }));
    setActivePremiumPreviewId(nextTrigger.id);
    setExpandedPremiumTriggerIds((current) => Array.from(new Set([...current, nextTrigger.id])));
  }

  function removePremiumTrigger(triggerId: string) {
    setPremiumFeatureForm((current) => ({
      ...current,
      triggers: current.triggers.filter((trigger) => trigger.id !== triggerId),
    }));
    setExpandedPremiumTriggerIds((current) => current.filter((id) => id !== triggerId));
    if (premiumTriggerRolePickerId === triggerId) {
      setPremiumTriggerRolePickerId("");
      setPremiumTriggerRoleQuery("");
    }
  }

  async function persistCommunityConfig(nextConfig: Record<string, any>) {
    if (!guildId || typeof guildId !== "string") return { ok: false, error: "Invalid guild id" };

    const response = await fetch(`/api/modules/${guildId}/community`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        enabled: communityModule?.enabled ?? true,
        config: nextConfig,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (data?.error === "config_store_unreachable") {
        throw new Error("The config store is temporarily unreachable. Wait a few seconds and try saving again.");
      }
      throw new Error(data?.error || "Failed to save community configuration");
    }

    return { ok: true };
  }

  async function handleRoleColorSave() {
    if (!guildId || typeof guildId !== "string") return;

    setRoleColorSaving(true);
    setRoleColorSaveState("idle");
    setRoleColorSaveMessage("");

    try {
      await persistCommunityConfig({
        ...(communityModule?.config ?? {}),
        role_color_rotation: {
          ...roleColorForm,
          interval_value: clampRoleIntervalValue(roleColorForm.interval_value, roleColorForm.interval_unit),
        },
      });

      await loadGuildData();
      setRoleColorSaveState("success");
      setRoleColorSaveMessage("Role color rotation updated successfully.");
    } catch (error) {
      console.error(error);
      setRoleColorSaveState("error");
      setRoleColorSaveMessage(error instanceof Error ? error.message : "Failed to save role color rotation");
    } finally {
      setRoleColorSaving(false);
    }
  }

  async function handleRoleColorReload() {
    setRoleColorReloading(true);
    setRoleColorSaveState("idle");
    setRoleColorSaveMessage("");

    try {
      await loadGuildData();
      setRoleColorSaveState("info");
      setRoleColorSaveMessage("Reloaded the latest role color rotation config.");
    } finally {
      setRoleColorReloading(false);
    }
  }

  async function handleMemeSave() {
    if (!guildId || typeof guildId !== "string") return;

    setMemeSaving(true);
    setMemeSaveState("idle");
    setMemeSaveMessage("");

    try {
      await persistCommunityConfig({
        ...(communityModule?.config ?? {}),
        meme_autopost: {
          ...memeForm,
          interval_value: clampMemeIntervalValue(memeForm.interval_value, memeForm.interval_unit),
          subreddits: sanitizeSubreddits(subredditDraft),
        },
      });

      await loadGuildData();
      setMemeSaveState("success");
      setMemeSaveMessage("Meme autopost updated successfully.");
    } catch (error) {
      console.error(error);
      setMemeSaveState("error");
      setMemeSaveMessage(error instanceof Error ? error.message : "Failed to save meme autopost");
    } finally {
      setMemeSaving(false);
    }
  }

  async function handleMemeReload() {
    setMemeReloading(true);
    setMemeSaveState("idle");
    setMemeSaveMessage("");

    try {
      await loadGuildData();
      setMemeSaveState("info");
      setMemeSaveMessage("Reloaded the latest meme autopost config.");
    } finally {
      setMemeReloading(false);
    }
  }

  async function handleBotLooksSave(nextForm = botLooksForm) {
    if (!guildId || typeof guildId !== "string") return;

    setBotLooksSaving(true);
    setBotLooksSaveState("idle");
    setBotLooksSaveMessage("");

    try {
      await persistCommunityConfig({
        ...(communityModule?.config ?? {}),
        bot_looks: {
          ...nextForm,
          activity_text: nextForm.activity_text.trim(),
          custom_status: nextForm.custom_status.trim(),
          streaming_url: nextForm.streaming_url.trim(),
        },
      });

      await loadGuildData();
      setBotLooksSaveState("success");
      setBotLooksSaveMessage("Bot Looks saved and applied successfully.");
    } catch (error) {
      console.error(error);
      setBotLooksSaveState("error");
      setBotLooksSaveMessage(error instanceof Error ? error.message : "Failed to save Bot Looks");
    } finally {
      setBotLooksSaving(false);
    }
  }

  async function handleBotLooksReload() {
    setBotLooksReloading(true);
    setBotLooksSaveState("idle");
    setBotLooksSaveMessage("");

    try {
      await loadGuildData();
      setBotLooksSaveState("info");
      setBotLooksSaveMessage("Reloaded the latest Bot Looks config.");
    } finally {
      setBotLooksReloading(false);
    }
  }

  async function handleBotLooksReset() {
    setBotLooksResetting(true);
    setBotLooksSaveState("idle");
    setBotLooksSaveMessage("");

    try {
      setBotLooksForm(DEFAULT_BOT_LOOKS_CONFIG);
      await handleBotLooksSave(DEFAULT_BOT_LOOKS_CONFIG);
      setBotLooksSaveState("success");
      setBotLooksSaveMessage("Bot Looks reset to Discord defaults.");
    } finally {
      setBotLooksResetting(false);
    }
  }

  async function handleDmWelcomerSave(nextForm = dmWelcomerForm) {
    if (!guildId || typeof guildId !== "string") return;

    setDmWelcomerSaving(true);
    setDmWelcomerSaveState("idle");
    setDmWelcomerSaveMessage("");

    try {
      await persistCommunityConfig({
        ...(communityModule?.config ?? {}),
        dm_welcomer: {
          ...nextForm,
          title: nextForm.title.trim() || DEFAULT_DM_WELCOMER_CONFIG.title,
          message: nextForm.message.trim() || DEFAULT_DM_WELCOMER_CONFIG.message,
          image_url: nextForm.image_url.trim(),
        },
      });

      await loadGuildData();
      setDmWelcomerSaveState("success");
      setDmWelcomerSaveMessage("DM welcomer saved successfully.");
    } catch (error) {
      console.error(error);
      setDmWelcomerSaveState("error");
      setDmWelcomerSaveMessage(error instanceof Error ? error.message : "Failed to save DM welcomer");
    } finally {
      setDmWelcomerSaving(false);
    }
  }

  async function handleDmWelcomerReload() {
    setDmWelcomerReloading(true);
    setDmWelcomerSaveState("idle");
    setDmWelcomerSaveMessage("");

    try {
      await loadGuildData();
      setDmWelcomerSaveState("info");
      setDmWelcomerSaveMessage("Reloaded the latest DM welcomer config.");
    } finally {
      setDmWelcomerReloading(false);
    }
  }

  async function handlePremiumFeatureSave() {
    if (!guildId || typeof guildId !== "string") return;

    setPremiumFeatureSaving(true);
    setPremiumFeatureSaveState("idle");
    setPremiumFeatureSaveMessage("");

    try {
      await persistCommunityConfig({
        ...(communityModule?.config ?? {}),
        premium_feature_1: {
          ...premiumFeatureForm,
          cooldown_seconds: Math.max(0, premiumFeatureForm.cooldown_seconds || 0),
          webhook_enabled:
            premiumFeatureForm.webhook_enabled &&
            /^https:\/\/discord(?:app)?\.com\/api\/webhooks\//i.test(premiumFeatureForm.webhook_url.trim()),
          webhook_url: premiumFeatureForm.webhook_url.trim().slice(0, 500),
          role_ids: Array.from(new Set(premiumFeatureForm.role_ids)),
          triggers: premiumFeatureForm.triggers
            .map((trigger) => ({
              ...trigger,
              trigger: trigger.trigger.trim().slice(0, 100),
              response_links: sanitizePremiumLinks(trigger.response_links.join("\n")),
              footer_text: trigger.footer_text.trim().slice(0, 500),
              role_ids: Array.from(new Set(trigger.role_ids)),
            }))
            .filter((trigger) => trigger.trigger && trigger.response_links.length > 0),
        },
      });

      await loadGuildData();
      setPremiumFeatureSaveState("success");
      setPremiumFeatureSaveMessage("Premium Feature #1 updated successfully.");
    } catch (error) {
      console.error(error);
      setPremiumFeatureSaveState("error");
      setPremiumFeatureSaveMessage(error instanceof Error ? error.message : "Failed to save Premium Feature #1");
    } finally {
      setPremiumFeatureSaving(false);
    }
  }

  async function handlePremiumFeatureReload() {
    setPremiumFeatureReloading(true);
    setPremiumFeatureSaveState("idle");
    setPremiumFeatureSaveMessage("");

    try {
      await loadGuildData();
      setPremiumFeatureSaveState("info");
      setPremiumFeatureSaveMessage("Reloaded the latest Premium Feature #1 config.");
    } finally {
      setPremiumFeatureReloading(false);
    }
  }

  function updateDmBlock(index: number, updates: Partial<DmBroadcastBlock>) {
    setDmBroadcastForm((current) => ({
      ...current,
      container_blocks: current.container_blocks.map((block, blockIndex) =>
        blockIndex === index ? { ...block, ...updates } : block
      ),
    }));
  }

  function createDmPlainMessage(content = ""): DmBroadcastPlainMessage {
    return {
      id: `dm-plain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content,
    };
  }

  function updateDmPlainMessage(messageId: string, content: string) {
    setDmBroadcastForm((current) => ({
      ...current,
      plain_messages: current.plain_messages.map((message) =>
        message.id === messageId ? { ...message, content } : message
      ),
    }));
  }

  function addDmPlainMessage() {
    setDmBroadcastForm((current) => ({
      ...current,
      plain_messages: [...current.plain_messages, createDmPlainMessage("")],
    }));
  }

  function removeDmPlainMessage(messageId: string) {
    setDmBroadcastForm((current) => ({
      ...current,
      plain_messages:
        current.plain_messages.length === 1
          ? current.plain_messages.map((message) =>
              message.id === messageId ? { ...message, content: "" } : message
            )
          : current.plain_messages.filter((message) => message.id !== messageId),
    }));
  }

  function addDmBlock(type: DmBroadcastBlock["type"]) {
    setDmBroadcastForm((current) => ({
      ...current,
      container_blocks: [
        ...current.container_blocks,
        { type, content: type === "separator" ? "" : "" },
      ],
    }));
  }

  function removeDmBlock(index: number) {
    setDmBroadcastForm((current) => ({
      ...current,
      container_blocks: current.container_blocks.filter((_, blockIndex) => blockIndex !== index),
    }));
  }

  function getDmBroadcastProgressMessage(job: DmBroadcastJob) {
    if (job.status === "queued") {
      return `Queued ${job.requested} DMs. Starting now...`;
    }

    if (job.status === "running") {
      return `Sending ${job.processed}/${job.requested} DMs. ${job.sent} sent${job.failed > 0 ? `, ${job.failed} failed` : ""}.`;
    }

    if (job.status === "completed") {
      return `Sent ${job.sent}/${job.requested} DMs.${job.failed > 0 ? ` ${job.failed} failed.` : ""}`;
    }

    return job.error || "DM broadcast failed";
  }

  async function pollDmBroadcastJob(currentGuildId: string, jobId: string) {
    while (true) {
      const response = await fetch(`/api/guilds/${currentGuildId}/dm-broadcast/${jobId}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to fetch DM broadcast status");
      }

      const job = data?.job as DmBroadcastJob | undefined;
      if (!job) {
        throw new Error("DM broadcast status is missing");
      }

      setDmBroadcastMessage(getDmBroadcastProgressMessage(job));

      if (job.status === "completed") {
        setDmBroadcastState("success");
        return;
      }

      if (job.status === "failed") {
        throw new Error(job.error || "DM broadcast failed");
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async function handleDmBroadcastSend() {
    if (!guildId || typeof guildId !== "string") return;

    if (dmBroadcastForm.target_mode === "member" && !dmBroadcastForm.member_id) {
      setDmBroadcastState("error");
      setDmBroadcastMessage("Choose a member before sending.");
      return;
    }

    const hasPlainMessages = dmBroadcastForm.plain_messages.some((message) => message.content.trim());
    const hasContainerContent = dmBroadcastForm.container_blocks.some((block) => block.type === "separator" || block.content.trim());

    if (!hasPlainMessages && !hasContainerContent) {
      setDmBroadcastState("error");
      setDmBroadcastMessage("Add a plain message or at least one container block before sending.");
      return;
    }

    setDmBroadcastSending(true);
    setDmBroadcastState("idle");
    setDmBroadcastMessage("");
    setDmBroadcastJobId("");

    try {
      const response = await fetch(`/api/guilds/${guildId}/dm-broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dmBroadcastForm),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to send DM broadcast");
      }

      const job = data?.job as DmBroadcastJob | undefined;
      if (!job?.id) {
        throw new Error("DM broadcast job was not created");
      }

      setDmBroadcastJobId(job.id);
      setDmBroadcastMessage(getDmBroadcastProgressMessage(job));
      await pollDmBroadcastJob(guildId, job.id);
    } catch (error) {
      setDmBroadcastState("error");
      setDmBroadcastMessage(error instanceof Error ? error.message : "Failed to send DM broadcast");
    } finally {
      setDmBroadcastJobId("");
      setDmBroadcastSending(false);
    }
  }

  function createAnnouncementEntry(type: AnnouncementEntry["type"]): AnnouncementEntry {
    return {
      id: `announcement-entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      edit_existing: false,
      message_link: "",
      content: "",
      embed: {
        title: "",
        description: "",
        footer_text: "",
        image_url: "",
        color: "#57f287",
      },
      container_blocks: [
        { type: "text", content: "" },
      ],
    };
  }

  async function persistAnnouncementPresets(nextPresets: AnnouncementPreset[]) {
    await persistCommunityConfig({
      ...(communityModule?.config ?? {}),
      announcements_studio: {
        presets: nextPresets.map((preset) => ({
          id: preset.id,
          name: preset.name,
          kind: preset.kind,
          form: cloneAnnouncementForm(preset.form),
        })),
      },
    });
  }

  async function saveAnnouncementPreset(kind: AnnouncementPreset["kind"]) {
    const name = announcementPresetName.trim().slice(0, 80);
    if (!name) {
      setAnnouncementPresetState("error");
      setAnnouncementPresetMessage("Enter a name before saving a draft or template.");
      return;
    }

    setAnnouncementPresetState("idle");
    setAnnouncementPresetMessage("");

    const normalizedForm = cloneAnnouncementForm(announcementForm);
    const existingIndex = announcementPresets.findIndex(
      (preset) => preset.kind === kind && preset.name.toLowerCase() === name.toLowerCase()
    );

    const nextPresets = [...announcementPresets];
    if (existingIndex >= 0) {
      nextPresets[existingIndex] = {
        ...nextPresets[existingIndex],
        name,
        form: normalizedForm,
      };
    } else {
      nextPresets.unshift({
        id: `announcement-preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        kind,
        form: normalizedForm,
      });
    }

    try {
      await persistAnnouncementPresets(nextPresets);
      setAnnouncementPresets(nextPresets);
      setAnnouncementPresetState("success");
      setAnnouncementPresetMessage(`${kind === "template" ? "Template" : "Draft"} saved successfully.`);
    } catch (error) {
      setAnnouncementPresetState("error");
      setAnnouncementPresetMessage(error instanceof Error ? error.message : `Failed to save ${kind}.`);
    }
  }

  function loadAnnouncementPreset(preset: AnnouncementPreset) {
    setAnnouncementForm(cloneAnnouncementForm(preset.form));
    setAnnouncementPresetName(preset.name);
    setAnnouncementPresetState("info");
    setAnnouncementPresetMessage(`Loaded ${preset.kind} "${preset.name}".`);
  }

  async function deleteAnnouncementPreset(presetId: string) {
    const nextPresets = announcementPresets.filter((preset) => preset.id !== presetId);

    try {
      await persistAnnouncementPresets(nextPresets);
      setAnnouncementPresets(nextPresets);
      setAnnouncementPresetState("success");
      setAnnouncementPresetMessage("Saved announcement preset removed.");
    } catch (error) {
      setAnnouncementPresetState("error");
      setAnnouncementPresetMessage(error instanceof Error ? error.message : "Failed to delete saved preset.");
    }
  }

  function toggleAnnouncementChannel(channelId: string) {
    setAnnouncementForm((current) => {
      const selected = new Set(current.channel_ids);
      if (selected.has(channelId)) {
        selected.delete(channelId);
      } else {
        selected.add(channelId);
      }

      return {
        ...current,
        channel_ids: Array.from(selected),
      };
    });
    setAnnouncementChannelPickerOpen(true);
  }

  function updateAnnouncementEntry(entryId: string, updates: Partial<AnnouncementEntry>) {
    setAnnouncementForm((current) => ({
      ...current,
      entries: current.entries.map((entry) => entry.id === entryId ? { ...entry, ...updates } : entry),
    }));
  }

  function addAnnouncementEntry(type: AnnouncementEntry["type"]) {
    setAnnouncementForm((current) => ({
      ...current,
      entries: [...current.entries, createAnnouncementEntry(type)],
    }));
  }

  function duplicateAnnouncementEntry(entryId: string) {
    setAnnouncementForm((current) => {
      const sourceIndex = current.entries.findIndex((entry) => entry.id === entryId);
      if (sourceIndex === -1) {
        return current;
      }

      const sourceEntry = current.entries[sourceIndex];
      const duplicate = {
        ...sourceEntry,
        id: `announcement-entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        container_blocks: sourceEntry.container_blocks.map((block) => ({ ...block })),
        embed: { ...sourceEntry.embed },
      };

      const nextEntries = [...current.entries];
      nextEntries.splice(sourceIndex + 1, 0, duplicate);

      return {
        ...current,
        entries: nextEntries,
      };
    });
  }

  function moveAnnouncementEntry(fromEntryId: string, toEntryId: string) {
    if (!fromEntryId || !toEntryId || fromEntryId === toEntryId) return;

    setAnnouncementForm((current) => {
      const fromIndex = current.entries.findIndex((entry) => entry.id === fromEntryId);
      const toIndex = current.entries.findIndex((entry) => entry.id === toEntryId);

      if (fromIndex === -1 || toIndex === -1) {
        return current;
      }

      const nextEntries = [...current.entries];
      const [moved] = nextEntries.splice(fromIndex, 1);
      nextEntries.splice(toIndex, 0, moved);

      return {
        ...current,
        entries: nextEntries,
      };
    });
  }

  function removeAnnouncementEntry(entryId: string) {
    setAnnouncementForm((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.id !== entryId),
    }));
    setAnnouncementEmojiTarget((current) => current && current.entryId === entryId ? null : current);
  }

  function updateAnnouncementBlock(entryId: string, blockIndex: number, updates: Partial<AnnouncementBlock>) {
    setAnnouncementForm((current) => ({
      ...current,
      entries: current.entries.map((entry) => {
        if (entry.id !== entryId) return entry;
        return {
          ...entry,
          container_blocks: entry.container_blocks.map((block, index) => index === blockIndex ? { ...block, ...updates } : block),
        };
      }),
    }));
  }

  function addAnnouncementBlock(entryId: string, type: AnnouncementBlock["type"]) {
    setAnnouncementForm((current) => ({
      ...current,
      entries: current.entries.map((entry) => {
        if (entry.id !== entryId) return entry;
        return {
          ...entry,
          container_blocks: [...entry.container_blocks, { type, content: "" }],
        };
      }),
    }));
  }

  function removeAnnouncementBlock(entryId: string, blockIndex: number) {
    setAnnouncementForm((current) => ({
      ...current,
      entries: current.entries.map((entry) => {
        if (entry.id !== entryId) return entry;
        return {
          ...entry,
          container_blocks: entry.container_blocks.filter((_, index) => index !== blockIndex),
        };
      }),
    }));
    setAnnouncementEmojiTarget((current) =>
      current && current.kind === "containerText" && current.entryId === entryId && current.blockIndex === blockIndex
        ? null
        : current
    );
  }

  function appendEmoji(target: AnnouncementEmojiTarget | null, emojiText: string) {
    if (!target) return;

    setAnnouncementForm((current) => ({
      ...current,
      entries: current.entries.map((entry) => {
        if (entry.id !== target.entryId) return entry;

        if (target.kind === "normal") {
          return { ...entry, content: `${entry.content}${emojiText}` };
        }

        if (target.kind === "embedTitle") {
          return { ...entry, embed: { ...entry.embed, title: `${entry.embed.title}${emojiText}` } };
        }

        if (target.kind === "embedDescription") {
          return { ...entry, embed: { ...entry.embed, description: `${entry.embed.description}${emojiText}` } };
        }

        if (target.kind === "embedFooter") {
          return { ...entry, embed: { ...entry.embed, footer_text: `${entry.embed.footer_text}${emojiText}` } };
        }

        return {
          ...entry,
          container_blocks: entry.container_blocks.map((block, index) =>
            index === target.blockIndex ? { ...block, content: `${block.content}${emojiText}` } : block
          ),
        };
      }),
    }));
  }

  async function handleAnnouncementSend() {
    if (!guildId || typeof guildId !== "string") return;

    const requiresTargetChannels = announcementForm.entries.some((entry) => !entry.edit_existing);

    if (requiresTargetChannels && announcementForm.channel_ids.length === 0) {
      setAnnouncementState("error");
      setAnnouncementMessage("Choose at least one channel before sending.");
      return;
    }

    if (announcementForm.entries.length === 0) {
      setAnnouncementState("error");
      setAnnouncementMessage("Add at least one announcement message before sending.");
      return;
    }

    setAnnouncementSending(true);
    setAnnouncementState("idle");
    setAnnouncementMessage("");

    try {
      const response = await fetch(`/api/guilds/${guildId}/announcements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(announcementForm),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to send announcement");
      }

      const result = data?.result;
      setAnnouncementState("success");
      const requestedChannels = result?.requested_channels ?? 0;
      const deliveredChannels = result?.delivered_channels ?? 0;
      const failedChannels = result?.failed_channels ?? 0;
      const newMessageCount = result?.message_count ?? 0;
      const editedCount = result?.edited_messages ?? 0;
      const failedEdits = result?.failed_edits ?? 0;
      const deliveryText = requestedChannels > 0
        ? `Delivered to ${deliveredChannels}/${requestedChannels} channel${requestedChannels === 1 ? "" : "s"} with ${newMessageCount} new message${newMessageCount === 1 ? "" : "s"}.`
        : "";
      const failedChannelText = failedChannels > 0 ? ` ${failedChannels} channel${failedChannels === 1 ? "" : "s"} failed.` : "";
      const editText = editedCount > 0 ? ` Edited ${editedCount} linked bot message${editedCount === 1 ? "" : "s"}.` : "";
      const failedEditText = failedEdits > 0 ? ` ${failedEdits} linked edit${failedEdits === 1 ? "" : "s"} failed.` : "";
      const fallbackText = editedCount > 0
        ? "Updated linked announcement messages."
        : "Announcement request completed.";
      setAnnouncementMessage(`${deliveryText}${failedChannelText}${editText}${failedEditText}`.trim() || fallbackText);
    } catch (error) {
      setAnnouncementState("error");
      setAnnouncementMessage(error instanceof Error ? error.message : "Failed to send announcement");
    } finally {
      setAnnouncementSending(false);
    }
  }

  function renderPreviewText(text: string, fallback = "") {
    const value = text || fallback;
    const parts: ReactNode[] = [];
    const pattern = /<a?:([a-zA-Z0-9_]+):(\d+)>/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null = null;

    while ((match = pattern.exec(value)) !== null) {
      const [raw, name, id] = match;
      if (match.index > lastIndex) {
        parts.push(value.slice(lastIndex, match.index));
      }

      const emoji = emojiById.get(id);
      if (emoji) {
        parts.push(
          <img
            key={`${id}-${match.index}`}
            src={emoji.url}
            alt={name}
            className="mx-0.5 inline-block h-5 w-5 align-text-bottom object-contain"
          />
        );
      } else {
        parts.push(raw);
      }

      lastIndex = match.index + raw.length;
    }

    if (lastIndex < value.length) {
      parts.push(value.slice(lastIndex));
    }

    return parts.length > 0 ? parts : [value];
  }

  function renderDmBroadcastPlainPreview(content: string, fallback = "Plain message preview") {
    return renderPreviewText(
      (content || fallback)
        .replaceAll("{username}", selectedDmMember?.username || "PreviewUser")
        .replaceAll("{server_name}", guild?.name || "Preview Server")
        .replaceAll("{mention}", "@PreviewUser")
    );
  }

  function renderAnnouncementEntryPreview(entry: AnnouncementEntry) {
    if (entry.type === "normal") {
      return (
        <div className="whitespace-pre-wrap text-zinc-100">
          {renderPreviewText(entry.content || "Normal message preview")}
        </div>
      );
    }

    if (entry.type === "embed") {
      return (
        <div className="rounded-2xl border border-zinc-700 bg-black p-4">
          {entry.embed.title ? <div className="text-lg font-semibold text-zinc-100">{renderPreviewText(entry.embed.title)}</div> : null}
          {entry.embed.description ? <div className="mt-2 whitespace-pre-wrap text-zinc-300">{renderPreviewText(entry.embed.description)}</div> : null}
          {entry.embed.image_url ? <img src={entry.embed.image_url} alt="Embed preview" className="mt-3 max-h-72 w-full rounded-xl border border-zinc-800 object-cover" /> : null}
          {entry.embed.footer_text ? <div className="mt-3 text-xs text-zinc-500">{renderPreviewText(entry.embed.footer_text)}</div> : null}
        </div>
      );
    }

    return (
      <div className="space-y-3 rounded-2xl border border-zinc-700 bg-black p-4">
        {entry.container_blocks.length === 0 ? (
          <div className="text-sm text-zinc-500">No container blocks yet.</div>
        ) : (
          entry.container_blocks.map((block, blockIndex) => {
            if (block.type === "separator") {
              return <div key={`${entry.id}-${blockIndex}`} className="h-px w-full bg-zinc-800" />;
            }

            if (block.type === "image") {
              return block.content ? (
                <img key={`${entry.id}-${blockIndex}`} src={block.content} alt="Container preview" className="max-h-72 w-full rounded-xl border border-zinc-800 object-cover" />
              ) : (
                <div key={`${entry.id}-${blockIndex}`} className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">Image URL goes here.</div>
              );
            }

            return (
              <div key={`${entry.id}-${blockIndex}`} className="whitespace-pre-wrap text-zinc-100">
                {renderPreviewText(block.content || "Container text block")}
              </div>
            );
          })
        )}
      </div>
    );
  }

  function getAnnouncementPreviewSummary(entry: AnnouncementEntry) {
    if (entry.type === "normal") {
      return entry.content.trim() || "Empty normal message";
    }

    if (entry.type === "embed") {
      return entry.embed.title.trim() || entry.embed.description.trim() || "Empty embed";
    }

    const textBlock = entry.container_blocks.find((block) => block.type === "text" && block.content.trim());
    if (textBlock) {
      return textBlock.content.trim();
    }

    const imageCount = entry.container_blocks.filter((block) => block.type === "image" && block.content.trim()).length;
    if (imageCount > 0) {
      return `${imageCount} image block${imageCount === 1 ? "" : "s"}`;
    }

    return entry.container_blocks.length > 0 ? `${entry.container_blocks.length} container blocks` : "Empty container";
  }

  function renderStatusMessage(state: SaveState, message: string, fallback: string) {
    return (
      <div
        className={`rounded-lg px-3 py-2 text-sm ${
          state === "success"
            ? "border border-emerald-700/60 bg-emerald-500/10 text-emerald-300"
            : state === "error"
              ? "border border-red-700/60 bg-red-500/10 text-red-300"
              : state === "info"
                ? "border border-sky-700/60 bg-sky-500/10 text-sky-300"
                : "text-zinc-400"
        }`}
      >
        {message || fallback}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <BoneyardCard lines={2} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <BoneyardCard key={index} lines={3} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout guildId={String(guildId || "")} guildName={guild?.name || "Guild"} heading="Community" modules={modules}>
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Community</h1>
            <p className="text-muted-foreground">Bot Looks, message features, role color rotation, and lightweight meme autopost controls live here now.</p>
          </div>
        </div>

        <section>
          <h2 className="card-heading mb-4 text-sm uppercase tracking-wider text-muted-foreground">Feature Cards</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Bot className="h-6 w-6" />}
              title="Bot Looks"
              description={botLooksSummary}
              badge={botLooksForm.enabled ? "Applied" : "Default"}
              iconColor="text-cyan-400"
              onClick={() => setBotLooksOpen(true)}
            />
            <FeatureCard
              icon={<LogIn className="h-6 w-6" />}
              title="DM All"
              description="Send a one-off DM to one member or the whole server with editable text and container blocks."
              iconColor="text-green-500"
              onClick={() => setDmAllOpen(true)}
            />
            <FeatureCard
              icon={<Megaphone className="h-6 w-6" />}
              title="Announcements"
              description="Compose one-off announcements as normal messages, embeds, or containers and send them to one or many channels."
              iconColor="text-orange-400"
              onClick={() => setAnnouncementOpen(true)}
            />
            <FeatureCard
              icon={<Palette className="h-6 w-6" />}
              title="Randomized Role Color"
              description={`Rotate ${selectedRoleColors.length} selected roles every ${roleColorForm.interval_value} ${roleColorForm.interval_unit}.`}
              badge={roleColorForm.enabled ? "Live" : "Off"}
              iconColor="text-pink-500"
              onClick={() => setRoleColorOpen(true)}
            />
            <FeatureCard
              icon={<ImageIcon className="h-6 w-6" />}
              title="Meme Autopost"
              description={
                memeSubredditPreview.length
                  ? `Post from ${memeSubredditPreview.length} subreddit${memeSubredditPreview.length === 1 ? "" : "s"} every ${memeForm.interval_value} ${memeForm.interval_unit}.`
                  : "Choose subreddits, a target channel, and an optional ping role."
              }
              badge={memeForm.enabled ? "Live" : "Off"}
              iconColor="text-blue-500"
              onClick={() => setMemeOpen(true)}
            />
            <FeatureCard
              icon={<Star className="h-6 w-6" />}
              title="Premium Feature #1"
              description={premiumFeatureSummary}
              badge={premiumFeatureForm.enabled ? "Live" : "Off"}
              iconColor="text-amber-400"
              onClick={() => setPremiumFeatureOpen(true)}
            />
          </div>
        </section>

        <section>
          <h2 className="card-heading mb-4 text-sm uppercase tracking-wider text-muted-foreground">Messaging</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<LogIn className="h-6 w-6" />}
              title="DM Welcomer"
              description={dmWelcomerForm.enabled ? "Send a configured DM welcome whenever someone joins the server." : "Configure the direct-message welcome the bot sends to new members."}
              iconColor="text-green-500"
              badge={dmWelcomerForm.enabled ? "Live" : "Off"}
              onClick={() => setDmWelcomerOpen(true)}
            />
            <FeatureCard
              icon={<LogOut className="h-6 w-6" />}
              title="Goodbye System"
              description="Send a leave message when members exit the server."
              iconColor="text-red-500"
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Booster Rewards"
              description="Thank members when they start boosting the server."
              iconColor="text-pink-500"
            />
          </div>
        </section>

        <section>
          <h2 className="card-heading mb-4 text-sm uppercase tracking-wider text-muted-foreground">Channel Controls</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FeatureCard
              icon={<Lock className="h-6 w-6" />}
              title="UwU Lock"
              description="Apply a novelty channel lock without adding a heavy moderation subsystem."
              iconColor="text-pink-500"
            />
            <FeatureCard
              icon={<Users className="h-6 w-6" />}
              title="Low-Write Runtime"
              description="Community features are intentionally kept scheduler-light and inexpensive to run."
              iconColor="text-blue-500"
            />
          </div>
        </section>

        <section>
          <h2 className="card-heading mb-4 text-sm uppercase tracking-wider text-muted-foreground">Staff Tools</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FeatureCard
              icon={<Star className="h-6 w-6" />}
              title="Staff Rating"
              description="Collect simple ratings for staff performance."
              iconColor="text-yellow-500"
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Staff Leaderboard"
              description="Show leaderboard-style staff scoring without a heavy analytics pipeline."
              iconColor="text-blue-500"
            />
          </div>
        </section>

        <Dialog open={dmAllOpen} onOpenChange={setDmAllOpen}>
          <DialogContent className="max-h-[92vh] max-w-[min(95vw,1340px)] overflow-y-auto border-border/70 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <LogIn className="h-5 w-5 text-green-400" />
                DM All
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Send a one-off DM to a selected member or the whole server. Placeholders apply only to the plain message on top, not to the container blocks.
              </DialogDescription>
            </DialogHeader>

            <div id="dm-broadcast-top" className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.7fr)]">
                <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-zinc-200">Target</Label>
                    <Select
                      value={dmBroadcastForm.target_mode}
                      onValueChange={(value) =>
                        setDmBroadcastForm((current) => ({
                          ...current,
                          target_mode: value as DmBroadcastForm["target_mode"],
                          member_id: value === "everyone" ? "" : current.member_id,
                        }))
                      }
                    >
                      <SelectTrigger className="border-zinc-800 bg-black text-zinc-100">
                        <SelectValue placeholder="Choose target" />
                      </SelectTrigger>
                      <SelectContent className="border-zinc-800 bg-black text-zinc-100">
                        <SelectItem value="member" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Selected member</SelectItem>
                        <SelectItem value="everyone" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Everyone in server</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dm-broadcast-delay" className="text-zinc-200">Delay Between DMs</Label>
                    <Input
                      id="dm-broadcast-delay"
                      type="number"
                      min={0.5}
                      max={10}
                      step={0.1}
                      value={dmBroadcastForm.delay_seconds}
                      className="border-zinc-800 bg-zinc-950 text-zinc-100"
                      onChange={(event) =>
                        setDmBroadcastForm((current) => ({
                          ...current,
                          delay_seconds: Math.min(
                            10,
                            Math.max(0.5, Number.parseFloat(event.target.value) || 0.5)
                          ),
                        }))
                      }
                    />
                    <p className="text-xs text-zinc-500">
                      Used for server-wide sends. Recommended: <code>1.0</code> to <code>1.5</code> seconds.
                    </p>
                  </div>
                </div>

                {dmBroadcastForm.target_mode === "member" && (
                  <div id="dm-broadcast-member" className="space-y-3">
                    <Label className="text-zinc-200">Choose Member</Label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMemberPickerOpen((current) => !current)}
                        className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100"
                      >
                        <span>{selectedDmMember ? `${selectedDmMember.display_name} (${selectedDmMember.username})` : "Open member dropdown"}</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${memberPickerOpen ? "rotate-180" : ""}`} />
                      </button>

                      {memberPickerOpen && (
                        <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-800 bg-black shadow-2xl">
                          <div className="border-b border-zinc-800 p-3">
                            <Input
                              placeholder="Type a member name to filter..."
                              value={memberQuery}
                              className="border-zinc-800 bg-zinc-950 text-zinc-100"
                              onChange={(event) => setMemberQuery(event.target.value)}
                              onFocus={() => setMemberPickerOpen(true)}
                            />
                            {memberLoadMessage && (
                              <p className="mt-2 text-xs text-red-400">{memberLoadMessage}</p>
                            )}
                          </div>
                          <div className="max-h-72 overflow-y-auto p-2">
                            {members.length === 0 ? (
                              <div className="rounded-lg px-3 py-4 text-sm text-zinc-500">No members match that search.</div>
                            ) : (
                              members.map((member) => (
                                <button
                                  key={member.id}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    setDmBroadcastForm((current) => ({ ...current, member_id: member.id }));
                                    setMemberPickerOpen(false);
                                  }}
                                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                    dmBroadcastForm.member_id === member.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-300 hover:bg-zinc-900"
                                  }`}
                                >
                                  <div>
                                    <div className="font-medium">{member.display_name}</div>
                                    <div className="text-xs text-zinc-500">{member.username}</div>
                                  </div>
                                  {dmBroadcastForm.member_id === member.id ? (
                                    <Badge className="bg-green-600 text-white hover:bg-green-600">Selected</Badge>
                                  ) : null}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div id="dm-broadcast-message-section" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-zinc-200">Plain Message Stack</Label>
                    <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={addDmPlainMessage}>
                      Add Message
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Each plain message below sends as its own Discord DM. Use this when your DM needs multiple text messages before or after the container.
                  </p>
                  <div className="space-y-3">
                    {dmBroadcastForm.plain_messages.map((message, index) => (
                      <div key={message.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <Badge className="bg-zinc-800 text-zinc-100 hover:bg-zinc-800">Message {index + 1}</Badge>
                          <button type="button" onClick={() => removeDmPlainMessage(message.id)} className="rounded-full text-zinc-400 hover:text-red-400">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <Textarea
                          value={message.content}
                          className="min-h-[120px] border-zinc-800 bg-zinc-950 text-zinc-100"
                          placeholder="Write the plain DM message"
                          onChange={(event) => updateDmPlainMessage(message.id, event.target.value.slice(0, 1800))}
                        />
                        <p className="mt-2 text-xs text-zinc-500">
                          Placeholders here only: <code>{"{username}"}</code>, <code>{"{server_name}"}</code>, <code>{"{mention}"}</code>.
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div id="dm-broadcast-blocks" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-zinc-200">Container Blocks</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addDmBlock("text")}>Add Text</Button>
                      <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addDmBlock("image")}>Add Image</Button>
                      <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addDmBlock("separator")}>Add Separator</Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {dmBroadcastForm.container_blocks.map((block, index) => (
                      <div key={`${block.type}-${index}`} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <Badge className="bg-zinc-800 text-zinc-100 hover:bg-zinc-800">{block.type}</Badge>
                          <button type="button" onClick={() => removeDmBlock(index)} className="rounded-full text-zinc-400 hover:text-red-400">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        {block.type !== "separator" && (
                          <Textarea
                            value={block.content}
                            placeholder={block.type === "image" ? "https://..." : "Container text block"}
                            className="min-h-[90px] border-zinc-800 bg-zinc-950 text-zinc-100"
                            onChange={(event) => updateDmBlock(index, { content: event.target.value.slice(0, 2000) })}
                          />
                        )}
                        {block.type === "separator" && (
                          <p className="text-sm text-zinc-500">This adds a divider inside the container.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                </div>

                <div id="dm-broadcast-preview" className="scroll-mt-24" />
                <div className="hidden lg:block">
                  <div className="sticky top-0 space-y-4">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-wider text-zinc-500">DM Sequence Preview</div>
                          <div className="mt-1 text-sm text-zinc-300">Each plain entry below becomes its own DM message.</div>
                        </div>
                        <Badge className="bg-zinc-800 text-zinc-100 hover:bg-zinc-800">
                          {dmBroadcastForm.plain_messages.filter((message) => message.content.trim()).length} text message{dmBroadcastForm.plain_messages.filter((message) => message.content.trim()).length === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        {dmBroadcastForm.plain_messages.filter((message) => message.content.trim()).length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                            No plain DM messages yet.
                          </div>
                        ) : (
                          dmBroadcastForm.plain_messages.map((message, index) =>
                            message.content.trim() ? (
                              <div key={message.id} className="rounded-2xl border border-zinc-700 bg-black p-4">
                                <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Message {index + 1}</div>
                                <div className="whitespace-pre-wrap text-zinc-100">
                                  {renderDmBroadcastPlainPreview(message.content)}
                                </div>
                              </div>
                            ) : null
                          )
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <div className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Container Preview</div>
                      <div className="space-y-3 rounded-2xl border border-zinc-700 bg-black p-4">
                        {dmBroadcastForm.container_blocks.length === 0 ? (
                          <div className="text-sm text-zinc-500">No container blocks yet.</div>
                        ) : (
                          dmBroadcastForm.container_blocks.map((block, index) => {
                            if (block.type === "separator") {
                              return <div key={index} className="h-px w-full bg-zinc-800" />;
                            }

                            if (block.type === "image") {
                              return block.content ? (
                                <img key={index} src={block.content} alt="Preview block" className="max-h-64 w-full rounded-xl border border-zinc-800 object-cover" />
                              ) : (
                                <div key={index} className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">Image URL goes here.</div>
                              );
                            }

                            return (
                              <div key={index} className="whitespace-pre-wrap text-zinc-100">
                                {renderPreviewText(block.content || "Container text block")}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div id="dm-broadcast-preview-mobile" className="space-y-4 lg:hidden">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-zinc-500">DM Sequence Preview</div>
                      <div className="mt-1 text-sm text-zinc-300">Each plain entry below becomes its own DM message.</div>
                    </div>
                    <Badge className="bg-zinc-800 text-zinc-100 hover:bg-zinc-800">
                      {dmBroadcastForm.plain_messages.filter((message) => message.content.trim()).length} text
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {dmBroadcastForm.plain_messages.filter((message) => message.content.trim()).length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                        No plain DM messages yet.
                      </div>
                    ) : (
                      dmBroadcastForm.plain_messages.map((message, index) =>
                        message.content.trim() ? (
                          <div key={message.id} className="rounded-2xl border border-zinc-700 bg-black p-4">
                            <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Message {index + 1}</div>
                            <div className="whitespace-pre-wrap text-zinc-100">
                              {renderDmBroadcastPlainPreview(message.content)}
                            </div>
                          </div>
                        ) : null
                      )
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Container Preview</div>
                  <div className="space-y-3 rounded-2xl border border-zinc-700 bg-black p-4">
                    {dmBroadcastForm.container_blocks.length === 0 ? (
                      <div className="text-sm text-zinc-500">No container blocks yet.</div>
                    ) : (
                      dmBroadcastForm.container_blocks.map((block, index) => {
                        if (block.type === "separator") {
                          return <div key={index} className="h-px w-full bg-zinc-800" />;
                        }

                        if (block.type === "image") {
                          return block.content ? (
                            <img key={index} src={block.content} alt="Preview block" className="max-h-64 w-full rounded-xl border border-zinc-800 object-cover" />
                          ) : (
                            <div key={index} className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">Image URL goes here.</div>
                          );
                        }

                        return (
                          <div key={index} className="whitespace-pre-wrap text-zinc-100">
                            {renderPreviewText(block.content || "Container text block")}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                </div>
            </div>

            <div className="sticky bottom-0 z-20 -mx-6 border-t border-zinc-800 bg-zinc-950/95 px-6 py-4 backdrop-blur">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex-1">
                  {renderStatusMessage(
                    dmBroadcastState,
                    dmBroadcastMessage,
                    "Send a one-off DM to one member or the whole server."
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={addDmPlainMessage}>Add Message</Button>
                  <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addDmBlock("text")}>Add Text</Button>
                  <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addDmBlock("image")}>Add Image</Button>
                  <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addDmBlock("separator")}>Add Separator</Button>
                  <Button type="button" onClick={handleDmBroadcastSend} disabled={dmBroadcastSending} className="gap-2 bg-green-600 text-white hover:bg-green-500">
                    <Save className="h-4 w-4" />
                    {dmBroadcastSending ? (dmBroadcastJobId ? "Sending..." : "Queueing...") : "Send DM"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
          <DialogContent className="max-h-[92vh] max-w-[min(96vw,1500px)] overflow-y-auto border-border/70 bg-zinc-950 text-sm text-zinc-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Megaphone className="h-5 w-5 text-orange-400" />
                Announcements
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Build one-off announcements as normal messages, embeds, or containers. Send them to one channel or many and preview the final stack before posting.
              </DialogDescription>
            </DialogHeader>

            <div id="announcement-top" className="grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.8fr)]">
                <div className="space-y-6">
                <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div>
                    <div className="font-medium text-zinc-100">Drafts & Templates</div>
                    <div className="text-sm text-zinc-400">Save the current announcement as a draft or template, then load it later from this list.</div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <Input
                      value={announcementPresetName}
                      placeholder="Name this draft or template"
                      className="border-zinc-800 bg-black text-zinc-100"
                      onChange={(event) => setAnnouncementPresetName(event.target.value.slice(0, 80))}
                    />
                    <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => saveAnnouncementPreset("draft")}>
                      Save Draft
                    </Button>
                    <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => saveAnnouncementPreset("template")}>
                      Save Template
                    </Button>
                  </div>

                  {renderStatusMessage(
                    announcementPresetState,
                    announcementPresetMessage,
                    "Drafts keep a working copy. Templates are reusable starting points."
                  )}

                  <div className="space-y-2">
                    {announcementPresets.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                        No saved announcement drafts or templates yet.
                      </div>
                    ) : (
                      announcementPresets.map((preset) => (
                        <div key={preset.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-zinc-100">{preset.name}</div>
                            <div className="text-xs uppercase tracking-wider text-zinc-500">{preset.kind}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" className="border-zinc-800 bg-black text-zinc-100 hover:bg-zinc-900" onClick={() => loadAnnouncementPreset(preset)}>
                              Load
                            </Button>
                            <button type="button" onClick={() => deleteAnnouncementPreset(preset.id)} className="rounded-full text-zinc-400 hover:text-red-400">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div id="announcement-channels" className="space-y-3">
                  <Label className="text-zinc-200">Target Channels</Label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAnnouncementChannelPickerOpen((current) => !current)}
                      className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100"
                    >
                      <span>
                        {selectedAnnouncementChannels.length > 0
                          ? `${selectedAnnouncementChannels.length} channel${selectedAnnouncementChannels.length === 1 ? "" : "s"} selected`
                          : "Open channel dropdown"}
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${announcementChannelPickerOpen ? "rotate-180" : ""}`} />
                    </button>

                    {announcementChannelPickerOpen ? (
                      <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-800 bg-black shadow-2xl">
                        <div className="border-b border-zinc-800 p-3">
                          <Input
                            placeholder="Type a channel name to filter..."
                            value={announcementChannelQuery}
                            className="border-zinc-800 bg-zinc-950 text-zinc-100"
                            onChange={(event) => setAnnouncementChannelQuery(event.target.value)}
                          />
                          {channelLoadMessage ? (
                            <p className="mt-2 text-xs text-red-400">{channelLoadMessage}</p>
                          ) : null}
                        </div>
                        <div className="max-h-72 overflow-y-auto p-2">
                          {filteredAnnouncementChannels.length === 0 ? (
                            <div className="rounded-lg px-3 py-4 text-sm text-zinc-500">No channels match that search.</div>
                          ) : (
                            filteredAnnouncementChannels.map((channel) => {
                              const selected = announcementForm.channel_ids.includes(channel.id);
                              return (
                                <button
                                  key={channel.id}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => toggleAnnouncementChannel(channel.id)}
                                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                    selected ? "bg-zinc-800 text-zinc-100" : "text-zinc-300 hover:bg-zinc-900"
                                  }`}
                                >
                                  <span>#{channel.name}</span>
                                  {selected ? (
                                    <Badge className="bg-orange-500 text-black hover:bg-orange-500">Selected</Badge>
                                  ) : null}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                      {selectedAnnouncementChannels.length === 0 ? (
                        <p className="text-sm text-zinc-500">
                          {announcementForm.entries.every((entry) => entry.edit_existing)
                            ? "No channels needed because every part is editing an existing bot message."
                            : "No channels selected yet."}
                        </p>
                      ) : (
                      selectedAnnouncementChannels.map((channel) => (
                        <Badge key={channel.id} variant="secondary" className="border-zinc-700 bg-zinc-800 px-3 py-1 text-zinc-100">
                          #{channel.name}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div id="announcement-parts" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-zinc-200">Announcement Parts</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="gap-2 border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addAnnouncementEntry("normal")}>
                        <Plus className="h-4 w-4" />
                        Normal
                      </Button>
                      <Button type="button" variant="outline" className="gap-2 border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addAnnouncementEntry("embed")}>
                        <Plus className="h-4 w-4" />
                        Embed
                      </Button>
                      <Button type="button" variant="outline" className="gap-2 border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addAnnouncementEntry("container")}>
                        <Plus className="h-4 w-4" />
                        Container
                      </Button>
                    </div>
                  </div>

                  {announcementForm.entries.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
                      No announcement parts yet. Add a normal message, embed, or container block.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {announcementForm.entries.map((entry, entryIndex) => (
                        <div
                          id={`announcement-editor-${entry.id}`}
                          key={entry.id}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            moveAnnouncementEntry(announcementDragEntryId, entry.id);
                            setAnnouncementDragEntryId("");
                          }}
                          className={`scroll-mt-24 rounded-2xl border bg-zinc-900/60 p-4 ${announcementDragEntryId === entry.id ? "border-orange-500/70" : "border-zinc-800"}`}
                        >
                          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.78fr)]">
                            <div className="space-y-4">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                draggable
                                onDragStart={() => setAnnouncementDragEntryId(entry.id)}
                                onDragEnd={() => setAnnouncementDragEntryId("")}
                                className="cursor-grab text-zinc-500"
                              >
                                <GripVertical className="h-4 w-4" />
                              </button>
                              <div>
                                <div className="font-medium text-zinc-100">Part {entryIndex + 1}</div>
                                <div className="text-xs uppercase tracking-wider text-zinc-500">{entry.type}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => duplicateAnnouncementEntry(entry.id)} className="rounded-full text-zinc-400 hover:text-orange-300">
                                <Copy className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => removeAnnouncementEntry(entry.id)} className="rounded-full text-zinc-400 hover:text-red-400">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
                            <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Server Emojis</div>
                            {emojiLoadMessage ? (
                              <div className="mb-2 text-xs text-red-400">{emojiLoadMessage}</div>
                            ) : null}
                            <div className="max-h-24 overflow-y-auto">
                              <div className="flex flex-wrap gap-2">
                                {emojis.length === 0 ? (
                                  <div className="text-sm text-zinc-500">No custom server emojis are available.</div>
                                ) : (
                                  emojis.map((emoji) => (
                                    <button
                                      key={emoji.id}
                                      type="button"
                                      onClick={() => appendEmoji(announcementEmojiTarget, emoji.mention)}
                                      className="rounded-lg border border-zinc-800 bg-black p-1.5 hover:bg-zinc-900"
                                      title={emoji.name}
                                    >
                                      <img src={emoji.url} alt={emoji.name} className="h-7 w-7 object-contain" />
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mb-4 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <div className="font-medium text-zinc-100">Edit Existing Message</div>
                                <div className="text-xs text-zinc-500">If this is on, this part edits the linked message instead of sending a new one. The target message must already be sent by this bot.</div>
                              </div>
                              <Switch
                                checked={entry.edit_existing}
                                onCheckedChange={(checked) =>
                                  updateAnnouncementEntry(entry.id, {
                                    edit_existing: checked,
                                    message_link: checked ? entry.message_link : "",
                                  })
                                }
                              />
                            </div>

                            {entry.edit_existing ? (
                              <div className="space-y-2">
                                <Label className="text-zinc-200">Message Link</Label>
                                <Input
                                  value={entry.message_link}
                                  placeholder="https://discord.com/channels/server/channel/message"
                                  className="border-zinc-800 bg-black text-zinc-100"
                                  onChange={(event) => updateAnnouncementEntry(entry.id, { message_link: event.target.value.slice(0, 500) })}
                                />
                              </div>
                            ) : null}
                          </div>

                          {entry.type === "normal" ? (
                            <div className="space-y-2">
                              <Label className="text-zinc-200">Message</Label>
                              <Textarea
                                value={entry.content}
                                className="min-h-[140px] border-zinc-800 bg-zinc-950 text-zinc-100"
                                placeholder="Write the normal announcement message"
                                onFocus={() => setAnnouncementEmojiTarget({ kind: "normal", entryId: entry.id })}
                                onChange={(event) => updateAnnouncementEntry(entry.id, { content: event.target.value.slice(0, 2000) })}
                              />
                            </div>
                          ) : null}

                          {entry.type === "embed" ? (
                            <div className="space-y-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label className="text-zinc-200">Embed Title</Label>
                                  <Input
                                    value={entry.embed.title}
                                    placeholder="Embed title"
                                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                                    onFocus={() => setAnnouncementEmojiTarget({ kind: "embedTitle", entryId: entry.id })}
                                    onChange={(event) =>
                                      updateAnnouncementEntry(entry.id, {
                                        embed: { ...entry.embed, title: event.target.value.slice(0, 256) },
                                      })
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-zinc-200">Color</Label>
                                  <Input
                                    value={entry.embed.color}
                                    placeholder="#57f287"
                                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                                    onChange={(event) =>
                                      updateAnnouncementEntry(entry.id, {
                                        embed: { ...entry.embed, color: event.target.value.slice(0, 7) },
                                      })
                                    }
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-zinc-200">Embed Description</Label>
                                <Textarea
                                  value={entry.embed.description}
                                  className="min-h-[140px] border-zinc-800 bg-zinc-950 text-zinc-100"
                                  placeholder="Embed description"
                                  onFocus={() => setAnnouncementEmojiTarget({ kind: "embedDescription", entryId: entry.id })}
                                  onChange={(event) =>
                                    updateAnnouncementEntry(entry.id, {
                                      embed: { ...entry.embed, description: event.target.value.slice(0, 4000) },
                                    })
                                  }
                                />
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label className="text-zinc-200">Footer Text</Label>
                                  <Input
                                    value={entry.embed.footer_text}
                                    placeholder="Optional footer"
                                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                                    onFocus={() => setAnnouncementEmojiTarget({ kind: "embedFooter", entryId: entry.id })}
                                    onChange={(event) =>
                                      updateAnnouncementEntry(entry.id, {
                                        embed: { ...entry.embed, footer_text: event.target.value.slice(0, 2048) },
                                      })
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-zinc-200">Image URL</Label>
                                  <Input
                                    value={entry.embed.image_url}
                                    placeholder="https://..."
                                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                                    onChange={(event) =>
                                      updateAnnouncementEntry(entry.id, {
                                        embed: { ...entry.embed, image_url: event.target.value.slice(0, 1000) },
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {entry.type === "container" ? (
                            <div className="space-y-4">
                              <div className="flex flex-wrap gap-2">
                                <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addAnnouncementBlock(entry.id, "text")}>Add Text</Button>
                                <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addAnnouncementBlock(entry.id, "image")}>Add Image</Button>
                                <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addAnnouncementBlock(entry.id, "separator")}>Add Separator</Button>
                              </div>
                              <div className="space-y-3">
                                {entry.container_blocks.map((block, blockIndex) => (
                                  <div key={`${entry.id}-${blockIndex}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                      <Badge className="bg-zinc-800 text-zinc-100 hover:bg-zinc-800">{block.type}</Badge>
                                      <button type="button" onClick={() => removeAnnouncementBlock(entry.id, blockIndex)} className="rounded-full text-zinc-400 hover:text-red-400">
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                    {block.type === "text" ? (
                                      <Textarea
                                        value={block.content}
                                        className="min-h-[100px] border-zinc-800 bg-black text-zinc-100"
                                        placeholder="Container text"
                                        onFocus={() => setAnnouncementEmojiTarget({ kind: "containerText", entryId: entry.id, blockIndex })}
                                        onChange={(event) => updateAnnouncementBlock(entry.id, blockIndex, { content: event.target.value.slice(0, 2000) })}
                                      />
                                    ) : null}
                                    {block.type === "image" ? (
                                      <Input
                                        value={block.content}
                                        className="border-zinc-800 bg-black text-zinc-100"
                                        placeholder="https://..."
                                        onChange={(event) => updateAnnouncementBlock(entry.id, blockIndex, { content: event.target.value.slice(0, 1000) })}
                                      />
                                    ) : null}
                                    {block.type === "separator" ? (
                                      <p className="text-sm text-zinc-500">This adds a divider inside the container message.</p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                            </div>
                            <div className="self-start xl:sticky xl:top-4">
                              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-xs uppercase tracking-wider text-zinc-500">Live Preview</div>
                                    <div className="text-sm text-zinc-300">Part {entryIndex + 1} stays aligned with its editor.</div>
                                  </div>
                                  {entry.edit_existing ? (
                                    <Badge className="bg-zinc-800 text-zinc-100 hover:bg-zinc-800">Edits existing</Badge>
                                  ) : null}
                                </div>
                                {renderAnnouncementEntryPreview(entry)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>

                <div id="announcement-preview" className="hidden lg:block">
                  <div id="announcement-preview-rail" className="sticky top-0 space-y-4">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-wider text-zinc-500">Channel Summary</div>
                          <div className="text-sm text-zinc-300">Selected channels stay visible here while you edit lower parts.</div>
                        </div>
                        <Button type="button" variant="outline" className="border-zinc-800 bg-black text-zinc-100 hover:bg-zinc-900" onClick={() => scrollDialogSection("announcement-channels")}>
                          Edit
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedAnnouncementChannels.length === 0 ? (
                          <p className="text-sm text-zinc-500">
                            {announcementForm.entries.every((entry) => entry.edit_existing)
                              ? "No channels needed because every part edits an existing bot message."
                              : "No channels selected yet."}
                          </p>
                        ) : (
                          selectedAnnouncementChannels.map((channel) => (
                            <Badge key={channel.id} variant="secondary" className="border-zinc-700 bg-zinc-800 px-3 py-1 text-zinc-100">
                              #{channel.name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <div className="text-xs uppercase tracking-wider text-zinc-500">Preview Navigator</div>
                      <div className="mt-2 text-sm text-zinc-300">Click any part preview to jump straight to that editor. The full live preview stays beside each part.</div>
                    </div>

                    <div className="space-y-3">
                      {announcementForm.entries.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
                          No announcement parts to preview yet.
                        </div>
                      ) : (
                        announcementForm.entries.map((entry, entryIndex) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => scrollDialogSection(`announcement-editor-${entry.id}`)}
                            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-left transition-colors hover:border-orange-500/50 hover:bg-zinc-900"
                          >
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium text-zinc-100">Part {entryIndex + 1}</div>
                                <div className="text-xs uppercase tracking-wider text-zinc-500">{entry.type}</div>
                              </div>
                              {entry.edit_existing ? (
                                <Badge className="bg-zinc-800 text-zinc-100 hover:bg-zinc-800">Edit</Badge>
                              ) : null}
                            </div>
                            <div className="line-clamp-3 text-sm text-zinc-300">
                              {getAnnouncementPreviewSummary(entry)}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
            </div>

            <div className="sticky bottom-0 z-20 -mx-6 border-t border-zinc-800 bg-zinc-950/95 px-6 py-4 backdrop-blur">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex-1">
                  {renderStatusMessage(
                    announcementState,
                    announcementMessage,
                    "Send one or more announcement parts to the selected channels."
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => scrollDialogSection("announcement-channels")}>
                    Channels
                  </Button>
                  <Button type="button" variant="outline" className="gap-2 border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addAnnouncementEntry("normal")}>
                    <Plus className="h-4 w-4" />
                    Message
                  </Button>
                  <Button type="button" variant="outline" className="gap-2 border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addAnnouncementEntry("embed")}>
                    <Plus className="h-4 w-4" />
                    Embed
                  </Button>
                  <Button type="button" variant="outline" className="gap-2 border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addAnnouncementEntry("container")}>
                    <Plus className="h-4 w-4" />
                    Container
                  </Button>
                  <Button type="button" onClick={handleAnnouncementSend} disabled={announcementSending} className="gap-2 bg-orange-500 text-black hover:bg-orange-400">
                    <Save className="h-4 w-4" />
                    {announcementSending ? "Sending..." : "Send Announcement"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={premiumFeatureOpen} onOpenChange={setPremiumFeatureOpen}>
          <DialogContent className="max-h-[92vh] max-w-[min(95vw,1440px)] overflow-y-auto border-border/70 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Star className="h-5 w-5 text-amber-400" />
                Premium Feature #1
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Create role-gated trigger replies with container media, optional footer text, trigger deletion, and one shared cooldown across all triggers.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.72fr)]">
                <div className="space-y-6">
                <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-zinc-100">Feature Status</div>
                    <div className="text-sm text-zinc-400">
                      {premiumFeatureForm.enabled
                        ? "Allowed roles can trigger these replies until you disable the feature or change the trigger list."
                        : "Premium Feature #1 is currently paused."}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label htmlFor="premium-feature-enabled" className="text-sm text-zinc-200">Enabled</Label>
                    <Switch
                      id="premium-feature-enabled"
                      checked={premiumFeatureForm.enabled}
                      onCheckedChange={(checked) => setPremiumFeatureForm((current) => ({ ...current, enabled: checked }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                  <div className="space-y-2">
                    <Label htmlFor="premium-feature-cooldown" className="text-zinc-200">Shared Cooldown (seconds)</Label>
                    <Input
                      id="premium-feature-cooldown"
                      type="number"
                      min={0}
                      value={premiumFeatureForm.cooldown_seconds}
                      className="border-zinc-800 bg-zinc-950 text-zinc-100"
                      onChange={(event) =>
                        setPremiumFeatureForm((current) => ({
                          ...current,
                          cooldown_seconds: Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0),
                        }))
                      }
                    />
                    <p className="text-xs text-zinc-500">
                      This cooldown is shared across every trigger in this feature for the same user.
                    </p>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2 border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                      onClick={handlePremiumFeatureReload}
                      disabled={premiumFeatureReloading || premiumFeatureSaving}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      {premiumFeatureReloading ? "Reloading..." : "Reload"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-zinc-100">Webhook Delivery</div>
                      <div className="text-sm text-zinc-400">
                        If enabled, trigger responses use the webhook URL below instead of sending through the bot account.
                      </div>
                    </div>
                    <Switch
                      checked={premiumFeatureForm.webhook_enabled}
                      onCheckedChange={(checked) =>
                        setPremiumFeatureForm((current) => ({
                          ...current,
                          webhook_enabled: checked,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="premium-feature-webhook" className="text-zinc-200">Webhook URL</Label>
                    <Input
                      id="premium-feature-webhook"
                      value={premiumFeatureForm.webhook_url}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="border-zinc-800 bg-zinc-950 text-zinc-100"
                      onChange={(event) =>
                        setPremiumFeatureForm((current) => ({
                          ...current,
                          webhook_url: event.target.value.slice(0, 500),
                        }))
                      }
                    />
                    <p className="text-xs text-zinc-500">
                      Use a Discord webhook URL. If webhook delivery fails, the bot will fall back to normal channel sending.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-zinc-200">Allowed Roles</Label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setPremiumRolePickerOpen((current) => !current)}
                      className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100"
                    >
                      <span>
                        {selectedPremiumRoles.length > 0
                          ? `${selectedPremiumRoles.length} role${selectedPremiumRoles.length === 1 ? "" : "s"} selected`
                          : "Open role dropdown"}
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${premiumRolePickerOpen ? "rotate-180" : ""}`} />
                    </button>

                    {premiumRolePickerOpen && (
                      <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-800 bg-black shadow-2xl">
                        <div className="border-b border-zinc-800 p-3">
                          <Input
                            placeholder="Type a role name to filter..."
                            value={premiumRoleQuery}
                            className="border-zinc-800 bg-zinc-950 text-zinc-100"
                            onChange={(event) => setPremiumRoleQuery(event.target.value)}
                            onFocus={() => setPremiumRolePickerOpen(true)}
                          />
                          {roleLoadMessage && (
                            <p className="mt-2 text-xs text-red-400">{roleLoadMessage}</p>
                          )}
                        </div>
                        <div className="max-h-72 overflow-y-auto p-2">
                          {filteredPremiumRoles.length === 0 ? (
                            <div className="rounded-lg px-3 py-4 text-sm text-zinc-500">No roles match that search.</div>
                          ) : (
                            filteredPremiumRoles.map((role) => {
                              const selected = premiumFeatureForm.role_ids.includes(role.id);
                              return (
                                <button
                                  key={role.id}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => togglePremiumRole(role.id)}
                                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                    selected ? "bg-zinc-800 text-zinc-100" : "text-zinc-300 hover:bg-zinc-900"
                                  }`}
                                >
                                  <span>{role.name}</span>
                                  {selected ? (
                                    <Badge className="bg-amber-500 text-black hover:bg-amber-500">Selected</Badge>
                                  ) : null}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedPremiumRoles.length === 0 ? (
                      <p className="text-sm text-zinc-500">No roles selected yet.</p>
                    ) : (
                      selectedPremiumRoles.map((role) => (
                        <Badge key={role.id} variant="secondary" className="border-zinc-700 bg-zinc-800 px-3 py-1 text-zinc-100">
                          @{role.name}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-zinc-200">Triggers</Label>
                      <p className="text-xs text-zinc-500">Case does not matter. The trigger must match the message text exactly after trimming.</p>
                    </div>
                    <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={addPremiumTrigger}>
                      Add Trigger
                    </Button>
                  </div>

                  {premiumFeatureForm.triggers.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
                      No triggers yet. Add one to define a phrase and the container response links that should appear.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {premiumFeatureForm.triggers.map((trigger, index) => (
                        <div key={trigger.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-medium text-zinc-100">Trigger {index + 1}</div>
                              <div className="text-xs text-zinc-500">{trigger.trigger || "No trigger phrase yet"}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="gap-2 border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                                onClick={() => {
                                  setActivePremiumPreviewId(trigger.id);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                                Preview
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="border-zinc-800 bg-zinc-950 px-3 text-zinc-100 hover:bg-zinc-900"
                                onClick={() => togglePremiumTriggerExpansion(trigger.id)}
                              >
                                <ChevronDown className={`h-4 w-4 transition-transform ${expandedPremiumTriggerIds.includes(trigger.id) ? "rotate-180" : "-rotate-90"}`} />
                              </Button>
                              <button type="button" onClick={() => removePremiumTrigger(trigger.id)} className="rounded-full text-zinc-400 hover:text-red-400">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {expandedPremiumTriggerIds.includes(trigger.id) ? (
                            <>
                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label className="text-zinc-200">Trigger Text</Label>
                                  <Input
                                    value={trigger.trigger}
                                    placeholder="Type the exact trigger phrase"
                                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                                    onChange={(event) => updatePremiumTrigger(trigger.id, { trigger: event.target.value.slice(0, 100) })}
                                  />
                                </div>
                                <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
                                  <div>
                                    <div className="font-medium text-zinc-100">Delete Trigger Message</div>
                                    <div className="text-xs text-zinc-500">Remove the user&apos;s trigger message before posting the container response.</div>
                                  </div>
                                  <Switch
                                    checked={trigger.delete_trigger_message}
                                    onCheckedChange={(checked) => updatePremiumTrigger(trigger.id, { delete_trigger_message: checked })}
                                  />
                                </div>
                              </div>

                              <div className="mt-4 flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
                                <div>
                                  <div className="font-medium text-zinc-100">Use Main Allowed Roles</div>
                                  <div className="text-xs text-zinc-500">Turn this off if this trigger should use its own private role list instead of the main one above.</div>
                                </div>
                                <Switch
                                  checked={trigger.use_main_roles}
                                  onCheckedChange={(checked) =>
                                    updatePremiumTrigger(trigger.id, {
                                      use_main_roles: checked,
                                      role_ids: checked ? [] : trigger.role_ids,
                                    })
                                  }
                                />
                              </div>

                              {!trigger.use_main_roles ? (
                                <div className="mt-4 space-y-3">
                                  <Label className="text-zinc-200">Trigger-Specific Roles</Label>
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPremiumTriggerRolePickerId((current) => current === trigger.id ? "" : trigger.id);
                                        setPremiumTriggerRoleQuery("");
                                      }}
                                      className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100"
                                    >
                                      <span>
                                        {trigger.role_ids.length > 0
                                          ? `${trigger.role_ids.length} role${trigger.role_ids.length === 1 ? "" : "s"} selected`
                                          : "Open role dropdown"}
                                      </span>
                                      <ChevronDown className={`h-4 w-4 transition-transform ${premiumTriggerRolePickerId === trigger.id ? "rotate-180" : ""}`} />
                                    </button>

                                    {premiumTriggerRolePickerId === trigger.id ? (
                                      <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-800 bg-black shadow-2xl">
                                        <div className="border-b border-zinc-800 p-3">
                                          <Input
                                            placeholder="Type a role name to filter..."
                                            value={premiumTriggerRoleQuery}
                                            className="border-zinc-800 bg-zinc-950 text-zinc-100"
                                            onChange={(event) => setPremiumTriggerRoleQuery(event.target.value)}
                                            onFocus={() => setPremiumTriggerRolePickerId(trigger.id)}
                                          />
                                        </div>
                                        <div className="max-h-72 overflow-y-auto p-2">
                                          {filteredPremiumTriggerRoles.length === 0 ? (
                                            <div className="rounded-lg px-3 py-4 text-sm text-zinc-500">No roles match that search.</div>
                                          ) : (
                                            filteredPremiumTriggerRoles.map((role) => {
                                              const selected = trigger.role_ids.includes(role.id);
                                              return (
                                                <button
                                                  key={role.id}
                                                  type="button"
                                                  onMouseDown={(event) => event.preventDefault()}
                                                  onClick={() => togglePremiumTriggerRole(trigger.id, role.id)}
                                                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                                    selected ? "bg-zinc-800 text-zinc-100" : "text-zinc-300 hover:bg-zinc-900"
                                                  }`}
                                                >
                                                  <span>{role.name}</span>
                                                  {selected ? (
                                                    <Badge className="bg-amber-500 text-black hover:bg-amber-500">Selected</Badge>
                                                  ) : null}
                                                </button>
                                              );
                                            })
                                          )}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {trigger.role_ids.length === 0 ? (
                                      <p className="text-sm text-zinc-500">No trigger-specific roles selected yet.</p>
                                    ) : (
                                      roles
                                        .filter((role) => trigger.role_ids.includes(role.id))
                                        .map((role) => (
                                          <Badge key={role.id} variant="secondary" className="border-zinc-700 bg-zinc-800 px-3 py-1 text-zinc-100">
                                            @{role.name}
                                          </Badge>
                                        ))
                                    )}
                                  </div>
                                </div>
                              ) : null}

                              <div className="mt-4 space-y-2">
                                <Label className="text-zinc-200">Response Links</Label>
                                <Textarea
                                  value={trigger.response_links.join("\n")}
                                  placeholder={"https://...\nhttps://..."}
                                  className="min-h-[120px] border-zinc-800 bg-zinc-950 text-zinc-100"
                                  onChange={(event) =>
                                    updatePremiumTrigger(trigger.id, {
                                      response_links: sanitizePremiumLinks(event.target.value),
                                    })
                                  }
                                />
                                <p className="text-xs text-zinc-500">
                                  Add image or GIF links separated by commas or new lines. They will be rendered inside the container.
                                </p>
                              </div>

                              <div className="mt-4 space-y-2">
                                <Label className="text-zinc-200">Footer Text</Label>
                                <Input
                                  value={trigger.footer_text}
                                  placeholder="Optional footer text"
                                  className="border-zinc-800 bg-zinc-950 text-zinc-100"
                                  onChange={(event) => updatePremiumTrigger(trigger.id, { footer_text: event.target.value.slice(0, 500) })}
                                />
                              </div>
                            </>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>

                <div className="hidden lg:block">
                  <div className="sticky top-0 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs uppercase tracking-wider text-zinc-500">Trigger Preview</div>
                      {activePremiumPreview ? (
                        <Badge className="border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-800">
                          {activePremiumPreview.trigger || "No trigger phrase yet"}
                        </Badge>
                      ) : null}
                    </div>

                    {!activePremiumPreview ? (
                      <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
                        Pick a trigger preview from the config tab.
                      </div>
                    ) : (
                      <div className="space-y-3 rounded-2xl border border-zinc-700 bg-black p-4">
                        {activePremiumPreview.response_links.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
                            Add at least one response link to see the container preview.
                          </div>
                        ) : (
                          activePremiumPreview.response_links.map((link, index) => (
                            <img key={`${link}-${index}`} src={link} alt="Premium trigger preview" className="max-h-72 w-full rounded-xl border border-zinc-800 object-cover" />
                          ))
                        )}

                        {activePremiumPreview.footer_text ? (
                          <>
                            <div className="h-px w-full bg-zinc-800" />
                            <div className="whitespace-pre-wrap text-sm text-zinc-300">{renderPreviewText(activePremiumPreview.footer_text)}</div>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4 lg:hidden">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wider text-zinc-500">Trigger Preview</div>
                    {activePremiumPreview ? (
                      <Badge className="border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-800">
                        {activePremiumPreview.trigger || "No trigger phrase yet"}
                      </Badge>
                    ) : null}
                  </div>

                  {!activePremiumPreview ? (
                    <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
                      Pick a trigger preview from the config tab.
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-2xl border border-zinc-700 bg-black p-4">
                      {activePremiumPreview.response_links.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
                          Add at least one response link to see the container preview.
                        </div>
                      ) : (
                        activePremiumPreview.response_links.map((link, index) => (
                          <img key={`${link}-${index}`} src={link} alt="Premium trigger preview" className="max-h-72 w-full rounded-xl border border-zinc-800 object-cover" />
                        ))
                      )}

                      {activePremiumPreview.footer_text ? (
                        <>
                          <div className="h-px w-full bg-zinc-800" />
                          <div className="whitespace-pre-wrap text-sm text-zinc-300">{renderPreviewText(activePremiumPreview.footer_text)}</div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
                </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
              {renderStatusMessage(
                premiumFeatureSaveState,
                premiumFeatureSaveMessage,
                "Save to sync the allowed roles, trigger list, shared cooldown, and container replies."
              )}
              <Button type="button" onClick={handlePremiumFeatureSave} disabled={premiumFeatureSaving} className="gap-2 bg-amber-500 text-black hover:bg-amber-400">
                <Save className="h-4 w-4" />
                {premiumFeatureSaving ? "Saving..." : hasPersistedPremiumFeatureConfig ? "Update Config" : "Save Config"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={dmWelcomerOpen} onOpenChange={setDmWelcomerOpen}>
          <DialogContent className="max-h-[92vh] max-w-[min(94vw,1080px)] overflow-y-auto border-border/70 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <LogIn className="h-5 w-5 text-green-400" />
                DM Welcomer
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Send a direct-message welcome when someone joins. Available placeholders: <code>{"{username}"}</code>, <code>{"{server_name}"}</code>, and <code>{"{mention}"}</code>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-zinc-100">DM Status</div>
                  <div className="text-sm text-zinc-400">
                    {dmWelcomerForm.enabled ? "New members will receive this DM after joining if their privacy settings allow it." : "The DM welcomer is currently paused."}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="dm-welcomer-enabled" className="text-sm text-zinc-200">Enabled</Label>
                  <Switch
                    id="dm-welcomer-enabled"
                    checked={dmWelcomerForm.enabled}
                    onCheckedChange={(checked) => setDmWelcomerForm((current) => ({ ...current, enabled: checked }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dm-welcomer-title" className="text-zinc-200">Title</Label>
                <Input
                  id="dm-welcomer-title"
                  value={dmWelcomerForm.title}
                  className="border-zinc-800 bg-zinc-950 text-zinc-100"
                  onChange={(event) =>
                    setDmWelcomerForm((current) => ({
                      ...current,
                      title: event.target.value.slice(0, 120),
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dm-welcomer-message" className="text-zinc-200">Message</Label>
                <Textarea
                  id="dm-welcomer-message"
                  value={dmWelcomerForm.message}
                  className="min-h-[140px] border-zinc-800 bg-zinc-950 text-zinc-100"
                  onChange={(event) =>
                    setDmWelcomerForm((current) => ({
                      ...current,
                      message: event.target.value.slice(0, 1200),
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dm-welcomer-image" className="text-zinc-200">Banner Image URL</Label>
                <Input
                  id="dm-welcomer-image"
                  value={dmWelcomerForm.image_url}
                  placeholder="https://..."
                  className="border-zinc-800 bg-zinc-950 text-zinc-100"
                  onChange={(event) =>
                    setDmWelcomerForm((current) => ({
                      ...current,
                      image_url: event.target.value.slice(0, 300),
                    }))
                  }
                />
              </div>

              <div className="rounded-2xl border border-green-900/50 bg-green-500/5 p-4 text-sm text-green-100">
                <div className="font-medium">Preview</div>
                <div className="mt-2 text-green-200/90">{dmWelcomerForm.title || DEFAULT_DM_WELCOMER_CONFIG.title}</div>
                <div className="mt-2 whitespace-pre-wrap text-zinc-300">{dmWelcomerForm.message || DEFAULT_DM_WELCOMER_CONFIG.message}</div>
              </div>

              <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                {renderStatusMessage(
                  dmWelcomerSaveState,
                  dmWelcomerSaveMessage,
                  "Save the DM welcomer to update what new members receive after joining."
                )}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                    onClick={handleDmWelcomerReload}
                    disabled={dmWelcomerReloading || dmWelcomerSaving}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {dmWelcomerReloading ? "Reloading..." : "Reload"}
                  </Button>
                  <Button type="button" onClick={() => handleDmWelcomerSave()} disabled={dmWelcomerSaving} className="gap-2 bg-green-600 text-white hover:bg-green-500">
                    <Save className="h-4 w-4" />
                    {dmWelcomerSaving ? "Saving..." : hasPersistedDmWelcomerConfig ? "Update Config" : "Save Config"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={botLooksOpen} onOpenChange={setBotLooksOpen}>
          <DialogContent className="max-h-[92vh] max-w-[min(94vw,1080px)] overflow-y-auto border-border/70 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-cyan-400" />
                Bot Looks
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Change the bot&apos;s documented Discord presence fields from the web. This is global bot presence, so if the bot joins multiple servers the last applied Bot Looks config wins.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-zinc-100">Presence Status</div>
                  <div className="text-sm text-zinc-400">
                    {botLooksForm.enabled ? "Bot Looks is active and will be restored on startup until you change or reset it." : "Bot Looks is currently off and the bot stays on its default Discord presence."}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="bot-looks-enabled" className="text-sm text-zinc-200">Enabled</Label>
                  <Switch
                    id="bot-looks-enabled"
                    checked={botLooksForm.enabled}
                    onCheckedChange={(checked) => setBotLooksForm((current) => ({ ...current, enabled: checked }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-zinc-200">Online Status</Label>
                  <Select
                    value={botLooksForm.status}
                    onValueChange={(value) =>
                      setBotLooksForm((current) => ({
                        ...current,
                        status: value as BotLooksConfig["status"],
                      }))
                    }
                  >
                    <SelectTrigger className="border-zinc-800 bg-black text-zinc-100">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-black text-zinc-100">
                      <SelectItem value="online" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Online</SelectItem>
                      <SelectItem value="idle" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Idle</SelectItem>
                      <SelectItem value="dnd" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Do Not Disturb</SelectItem>
                      <SelectItem value="invisible" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Invisible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-200">Activity Mode</Label>
                  <Select
                    value={botLooksForm.activity_type}
                    onValueChange={(value) =>
                      setBotLooksForm((current) => ({
                        ...current,
                        activity_type: value as BotLooksConfig["activity_type"],
                      }))
                    }
                  >
                    <SelectTrigger className="border-zinc-800 bg-black text-zinc-100">
                      <SelectValue placeholder="Select activity mode" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-black text-zinc-100">
                      <SelectItem value="custom" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Custom Status</SelectItem>
                      <SelectItem value="playing" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Playing</SelectItem>
                      <SelectItem value="streaming" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Streaming</SelectItem>
                      <SelectItem value="listening" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Listening</SelectItem>
                      <SelectItem value="watching" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Watching</SelectItem>
                      <SelectItem value="competing" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Competing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bot-looks-activity" className="text-zinc-200">
                    {botLooksForm.activity_type === "custom" ? "Fallback Activity Text" : "Activity Text"}
                  </Label>
                  <Input
                    id="bot-looks-activity"
                    value={botLooksForm.activity_text}
                    maxLength={128}
                    placeholder={botLooksForm.activity_type === "custom" ? "Used only if custom status is empty" : "What the bot should show"}
                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                    onChange={(event) =>
                      setBotLooksForm((current) => ({
                        ...current,
                        activity_text: event.target.value.slice(0, 128),
                      }))
                    }
                  />
                  <p className="text-xs text-zinc-500">
                    {botLooksForm.activity_type === "custom"
                      ? "Custom Status uses the field below first. This text is only used as fallback."
                      : "This is the visible activity name shown by Discord."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bot-looks-custom" className="text-zinc-200">Custom Status Text</Label>
                  <Input
                    id="bot-looks-custom"
                    value={botLooksForm.custom_status}
                    maxLength={128}
                    placeholder="Only used when Activity Mode is Custom Status"
                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                    onChange={(event) =>
                      setBotLooksForm((current) => ({
                        ...current,
                        custom_status: event.target.value.slice(0, 128),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bot-looks-streaming" className="text-zinc-200">Streaming URL</Label>
                <Input
                  id="bot-looks-streaming"
                  value={botLooksForm.streaming_url}
                  placeholder="https://twitch.tv/yourchannel"
                  className="border-zinc-800 bg-zinc-950 text-zinc-100"
                  disabled={botLooksForm.activity_type !== "streaming"}
                  onChange={(event) =>
                    setBotLooksForm((current) => ({
                      ...current,
                      streaming_url: event.target.value.slice(0, 256),
                    }))
                  }
                />
                <p className="text-xs text-zinc-500">
                  Only used for Streaming mode. Unsupported profile-only fields like pronouns, about me, name styles, effects, colors, and nameplates are intentionally not exposed here because bots cannot set them through Discord&apos;s documented API.
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-900/50 bg-cyan-500/5 p-4 text-sm text-cyan-100">
                <div className="font-medium">Preview</div>
                <div className="mt-2 text-cyan-200/90">{botLooksSummary}</div>
              </div>

              <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4">
                {renderStatusMessage(
                  botLooksSaveState,
                  botLooksSaveMessage,
                  "Save & apply updates the live bot presence immediately and restores it again on startup."
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                      onClick={handleBotLooksReload}
                      disabled={botLooksReloading || botLooksSaving || botLooksResetting}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      {botLooksReloading ? "Reloading..." : "Reload"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 border-red-900/80 bg-red-950/40 text-red-200 hover:bg-red-950"
                      onClick={handleBotLooksReset}
                      disabled={botLooksResetting || botLooksSaving || botLooksReloading}
                    >
                      <X className="h-4 w-4" />
                      {botLooksResetting ? "Resetting..." : "Reset"}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleBotLooksSave()}
                    disabled={botLooksSaving || botLooksResetting}
                    className="gap-2 bg-cyan-600 text-white hover:bg-cyan-500"
                  >
                    <Save className="h-4 w-4" />
                    {botLooksSaving ? "Saving..." : hasPersistedBotLooksConfig ? "Update & Apply" : "Save & Apply"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={roleColorOpen} onOpenChange={setRoleColorOpen}>
          <DialogContent className="max-h-[92vh] max-w-[min(94vw,1080px)] overflow-y-auto border-border/70 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Palette className="h-5 w-5 text-pink-400" />
                Randomized Role Color
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Pick the roles that should rotate colors forever, choose the interval, and toggle the feature on. Discord command toggle: <code>/randomizedrolecolor enabled:true|false</code>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-zinc-100">Rotation Status</div>
                  <div className="text-sm text-zinc-400">
                    {roleColorForm.enabled ? "The backend timer will keep rotating selected roles until disabled." : "Rotation is currently paused."}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="role-color-enabled" className="text-sm text-zinc-200">Enabled</Label>
                  <Switch
                    id="role-color-enabled"
                    checked={roleColorForm.enabled}
                    onCheckedChange={(checked) => setRoleColorForm((current) => ({ ...current, enabled: checked }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_180px_160px]">
                <div className="space-y-2">
                  <Label htmlFor="role-interval-value" className="text-zinc-200">Interval</Label>
                  <Input
                    id="role-interval-value"
                    type="number"
                    min={1}
                    value={roleColorForm.interval_value}
                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                    onChange={(event) =>
                      setRoleColorForm((current) => ({
                        ...current,
                        interval_value: clampRoleIntervalValue(
                          Number.parseInt(event.target.value || "1", 10) || 1,
                          current.interval_unit
                        ),
                      }))
                    }
                  />
                  <p className="text-xs text-zinc-500">
                    Seconds mode has a minimum of {MIN_ROLE_SECONDS_INTERVAL} seconds to avoid unnecessary Discord API churn.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-200">Unit</Label>
                  <Select
                    value={roleColorForm.interval_unit}
                    onValueChange={(value) =>
                      setRoleColorForm((current) => ({
                        ...current,
                        interval_unit: value as RoleColorConfig["interval_unit"],
                        interval_value: clampRoleIntervalValue(current.interval_value, value as RoleColorConfig["interval_unit"]),
                      }))
                    }
                  >
                    <SelectTrigger className="border-zinc-800 bg-black text-zinc-100">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-black text-zinc-100">
                      <SelectItem value="seconds" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Seconds</SelectItem>
                      <SelectItem value="minutes" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Minutes</SelectItem>
                      <SelectItem value="hours" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                    onClick={handleRoleColorReload}
                    disabled={roleColorReloading || roleColorSaving}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {roleColorReloading ? "Reloading..." : "Reload"}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="role-search" className="text-zinc-200">Choose Roles</Label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setRolePickerOpen((current) => !current)}
                    className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100"
                  >
                    <span>
                      {selectedRoleColors.length > 0 ? `${selectedRoleColors.length} role${selectedRoleColors.length === 1 ? "" : "s"} selected` : "Open role dropdown"}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${rolePickerOpen ? "rotate-180" : ""}`} />
                  </button>

                  {rolePickerOpen && (
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-800 bg-black shadow-2xl">
                      <div className="border-b border-zinc-800 p-3">
                        <Input
                          id="role-search"
                          placeholder="Type a role name to filter..."
                          value={roleQuery}
                          className="border-zinc-800 bg-zinc-950 text-zinc-100"
                          onChange={(event) => setRoleQuery(event.target.value)}
                          onFocus={() => setRolePickerOpen(true)}
                        />
                        <p className="mt-2 text-xs text-zinc-500">
                          {availableRoleCount} server roles available. Roles above the bot or managed by integrations will show as unavailable.
                        </p>
                        {roleLoadMessage && (
                          <p className="mt-2 text-xs text-red-400">{roleLoadMessage}</p>
                        )}
                      </div>
                      <div className="max-h-72 overflow-y-auto p-2">
                        {filteredRoles.length === 0 ? (
                          <div className="rounded-lg px-3 py-4 text-sm text-zinc-500">No roles match that search.</div>
                        ) : (
                          filteredRoles.map((role) => {
                            const selected = roleColorForm.role_ids.includes(role.id);
                            const disabled = !role.editable;
                            return (
                              <button
                                key={role.id}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  if (disabled) return;
                                  toggleRole(role.id);
                                }}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                  disabled
                                    ? "cursor-not-allowed opacity-55"
                                    : selected
                                      ? "bg-zinc-800 text-zinc-100"
                                      : "text-zinc-300 hover:bg-zinc-900"
                                }`}
                                disabled={disabled}
                              >
                                <div>
                                  <div className="font-medium">{role.name}</div>
                                  <div className="text-xs text-zinc-500">{role.id}</div>
                                </div>
                                {disabled ? (
                                  <Badge variant="outline" className="border-zinc-700 text-zinc-400">Unavailable</Badge>
                                ) : selected ? (
                                  <Badge className="bg-pink-600 text-white hover:bg-pink-600">Selected</Badge>
                                ) : null}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedRoleColors.length === 0 ? (
                  <p className="text-sm text-zinc-500">No roles selected yet.</p>
                ) : (
                  selectedRoleColors.map((role) => (
                    <Badge key={role.id} variant="secondary" className="gap-2 border-zinc-700 bg-zinc-800 px-3 py-1 text-zinc-100">
                      <span>{role.name}</span>
                      <button type="button" onClick={() => toggleRole(role.id)} className="rounded-full hover:text-red-400">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                {renderStatusMessage(
                  roleColorSaveState,
                  roleColorSaveMessage,
                  "Save the community config to sync the indefinite timer in the backend."
                )}
                <Button type="button" onClick={handleRoleColorSave} disabled={roleColorSaving} className="gap-2 bg-pink-600 text-white hover:bg-pink-500">
                  <Save className="h-4 w-4" />
                  {roleColorSaving ? "Saving..." : hasPersistedRoleColorConfig ? "Update Config" : "Save Config"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={memeOpen} onOpenChange={setMemeOpen}>
          <DialogContent className="max-h-[92vh] max-w-[min(94vw,1080px)] overflow-y-auto border-border/70 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <ImageIcon className="h-5 w-5 text-blue-400" />
                Meme Autopost
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Schedule random Reddit image posts into a chosen channel, optionally ping a role, and manage subreddits here. Discord status command: <code>/memes autopost</code>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-zinc-100">Autopost Status</div>
                  <div className="text-sm text-zinc-400">
                    {memeForm.enabled ? "The backend timer will keep pulling random Reddit image posts until disabled." : "Meme autopost is currently paused."}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="meme-enabled" className="text-sm text-zinc-200">Enabled</Label>
                  <Switch
                    id="meme-enabled"
                    checked={memeForm.enabled}
                    onCheckedChange={(checked) => setMemeForm((current) => ({ ...current, enabled: checked }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_180px_160px]">
                <div className="space-y-2">
                  <Label htmlFor="meme-interval-value" className="text-zinc-200">Interval</Label>
                  <Input
                    id="meme-interval-value"
                    type="number"
                    min={1}
                    value={memeForm.interval_value}
                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                    onChange={(event) =>
                      setMemeForm((current) => ({
                        ...current,
                        interval_value: clampMemeIntervalValue(
                          Number.parseInt(event.target.value || "30", 10) || 30,
                          current.interval_unit
                        ),
                      }))
                    }
                  />
                  <p className="text-xs text-zinc-500">
                    Seconds mode has a minimum of {MIN_MEME_SECONDS_INTERVAL} seconds to avoid unnecessary Reddit and Discord API churn.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-200">Unit</Label>
                  <Select
                    value={memeForm.interval_unit}
                    onValueChange={(value) =>
                      setMemeForm((current) => ({
                        ...current,
                        interval_unit: value as MemeAutopostConfig["interval_unit"],
                        interval_value: clampMemeIntervalValue(current.interval_value, value as MemeAutopostConfig["interval_unit"]),
                      }))
                    }
                  >
                    <SelectTrigger className="border-zinc-800 bg-black text-zinc-100">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-black text-zinc-100">
                      <SelectItem value="seconds" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Seconds</SelectItem>
                      <SelectItem value="minutes" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Minutes</SelectItem>
                      <SelectItem value="hours" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                    onClick={handleMemeReload}
                    disabled={memeReloading || memeSaving}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {memeReloading ? "Reloading..." : "Reload"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-zinc-200">Target Channel</Label>
                  <Select
                    value={memeForm.channel_id || "__none__"}
                    onValueChange={(value) =>
                      setMemeForm((current) => ({
                        ...current,
                        channel_id: value === "__none__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className="border-zinc-800 bg-black text-zinc-100">
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-black text-zinc-100">
                      <SelectItem value="__none__" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">No channel selected</SelectItem>
                      {channels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                          #{channel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {channelLoadMessage && (
                    <p className="text-xs text-red-400">{channelLoadMessage}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-200">Ping Role</Label>
                  <Select
                    value={memeForm.ping_role_id || "__none__"}
                    onValueChange={(value) =>
                      setMemeForm((current) => ({
                        ...current,
                        ping_role_id: value === "__none__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className="border-zinc-800 bg-black text-zinc-100">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-black text-zinc-100">
                      <SelectItem value="__none__" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">No ping role</SelectItem>
                      {selectablePingRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                          @{role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="subreddits" className="text-zinc-200">Subreddits</Label>
                <Textarea
                  id="subreddits"
                  value={subredditDraft}
                  onChange={(event) => setSubredditDraft(event.target.value)}
                  placeholder="memes, dankmemes, wholesomememes"
                  className="min-h-[120px] border-zinc-800 bg-zinc-950 text-zinc-100"
                />
                <p className="text-xs text-zinc-500">
                  Separate subreddit names with commas or new lines. Use plain names like <code>memes</code>, not full URLs.
                </p>
                <div className="flex flex-wrap gap-2">
                  {memeSubredditPreview.length === 0 ? (
                    <p className="text-sm text-zinc-500">No subreddits selected yet.</p>
                  ) : (
                    memeSubredditPreview.map((subreddit) => (
                      <Badge key={subreddit} variant="secondary" className="border-zinc-700 bg-zinc-800 px-3 py-1 text-zinc-100">
                        r/{subreddit}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                {renderStatusMessage(
                  memeSaveState,
                  memeSaveMessage,
                  "Save the community config to start or stop the Reddit autopost timer in the backend."
                )}
                <Button type="button" onClick={handleMemeSave} disabled={memeSaving} className="gap-2 bg-blue-600 text-white hover:bg-blue-500">
                  <Save className="h-4 w-4" />
                  {memeSaving ? "Saving..." : hasPersistedMemeConfig ? "Update Config" : "Save Config"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
