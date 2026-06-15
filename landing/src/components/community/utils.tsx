import type { ReactNode } from "react";
import type { SaveState, RoleColorConfig, MemeAutopostConfig, BotLooksConfig, ProfileStyleConfig, DmWelcomerConfig, PremiumFeatureConfig, PremiumFeatureTrigger } from "./types";

export const MIN_ROLE_SECONDS_INTERVAL = 10;
export const MIN_MEME_SECONDS_INTERVAL = 30;

export const DEFAULT_ROLE_COLOR_CONFIG: RoleColorConfig = {
  enabled: false,
  interval_value: 1,
  interval_unit: "minutes",
  role_ids: [],
};

export const DEFAULT_MEME_AUTPOST_CONFIG: MemeAutopostConfig = {
  enabled: false,
  interval_value: 30,
  interval_unit: "minutes",
  channel_id: "",
  ping_role_id: "",
  subreddits: [],
};

export const DEFAULT_BOT_LOOKS_CONFIG: BotLooksConfig = {
  enabled: false,
  status: "online",
  activity_type: "custom",
  activity_text: "",
  custom_status: "",
  streaming_url: "",
};

export const DEFAULT_PROFILE_STYLE_CONFIG: ProfileStyleConfig = {
  enabled: false,
  font_id: 11,
  effect_id: 1,
  colors: [],
};

export const PROFILE_STYLE_FONTS = [
  { id: 1, label: "Bangers" },
  { id: 2, label: "Bio Rhyme" },
  { id: 3, label: "Cherry Bomb" },
  { id: 4, label: "Chicle" },
  { id: 5, label: "Compagnon" },
  { id: 6, label: "Museo Moderno" },
  { id: 7, label: "Neo Castel" },
  { id: 8, label: "Pixelify" },
  { id: 9, label: "Ribes" },
  { id: 10, label: "Sinistre" },
  { id: 11, label: "Default" },
  { id: 12, label: "Zilla Slab" },
];

export const PROFILE_STYLE_EFFECTS = [
  { id: 1, label: "Solid" },
  { id: 2, label: "Gradient" },
  { id: 3, label: "Neon" },
  { id: 4, label: "Toon" },
  { id: 5, label: "Pop" },
  { id: 6, label: "Glow" },
];

export const DEFAULT_DM_WELCOMER_CONFIG: DmWelcomerConfig = {
  enabled: false,
  title: "Welcome to {server_name}",
  message: "Hey {username}, welcome to {server_name}. We are glad to have you here.",
  image_url: "",
};

export const DEFAULT_PREMIUM_FEATURE_CONFIG: PremiumFeatureConfig = {
  enabled: false,
  cooldown_seconds: 0,
  webhook_enabled: false,
  webhook_url: "",
  role_ids: [],
  triggers: [],
};

export function decimalToHexColor(value: number) {
  return `#${value.toString(16).padStart(6, "0").toUpperCase()}`;
}

export function parseHexColor(value: string) {
  const trimmed = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return null;
  }
  return Number.parseInt(trimmed, 16);
}

export function clampRoleIntervalValue(value: number, unit: RoleColorConfig["interval_unit"]) {
  const normalized = Math.max(1, value || 1);
  if (unit === "seconds") {
    return Math.max(MIN_ROLE_SECONDS_INTERVAL, normalized);
  }
  return normalized;
}

export function clampMemeIntervalValue(value: number, unit: MemeAutopostConfig["interval_unit"]) {
  const normalized = Math.max(1, value || 1);
  if (unit === "seconds") {
    return Math.max(MIN_MEME_SECONDS_INTERVAL, normalized);
  }
  return normalized;
}

export function sanitizeSubreddits(value: string | string[]) {
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

export function sanitizePremiumLinks(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter((entry) => /^https?:\/\//i.test(entry))
    )
  );
}

export function normalizeRoleColorConfig(config: Record<string, any> | null | undefined): RoleColorConfig {
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

export function normalizeMemeAutopostConfig(config: Record<string, any> | null | undefined): MemeAutopostConfig {
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

export function normalizeBotLooksConfig(config: Record<string, any> | null | undefined): BotLooksConfig {
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

export function normalizeProfileStyleConfig(config: Record<string, any> | null | undefined): ProfileStyleConfig {
  const fontId = PROFILE_STYLE_FONTS.some((entry) => entry.id === Number(config?.font_id))
    ? Number(config?.font_id)
    : DEFAULT_PROFILE_STYLE_CONFIG.font_id;
  const effectId = PROFILE_STYLE_EFFECTS.some((entry) => entry.id === Number(config?.effect_id))
    ? Number(config?.effect_id)
    : DEFAULT_PROFILE_STYLE_CONFIG.effect_id;

  return {
    enabled: Boolean(config?.enabled),
    font_id: fontId,
    effect_id: effectId,
    colors: Array.isArray(config?.colors)
      ? config.colors
          .map((value: unknown) => Number.parseInt(String(value ?? ""), 10))
          .filter((value: number) => Number.isFinite(value) && value >= 0 && value <= 0xffffff)
          .slice(0, 2)
      : [],
  };
}

export function normalizeDmWelcomerConfig(config: Record<string, any> | null | undefined): DmWelcomerConfig {
  return {
    enabled: Boolean(config?.enabled),
    title: String(config?.title ?? DEFAULT_DM_WELCOMER_CONFIG.title).trim().slice(0, 120) || DEFAULT_DM_WELCOMER_CONFIG.title,
    message: String(config?.message ?? DEFAULT_DM_WELCOMER_CONFIG.message).trim().slice(0, 1200) || DEFAULT_DM_WELCOMER_CONFIG.message,
    image_url: String(config?.image_url ?? "").trim().slice(0, 300),
  };
}

export function normalizePremiumFeatureConfig(config: Record<string, any> | null | undefined): PremiumFeatureConfig {
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

export function renderStatusMessage(state: SaveState, message: string, fallback: string) {
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

export function renderPreviewText(text: string, emojiById: Map<string, { id: string; url: string }>, fallback = "") {
  const value = text || fallback;
  const parts: ReactNode[] = [];
  const pattern = /<a?:([a-zA-Z0-9_]+):(\d+)>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = pattern.exec(value)) !== null) {
    const [raw, name, id] = match;
    if (!id) continue;
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

export function renderDmBroadcastPlainPreview(
  content: string,
  emojiById: Map<string, { id: string; url: string }>,
  selectedDmMember: { username?: string } | null,
  guild: { name?: string } | null,
  fallback = "Plain message preview"
) {
  return renderPreviewText(
    (content || fallback)
      .replaceAll("{username}", selectedDmMember?.username || "PreviewUser")
      .replaceAll("{server_name}", guild?.name || "Preview Server")
      .replaceAll("{mention}", "@PreviewUser"),
    emojiById
  );
}
