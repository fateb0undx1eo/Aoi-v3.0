import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Users, Save, RefreshCcw, X, ChevronDown, ListChecks, ArrowUp, ArrowDown, Megaphone } from "lucide-react";

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

type StaffListConfig = {
  enabled: boolean;
  channel_id: string;
  update_mode: "new_message" | "edit_existing";
  existing_message_link: string;
  intro_text: string;
  auto_update_on_role_change: boolean;
  show_join_date: boolean;
  interval_value: number;
  interval_unit: "seconds" | "minutes" | "hours";
  staff_role_ids: string[];
  rank_tier_role_ids: string[];
};

type ChannelsActivityConfig = {
  enabled: boolean;
  default_delete_seconds: number;
};

type SaveState = "idle" | "success" | "error" | "info";

const DEFAULT_STAFF_LIST_CONFIG: StaffListConfig = {
  enabled: false,
  channel_id: "",
  update_mode: "new_message",
  existing_message_link: "",
  intro_text: "Meet the staff team keeping the server running.",
  auto_update_on_role_change: true,
  show_join_date: true,
  interval_value: 30,
  interval_unit: "minutes",
  staff_role_ids: [],
  rank_tier_role_ids: [],
};

const DEFAULT_CHANNELS_ACTIVITY_CONFIG: ChannelsActivityConfig = {
  enabled: false,
  default_delete_seconds: 15,
};

const MIN_STAFF_LIST_SECONDS_INTERVAL = 30;

function clampIntervalValue(value: number, unit: StaffListConfig["interval_unit"]) {
  const normalized = Math.max(1, value || 1);
  if (unit === "seconds") {
    return Math.max(MIN_STAFF_LIST_SECONDS_INTERVAL, normalized);
  }
  return normalized;
}

function normalizeStaffListConfig(config: Record<string, any> | null | undefined): StaffListConfig {
  const intervalUnit =
    config?.interval_unit === "seconds" || config?.interval_unit === "hours"
      ? config.interval_unit
      : "minutes";

  const staffRoleIds = Array.isArray(config?.staff_role_ids) ? config.staff_role_ids.map((roleId: unknown) => String(roleId)) : [];
  const tierIds = Array.isArray(config?.rank_tier_role_ids)
    ? config.rank_tier_role_ids.map((roleId: unknown) => String(roleId)).filter((roleId) => staffRoleIds.includes(roleId))
    : [];

  return {
    enabled: Boolean(config?.enabled),
    channel_id: String(config?.channel_id ?? ""),
    update_mode: config?.update_mode === "edit_existing" ? "edit_existing" : "new_message",
    existing_message_link: String(config?.existing_message_link ?? "").trim(),
    intro_text: String(config?.intro_text ?? DEFAULT_STAFF_LIST_CONFIG.intro_text).trim().slice(0, 800) || DEFAULT_STAFF_LIST_CONFIG.intro_text,
    auto_update_on_role_change: config?.auto_update_on_role_change !== false,
    show_join_date: config?.show_join_date !== false,
    interval_value: clampIntervalValue(Number.parseInt(String(config?.interval_value ?? 30), 10) || 30, intervalUnit),
    interval_unit: intervalUnit,
    staff_role_ids: staffRoleIds,
    rank_tier_role_ids: [...tierIds, ...staffRoleIds.filter((roleId) => !tierIds.includes(roleId))],
  };
}

function normalizeChannelsActivityConfig(config: Record<string, any> | null | undefined): ChannelsActivityConfig {
  return {
    enabled: Boolean(config?.enabled),
    default_delete_seconds: Math.max(0, Math.min(3600, Number.parseInt(String(config?.default_delete_seconds ?? 15), 10) || 15)),
  };
}

function reorder(values: string[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= values.length) {
    return values;
  }

  const next = [...values];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

export default function ToolsPage() {
  const router = useRouter();
  const { guildId } = router.query;

  const [payload, setPayload] = useState<GuildPayload | null>(null);
  const [roles, setRoles] = useState<GuildRole[]>([]);
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [loading, setLoading] = useState(true);

  const [staffListOpen, setStaffListOpen] = useState(false);
  const [channelsActivityOpen, setChannelsActivityOpen] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [roleQuery, setRoleQuery] = useState("");
  const [roleLoadMessage, setRoleLoadMessage] = useState("");
  const [channelLoadMessage, setChannelLoadMessage] = useState("");

  const [staffListSaving, setStaffListSaving] = useState(false);
  const [staffListReloading, setStaffListReloading] = useState(false);
  const [staffListSaveMessage, setStaffListSaveMessage] = useState("");
  const [staffListSaveState, setStaffListSaveState] = useState<SaveState>("idle");
  const [staffListForm, setStaffListForm] = useState<StaffListConfig>(DEFAULT_STAFF_LIST_CONFIG);
  const [channelsActivitySaving, setChannelsActivitySaving] = useState(false);
  const [channelsActivityReloading, setChannelsActivityReloading] = useState(false);
  const [channelsActivitySaveMessage, setChannelsActivitySaveMessage] = useState("");
  const [channelsActivitySaveState, setChannelsActivitySaveState] = useState<SaveState>("idle");
  const [channelsActivityForm, setChannelsActivityForm] = useState<ChannelsActivityConfig>(DEFAULT_CHANNELS_ACTIVITY_CONFIG);

  const loadGuildData = useCallback(async () => {
    if (!guildId || typeof guildId !== "string") return;

    try {
      const [overviewResponse, rolesResponse, channelsResponse] = await Promise.all([
        fetch(`/api/dashboard/guild/${guildId}/overview`),
        fetch(`/api/guilds/${guildId}/roles`),
        fetch(`/api/guilds/${guildId}/channels`),
      ]);

      if (overviewResponse.status === 401 || rolesResponse.status === 401 || channelsResponse.status === 401) {
        router.replace("/api/auth/discord");
        return;
      }

      const overviewData = await overviewResponse.json();
      const rolesData = await rolesResponse.json().catch(() => ({ roles: [] }));
      const channelsData = await channelsResponse.json().catch(() => ({ channels: [] }));

      if (!overviewResponse.ok) {
        throw new Error(overviewData?.error || "Failed to load tools data");
      }

      setPayload(overviewData);
      setRoles(Array.isArray(rolesData.roles) ? rolesData.roles : []);
      setChannels(Array.isArray(channelsData.channels) ? channelsData.channels : []);
      setRoleLoadMessage(rolesResponse.ok ? "" : rolesData?.error || "Failed to load roles from the backend.");
      setChannelLoadMessage(channelsResponse.ok ? "" : channelsData?.error || "Failed to load channels from the backend.");

      const toolsModule = (overviewData.modules || []).find((module: ModuleRow) => module.name === "tools");
      setStaffListForm(normalizeStaffListConfig(toolsModule?.config?.staff_list));
      setChannelsActivityForm(normalizeChannelsActivityConfig(toolsModule?.config?.channels_activity));
    } catch (error) {
      console.error("Failed to load tools data:", error);
    } finally {
      setLoading(false);
    }
  }, [guildId, router]);

  useEffect(() => {
    loadGuildData();
  }, [loadGuildData]);

  const guild = payload?.guild || null;
  const modules = payload?.modules || [];
  const toolsModule = useMemo(
    () => modules.find((module) => module.name === "tools"),
    [modules]
  );

  const filteredRoles = useMemo(() => {
    const normalizedQuery = roleQuery.trim().toLowerCase();
    return roles
      .filter((role) => !role.managed)
      .filter((role) => !normalizedQuery || role.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 36);
  }, [roleQuery, roles]);

  const selectedStaffRoles = useMemo(() => {
    const selected = new Set(staffListForm.staff_role_ids);
    return roles.filter((role) => selected.has(role.id));
  }, [roles, staffListForm.staff_role_ids]);

  const rankTierRoles = useMemo(() => {
    return staffListForm.rank_tier_role_ids
      .map((roleId) => roles.find((role) => role.id === roleId))
      .filter(Boolean) as GuildRole[];
  }, [roles, staffListForm.rank_tier_role_ids]);

  const hasPersistedConfig = useMemo(() => {
    const persisted = normalizeStaffListConfig(toolsModule?.config?.staff_list);
    return (
      persisted.enabled ||
      persisted.channel_id !== "" ||
      persisted.existing_message_link !== "" ||
      persisted.intro_text !== DEFAULT_STAFF_LIST_CONFIG.intro_text ||
      persisted.staff_role_ids.length > 0
    );
  }, [toolsModule]);

  const summary = useMemo(() => {
    const roleCount = staffListForm.staff_role_ids.length;
    const interval = `${staffListForm.interval_value} ${staffListForm.interval_unit}`;
    return roleCount
      ? `Track ${roleCount} staff role${roleCount === 1 ? "" : "s"} and refresh every ${interval}.`
      : "Choose staff roles, rank order, and a publish mode for the staff roster.";
  }, [staffListForm]);

  const channelsActivitySummary = useMemo(() => {
    return channelsActivityForm.enabled
      ? `Broadcasted messages auto-delete after ${channelsActivityForm.default_delete_seconds} second${channelsActivityForm.default_delete_seconds === 1 ? "" : "s"} by default.`
      : "Broadcast messages stay until removed manually unless the slash command provides a delete override.";
  }, [channelsActivityForm]);

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

  function toggleStaffRole(roleId: string) {
    setStaffListForm((current) => {
      const selected = new Set(current.staff_role_ids);
      let nextRoleIds: string[];
      let nextTierIds: string[];

      if (selected.has(roleId)) {
        selected.delete(roleId);
        nextRoleIds = Array.from(selected);
        nextTierIds = current.rank_tier_role_ids.filter((currentRoleId) => currentRoleId !== roleId);
      } else {
        selected.add(roleId);
        nextRoleIds = Array.from(selected);
        nextTierIds = current.rank_tier_role_ids.includes(roleId)
          ? current.rank_tier_role_ids
          : [...current.rank_tier_role_ids, roleId];
      }

      return {
        ...current,
        staff_role_ids: nextRoleIds,
        rank_tier_role_ids: nextTierIds,
      };
    });
    setRolePickerOpen(true);
  }

  function moveTier(roleId: string, direction: -1 | 1) {
    setStaffListForm((current) => {
      const index = current.rank_tier_role_ids.indexOf(roleId);
      if (index === -1) {
        return current;
      }

      return {
        ...current,
        rank_tier_role_ids: reorder(current.rank_tier_role_ids, index, direction),
      };
    });
  }

  async function persistToolsConfig(nextConfig: Record<string, any>) {
    if (!guildId || typeof guildId !== "string") return { ok: false, error: "Invalid guild id" };

    const response = await fetch(`/api/modules/${guildId}/tools`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        enabled: toolsModule?.enabled ?? true,
        config: nextConfig,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (data?.error === "config_store_unreachable") {
        throw new Error("The config store is temporarily unreachable. Wait a few seconds and try saving again.");
      }
      throw new Error(data?.error || "Failed to save tools configuration");
    }

    return { ok: true };
  }

  async function handleStaffListSave() {
    if (!guildId || typeof guildId !== "string") return;

    if (staffListForm.staff_role_ids.length === 0) {
      setStaffListSaveState("error");
      setStaffListSaveMessage("Choose at least one staff role before saving.");
      return;
    }

    if (staffListForm.update_mode === "new_message" && !staffListForm.channel_id) {
      setStaffListSaveState("error");
      setStaffListSaveMessage("Choose a post channel before saving.");
      return;
    }

    if (staffListForm.update_mode === "edit_existing" && !staffListForm.existing_message_link.trim()) {
      setStaffListSaveState("error");
      setStaffListSaveMessage("Paste the staff list message link when using edit-existing mode.");
      return;
    }

    setStaffListSaving(true);
    setStaffListSaveState("idle");
    setStaffListSaveMessage("");

    try {
      await persistToolsConfig({
        ...(toolsModule?.config ?? {}),
        staff_list: {
          ...staffListForm,
          interval_value: clampIntervalValue(staffListForm.interval_value, staffListForm.interval_unit),
          intro_text: staffListForm.intro_text.trim() || DEFAULT_STAFF_LIST_CONFIG.intro_text,
        },
      });

      await loadGuildData();
      setStaffListSaveState("success");
      setStaffListSaveMessage("Staff List saved and applied successfully.");
    } catch (error) {
      console.error(error);
      setStaffListSaveState("error");
      setStaffListSaveMessage(error instanceof Error ? error.message : "Failed to save Staff List");
    } finally {
      setStaffListSaving(false);
    }
  }

  async function handleStaffListReload() {
    setStaffListReloading(true);
    setStaffListSaveState("idle");
    setStaffListSaveMessage("");

    try {
      await loadGuildData();
      setStaffListSaveState("info");
      setStaffListSaveMessage("Reloaded the latest Staff List config.");
    } finally {
      setStaffListReloading(false);
    }
  }

  async function handleChannelsActivitySave() {
    if (!guildId || typeof guildId !== "string") return;

    setChannelsActivitySaving(true);
    setChannelsActivitySaveState("idle");
    setChannelsActivitySaveMessage("");

    try {
      await persistToolsConfig({
        ...(toolsModule?.config ?? {}),
        channels_activity: channelsActivityForm,
      });

      await loadGuildData();
      setChannelsActivitySaveState("success");
      setChannelsActivitySaveMessage("Channels Activity saved successfully.");
    } catch (error) {
      console.error(error);
      setChannelsActivitySaveState("error");
      setChannelsActivitySaveMessage(error instanceof Error ? error.message : "Failed to save Channels Activity");
    } finally {
      setChannelsActivitySaving(false);
    }
  }

  async function handleChannelsActivityReload() {
    setChannelsActivityReloading(true);
    setChannelsActivitySaveState("idle");
    setChannelsActivitySaveMessage("");

    try {
      await loadGuildData();
      setChannelsActivitySaveState("info");
      setChannelsActivitySaveMessage("Reloaded the latest Channels Activity config.");
    } finally {
      setChannelsActivityReloading(false);
    }
  }

  async function handleStaffListEnabledToggle(checked: boolean) {
    const nextForm = { ...staffListForm, enabled: checked };
    setStaffListForm(nextForm);

    if (checked) {
      return;
    }

    setStaffListSaving(true);
    setStaffListSaveState("idle");
    setStaffListSaveMessage("");

    try {
      await persistToolsConfig({
        ...(toolsModule?.config ?? {}),
        staff_list: nextForm,
      });
      await loadGuildData();
      setStaffListSaveState("success");
      setStaffListSaveMessage("Staff List disabled.");
    } catch (error) {
      console.error(error);
      setStaffListSaveState("error");
      setStaffListSaveMessage(error instanceof Error ? error.message : "Failed to disable Staff List");
    } finally {
      setStaffListSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <BoneyardCard lines={2} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <BoneyardCard key={index} lines={3} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout guildId={String(guildId || "")} guildName={guild?.name || "Guild"} heading="Tools" modules={modules}>
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <ListChecks className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Tools</h1>
            <p className="text-muted-foreground">Utility features, roster automation, and lightweight helper systems live here.</p>
          </div>
        </div>

        <section>
          <h2 className="card-heading mb-4 text-sm uppercase tracking-wider text-muted-foreground">Feature Cards</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Megaphone className="h-6 w-6" />}
              title="Channels Activity"
              description={channelsActivitySummary}
              badge={channelsActivityForm.enabled ? "Auto Delete On" : "Auto Delete Off"}
              iconColor="text-orange-400"
              onClick={() => setChannelsActivityOpen(true)}
            />
            <FeatureCard
              icon={<Users className="h-6 w-6" />}
              title="Staff List"
              description={summary}
              badge={staffListForm.enabled ? "Live" : "Off"}
              iconColor="text-cyan-400"
              onClick={() => setStaffListOpen(true)}
            />
          </div>
        </section>

        <Dialog open={staffListOpen} onOpenChange={setStaffListOpen}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-border/70 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Users className="h-5 w-5 text-cyan-400" />
                Staff List
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Build and keep a live staff roster message updated from the web. Presence buckets use Discord member presence data, so the bot needs the Presence intent enabled for accurate online, idle, and inactive sections.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-zinc-100">Roster Status</div>
                  <div className="text-sm text-zinc-400">
                    {staffListForm.enabled ? "The backend will keep the roster message updated on its interval, and can refresh immediately when staff roles change." : "The staff roster is currently disabled."}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="staff-list-enabled" className="text-sm text-zinc-200">Enabled</Label>
                  <Switch
                    id="staff-list-enabled"
                    checked={staffListForm.enabled}
                    onCheckedChange={handleStaffListEnabledToggle}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-zinc-200">Post Channel</Label>
                  <Select
                    value={staffListForm.channel_id || "__none__"}
                    onValueChange={(value) =>
                      setStaffListForm((current) => ({
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
                  <Label className="text-zinc-200">Update Mode</Label>
                  <Select
                    value={staffListForm.update_mode}
                    onValueChange={(value) =>
                      setStaffListForm((current) => ({
                        ...current,
                        update_mode: value as StaffListConfig["update_mode"],
                      }))
                    }
                  >
                    <SelectTrigger className="border-zinc-800 bg-black text-zinc-100">
                      <SelectValue placeholder="Choose update mode" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-black text-zinc-100">
                      <SelectItem value="new_message" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Post a new message</SelectItem>
                      <SelectItem value="edit_existing" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Edit an existing message</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {staffListForm.update_mode === "edit_existing" && (
                <div className="space-y-2">
                  <Label htmlFor="staff-list-message-link" className="text-zinc-200">Existing Message Link</Label>
                  <Input
                    id="staff-list-message-link"
                    value={staffListForm.existing_message_link}
                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                    placeholder="https://discord.com/channels/server/channel/message"
                    onChange={(event) =>
                      setStaffListForm((current) => ({
                        ...current,
                        existing_message_link: event.target.value,
                      }))
                    }
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="staff-list-intro" className="text-zinc-200">Intro Text</Label>
                <Textarea
                  id="staff-list-intro"
                  value={staffListForm.intro_text}
                  className="min-h-[110px] border-zinc-800 bg-zinc-950 text-zinc-100"
                  onChange={(event) =>
                    setStaffListForm((current) => ({
                      ...current,
                      intro_text: event.target.value.slice(0, 800),
                    }))
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_180px_160px]">
                <div className="space-y-2">
                  <Label htmlFor="staff-list-interval" className="text-zinc-200">Refresh Interval</Label>
                  <Input
                    id="staff-list-interval"
                    type="number"
                    min={1}
                    value={staffListForm.interval_value}
                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                    onChange={(event) =>
                      setStaffListForm((current) => ({
                        ...current,
                        interval_value: clampIntervalValue(
                          Number.parseInt(event.target.value || "30", 10) || 30,
                          current.interval_unit
                        ),
                      }))
                    }
                  />
                  <p className="text-xs text-zinc-500">
                    Seconds mode has a minimum of {MIN_STAFF_LIST_SECONDS_INTERVAL} seconds to avoid unnecessary Discord API churn.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-200">Unit</Label>
                  <Select
                    value={staffListForm.interval_unit}
                    onValueChange={(value) =>
                      setStaffListForm((current) => ({
                        ...current,
                        interval_unit: value as StaffListConfig["interval_unit"],
                        interval_value: clampIntervalValue(current.interval_value, value as StaffListConfig["interval_unit"]),
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
                    onClick={handleStaffListReload}
                    disabled={staffListReloading || staffListSaving}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {staffListReloading ? "Reloading..." : "Reload"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-1">
                <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div>
                    <div className="font-medium text-zinc-100">Auto-update on role change</div>
                    <div className="text-sm text-zinc-400">Refresh immediately when a staff role is assigned or removed.</div>
                  </div>
                  <Switch
                    checked={staffListForm.auto_update_on_role_change}
                    onCheckedChange={(checked) => setStaffListForm((current) => ({ ...current, auto_update_on_role_change: checked }))}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-zinc-200">Staff Roles</Label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setRolePickerOpen((current) => !current)}
                    className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100"
                  >
                    <span>
                      {selectedStaffRoles.length > 0 ? `${selectedStaffRoles.length} staff role${selectedStaffRoles.length === 1 ? "" : "s"} selected` : "Open role dropdown"}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${rolePickerOpen ? "rotate-180" : ""}`} />
                  </button>

                  {rolePickerOpen && (
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-800 bg-black shadow-2xl">
                      <div className="border-b border-zinc-800 p-3">
                        <Input
                          placeholder="Type a role name to filter..."
                          value={roleQuery}
                          className="border-zinc-800 bg-zinc-950 text-zinc-100"
                          onChange={(event) => setRoleQuery(event.target.value)}
                          onFocus={() => setRolePickerOpen(true)}
                        />
                        {roleLoadMessage && (
                          <p className="mt-2 text-xs text-red-400">{roleLoadMessage}</p>
                        )}
                      </div>
                      <div className="max-h-72 overflow-y-auto p-2">
                        {filteredRoles.length === 0 ? (
                          <div className="rounded-lg px-3 py-4 text-sm text-zinc-500">No roles match that search.</div>
                        ) : (
                          filteredRoles.map((role) => {
                            const selected = staffListForm.staff_role_ids.includes(role.id);
                            return (
                              <button
                                key={role.id}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => toggleStaffRole(role.id)}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                  selected ? "bg-zinc-800 text-zinc-100" : "text-zinc-300 hover:bg-zinc-900"
                                }`}
                              >
                                <div>
                                  <div className="font-medium">{role.name}</div>
                                  <div className="text-xs text-zinc-500">{role.id}</div>
                                </div>
                                {selected ? (
                                  <Badge className="bg-cyan-600 text-white hover:bg-cyan-600">Selected</Badge>
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
                {selectedStaffRoles.length === 0 ? (
                  <p className="text-sm text-zinc-500">No staff roles selected yet.</p>
                ) : (
                  selectedStaffRoles.map((role) => (
                    <Badge key={role.id} variant="secondary" className="gap-2 border-zinc-700 bg-zinc-800 px-3 py-1 text-zinc-100">
                      <span>{role.name}</span>
                      <button type="button" onClick={() => toggleStaffRole(role.id)} className="rounded-full hover:text-red-400">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>

              <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div>
                  <div className="font-medium text-zinc-100">Rank Tiers</div>
                  <div className="text-sm text-zinc-400">The order here controls hierarchy inside each activity bucket. Topmost roles render first.</div>
                </div>
                {rankTierRoles.length === 0 ? (
                  <p className="text-sm text-zinc-500">Add staff roles first to build the hierarchy.</p>
                ) : (
                  <div className="space-y-2">
                    {rankTierRoles.map((role, index) => (
                      <div key={role.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                        <div className="flex items-center gap-3">
                          <Badge className="bg-cyan-600 text-white hover:bg-cyan-600">#{index + 1}</Badge>
                          <div>
                            <div className="font-medium text-zinc-100">{role.name}</div>
                            <div className="text-xs text-zinc-500">{role.id}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" size="icon" className="border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800" onClick={() => moveTier(role.id, -1)} disabled={index === 0}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="outline" size="icon" className="border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800" onClick={() => moveTier(role.id, 1)} disabled={index === rankTierRoles.length - 1}>
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                {renderStatusMessage(
                  staffListSaveState,
                  staffListSaveMessage,
                  "Save applies the roster immediately, then keeps updating it on the configured interval."
                )}
                <Button type="button" onClick={handleStaffListSave} disabled={staffListSaving} className="gap-2 bg-cyan-600 text-white hover:bg-cyan-500">
                  <Save className="h-4 w-4" />
                  {staffListSaving ? "Saving..." : hasPersistedConfig ? "Update Config" : "Save Config"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={channelsActivityOpen} onOpenChange={setChannelsActivityOpen}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-border/70 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Megaphone className="h-5 w-5 text-orange-400" />
                Channels Activity
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Configure the default auto-delete behavior for the admin-only command <code>/channel all</code>. The command sends a message to every sendable guild channel, including voice-channel chats where Discord allows messages.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-zinc-100">Default Auto Delete</div>
                  <div className="text-sm text-zinc-400">
                    {channelsActivityForm.enabled
                      ? "Broadcast messages will auto-delete unless the slash command overrides the timer."
                      : "Broadcast messages stay visible unless the slash command provides a delete timer."}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="channels-activity-enabled" className="text-sm text-zinc-200">Enabled</Label>
                  <Switch
                    id="channels-activity-enabled"
                    checked={channelsActivityForm.enabled}
                    onCheckedChange={(checked) => setChannelsActivityForm((current) => ({ ...current, enabled: checked }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_160px]">
                <div className="space-y-2">
                  <Label htmlFor="channels-activity-delete" className="text-zinc-200">Default delete after seconds</Label>
                  <Input
                    id="channels-activity-delete"
                    type="number"
                    min={0}
                    max={3600}
                    value={channelsActivityForm.default_delete_seconds}
                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                    onChange={(event) =>
                      setChannelsActivityForm((current) => ({
                        ...current,
                        default_delete_seconds: Math.max(0, Math.min(3600, Number.parseInt(event.target.value || "0", 10) || 0)),
                      }))
                    }
                  />
                  <p className="text-xs text-zinc-500">
                    Use <code>0</code> to keep messages permanently when auto delete is enabled but no timer is desired.
                  </p>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                    onClick={handleChannelsActivityReload}
                    disabled={channelsActivityReloading || channelsActivitySaving}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {channelsActivityReloading ? "Reloading..." : "Reload"}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="font-medium text-zinc-100">Command Preview</div>
                <div className="mt-2 text-sm text-zinc-400">
                  <div><code>/channel all message:&quot;Server maintenance soon&quot;</code></div>
                  <div className="mt-1"><code>/channel all message:&quot;Join the event VC&quot; delete_after_seconds:30</code></div>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Only members with the Administrator permission can run this command. Slash-level delete seconds override the website default.
                </p>
              </div>

              <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                {renderStatusMessage(
                  channelsActivitySaveState,
                  channelsActivitySaveMessage,
                  "Save updates the default auto-delete behavior used by /channel all."
                )}
                <Button type="button" onClick={handleChannelsActivitySave} disabled={channelsActivitySaving} className="gap-2 bg-orange-600 text-white hover:bg-orange-500">
                  <Save className="h-4 w-4" />
                  {channelsActivitySaving ? "Saving..." : "Save Config"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
