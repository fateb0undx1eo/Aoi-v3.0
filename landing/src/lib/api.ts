import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/api/auth/discord";
    }
    throw new Error("Unauthorized");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data as T;
}

type GuildItem = {
  id: string;
  name: string;
  icon: string | null;
  installed: boolean;
  member_count: number | null;
  boost_level: number | null;
};

export function useGuilds() {
  return useQuery<{ guilds: GuildItem[] }>({
    queryKey: ["guilds"],
    queryFn: () => fetchJson("/api/discord/guilds"),
  });
}

export type ParsedModuleRow = {
  name: string;
  display_name?: string;
  description?: string;
  category?: string;
  enabled?: boolean;
  is_premium?: boolean;
  config?: Record<string, unknown>;
};

export type OverviewPayload = {
  guild: {
    id: string;
    name: string;
    icon: string | null;
    owner_id: string;
    member_count?: number;
    premium_tier?: number;
    premium_subscription_count?: number;
  };
  stats?: {
    roles_count?: number;
    channels_count?: number;
    emojis_count?: number;
    stickers_count?: number;
  };
  analytics: Array<{
    date: string;
    member_count: number;
    human_count: number;
    bot_count: number;
  }>;
  modules: ParsedModuleRow[];
  refreshed_at: string;
};

export function useGuildOverview(guildId: string | undefined) {
  return useQuery<OverviewPayload>({
    queryKey: ["guild-overview", guildId],
    queryFn: () => fetchJson(`/api/backend/dashboard/guild/${guildId}/overview`),
    enabled: !!guildId,
  });
}

type SettingsPayload = {
  prefix?: string;
  logs?: Array<{
    event_name: string;
    channel_id?: string | null;
    enabled?: boolean;
  }>;
};

export function useGuildSettings(guildId: string | undefined) {
  return useQuery<{ settings: SettingsPayload }>({
    queryKey: ["guild-settings", guildId],
    queryFn: () => fetchJson(`/api/backend/settings/${guildId}`),
    enabled: !!guildId,
  });
}

type GuildChannel = {
  id: string;
  name: string;
  type: number;
};

export function useGuildChannels(guildId: string | undefined) {
  return useQuery<{ channels: GuildChannel[] }>({
    queryKey: ["guild-channels", guildId],
    queryFn: () => fetchJson(`/api/backend/guilds/${guildId}/channels`),
    enabled: !!guildId,
  });
}

export type GuildRole = {
  id: string;
  name: string;
  color: number;
  managed: boolean;
  editable: boolean;
  position: number;
};

export function useGuildRoles(guildId: string | undefined) {
  return useQuery<{ roles: GuildRole[] }>({
    queryKey: ["guild-roles", guildId],
    queryFn: () => fetchJson(`/api/backend/guilds/${guildId}/roles`),
    enabled: !!guildId,
  });
}

type GuildEmoji = {
  id: string;
  name: string;
  animated: boolean;
  mention: string;
  url: string;
};

export function useGuildEmojis(guildId: string | undefined) {
  return useQuery<{ emojis: GuildEmoji[] }>({
    queryKey: ["guild-emojis", guildId],
    queryFn: () => fetchJson(`/api/backend/guilds/${guildId}/emojis`),
    enabled: !!guildId,
  });
}

type GuildMember = {
  id: string;
  username: string;
  display_name: string;
};

export function useGuildMembers(guildId: string | undefined, query: string) {
  return useQuery<{ members: GuildMember[] }>({
    queryKey: ["guild-members", guildId, query],
    queryFn: () => fetchJson(`/api/backend/guilds/${guildId}/members?q=${encodeURIComponent(query)}&limit=25`),
    enabled: !!guildId && query.length > 0,
  });
}

type ModCase = {
  id: number;
  case_number: number;
  target_user_id: string;
  target_username?: string;
  moderator_user_id: string;
  moderator_username?: string;
  type: string;
  reason: string;
  duration_seconds?: number;
  active: boolean;
  created_at: string;
};

export function useModCases(guildId: string | undefined) {
  return useQuery<{ cases: ModCase[] }>({
    queryKey: ["mod-cases", guildId],
    queryFn: () => fetchJson(`/api/backend/moderation/${guildId}/cases?limit=50`),
    enabled: !!guildId,
  });
}

export function useActivePunishments(guildId: string | undefined) {
  return useQuery<{ active: ModCase[] }>({
    queryKey: ["mod-active", guildId],
    queryFn: () => fetchJson(`/api/backend/moderation/${guildId}/active`),
    enabled: !!guildId,
  });
}

type ModConfig = {
  modlog_channel_id?: string;
  mute_role_id?: string;
  warn_auto_punish_enabled: boolean;
  warn_threshold_1: number;
  warn_action_1: string;
  warn_duration_1: number;
  dm_on_punish: boolean;
  show_mod_in_dm: boolean;
};

export function useModConfig(guildId: string | undefined) {
  return useQuery<{ config: ModConfig }>({
    queryKey: ["mod-config", guildId],
    queryFn: () => fetchJson(`/api/backend/moderation/${guildId}/config`),
    enabled: !!guildId,
  });
}

export function useModModule(guildId: string | undefined) {
  return useQuery<{ module: { enabled?: boolean; config?: Record<string, unknown> } }>({
    queryKey: ["mod-module", guildId],
    queryFn: () => fetchJson(`/api/backend/modules/${guildId}/moderation`),
    enabled: !!guildId,
  });
}

export function useModuleConfig(guildId: string | undefined, moduleName: string) {
  return useQuery<{ module: { enabled?: boolean; config?: Record<string, unknown> } }>({
    queryKey: ["module-config", guildId, moduleName],
    queryFn: () => fetchJson(`/api/backend/modules/${guildId}/${moduleName}`),
    enabled: !!guildId,
  });
}

export function useSaveSetting(guildId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) =>
      fetchJson(`/api/backend/settings/${guildId}/${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guild-settings", guildId] });
    },
  });
}

export function useSaveModule(guildId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleName, body }: { moduleName: string; body: unknown }) =>
      fetchJson(`/api/backend/modules/${guildId}/${moduleName}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guild-overview", guildId] });
    },
  });
}

export function useSaveModConfig(guildId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ModConfig>) =>
      fetchJson(`/api/backend/moderation/${guildId}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mod-config", guildId] });
    },
  });
}

export function useCreateModCase(guildId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { targetUserId: string; type: string; reason: string; durationSeconds?: number }) =>
      fetchJson(`/api/backend/moderation/${guildId}/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mod-cases", guildId] });
      queryClient.invalidateQueries({ queryKey: ["mod-active", guildId] });
    },
  });
}

export function useRevokePunishment(guildId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { caseId: number; reason: string }) =>
      fetchJson(`/api/backend/moderation/${guildId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mod-active", guildId] });
    },
  });
}
