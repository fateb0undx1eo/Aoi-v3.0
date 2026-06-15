export type SaveState = "idle" | "success" | "error" | "info";

export type RoleColorConfig = {
  enabled: boolean;
  interval_value: number;
  interval_unit: "seconds" | "minutes" | "hours";
  role_ids: string[];
};

export type MemeAutopostConfig = {
  enabled: boolean;
  interval_value: number;
  interval_unit: "seconds" | "minutes" | "hours";
  channel_id: string;
  ping_role_id: string;
  subreddits: string[];
};

export type BotLooksConfig = {
  enabled: boolean;
  status: "online" | "idle" | "dnd" | "invisible";
  activity_type: "none" | "playing" | "streaming" | "listening" | "watching" | "competing" | "custom";
  activity_text: string;
  custom_status: string;
  streaming_url: string;
};

export type ProfileStyleConfig = {
  enabled: boolean;
  font_id: number;
  effect_id: number;
  colors: number[];
};

export type DmWelcomerConfig = {
  enabled: boolean;
  title: string;
  message: string;
  image_url: string;
};

export type PremiumFeatureTrigger = {
  id: string;
  trigger: string;
  response_links: string[];
  footer_text: string;
  delete_trigger_message: boolean;
  use_main_roles: boolean;
  role_ids: string[];
};

export type PremiumFeatureConfig = {
  enabled: boolean;
  cooldown_seconds: number;
  webhook_enabled: boolean;
  webhook_url: string;
  role_ids: string[];
  triggers: PremiumFeatureTrigger[];
};

export type DmBroadcastBlock = {
  type: "text" | "image" | "separator";
  content: string;
};

export type DmBroadcastPlainMessage = {
  id: string;
  content: string;
};

export type DmBroadcastForm = {
  target_mode: "member" | "everyone";
  member_id: string;
  plain_messages: DmBroadcastPlainMessage[];
  container_blocks: DmBroadcastBlock[];
  delay_seconds: number;
};

export type DmBroadcastJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  requested: number;
  processed: number;
  sent: number;
  failed: number;
  error?: string | null;
};
