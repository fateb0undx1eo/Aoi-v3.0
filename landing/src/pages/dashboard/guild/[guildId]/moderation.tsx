import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Shield, Ban, AlertTriangle, Clock, UserX, Search, CheckCircle, XCircle } from "lucide-react";
import log from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useGuildOverview,
  useModCases,
  useActivePunishments,
  useModConfig,
  useModModule,
  useGuildChannels,
  useGuildRoles,
  useCreateModCase,
  useRevokePunishment,
  useSaveModConfig,
  useSaveModule,
  type ParsedModuleRow,
  type GuildRole,
} from "@/lib/api";

type CaseType = "WARN" | "KICK" | "BAN" | "TEMPBAN" | "MUTE" | "TIMEOUT" | "UNBAN" | "UNMUTE" | "NOTE";

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

const DEFAULT_MOD_CONFIG: ModConfig = {
  warn_auto_punish_enabled: false,
  warn_threshold_1: 3,
  warn_action_1: "MUTE",
  warn_duration_1: 3600,
  dm_on_punish: true,
  show_mod_in_dm: false,
};

const DEFAULT_CASE_COMMAND_CONFIG = {
  channel_id: "",
  allowed_role_ids: [] as string[],
  default_timeout_minutes: 10,
};

function normalizeCaseCommandConfig(rawConfig?: Record<string, unknown>) {
  const caseCommand = rawConfig?.case_command as Record<string, unknown> | undefined;
  return {
    channel_id: String(caseCommand?.channel_id || ""),
    allowed_role_ids: Array.isArray(caseCommand?.allowed_role_ids) ? (caseCommand.allowed_role_ids as string[]).filter(Boolean) : [],
    default_timeout_minutes: Math.max(1, Number(caseCommand?.default_timeout_minutes) || 10),
  };
}

export default function ModerationPage() {
  const router = useRouter();
  const { guildId } = router.query;
  const gid = typeof guildId === "string" ? guildId : undefined;

  const { data: overviewData } = useGuildOverview(gid);
  const { data: casesData } = useModCases(gid);
  const { data: activeData } = useActivePunishments(gid);
  const { data: configData } = useModConfig(gid);
  const { data: moduleData } = useModModule(gid);
  const { data: channelsData } = useGuildChannels(gid);
  const { data: rolesData } = useGuildRoles(gid);
  const createCase = useCreateModCase(gid);
  const revokePunishment = useRevokePunishment(gid);
  const saveModConfig = useSaveModConfig(gid);
  const saveModule = useSaveModule(gid);

  const [config, setConfig] = useState<ModConfig | null>(null);
  const [caseCommandConfig, setCaseCommandConfig] = useState(DEFAULT_CASE_COMMAND_CONFIG);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<CaseType>("WARN");
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!configData || !moduleData) return;
    setConfig(configData.config || DEFAULT_MOD_CONFIG);
    setCaseCommandConfig(normalizeCaseCommandConfig(moduleData.module?.config as Record<string, unknown> | undefined));
    setLoading(false);
  }, [configData, moduleData]);

  const modules = (overviewData?.modules ?? []) as ParsedModuleRow[];
  const guildName = overviewData?.guild?.name || "Guild";
  const cases = casesData?.cases ?? [];
  const activePunishments = activeData?.active ?? [];
  const channels = channelsData?.channels ?? [];
  const roles = rolesData?.roles ?? [];

  const filteredCases = cases.filter(
    (c) =>
      c.target_user_id.includes(searchQuery) ||
      c.target_username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats24h = (type: string) => {
    const cutoff = Date.now() - 86400000;
    return cases.filter(c => {
      if (type === "BAN") return (c.type === "BAN" || c.type === "TEMPBAN") && new Date(c.created_at).getTime() > cutoff;
      if (type === "MUTE") return (c.type === "MUTE" || c.type === "TIMEOUT") && new Date(c.created_at).getTime() > cutoff;
      return c.type === type && new Date(c.created_at).getTime() > cutoff;
    }).length;
  };

  const handleAction = async () => {
    if (!targetUserId || !reason) return;
    setSubmitting(true);
    try {
      await createCase.mutateAsync({
        targetUserId,
        type: actionType,
        reason,
        durationSeconds: duration ? parseInt(duration) * 60 : undefined,
      });
      setActionOpen(false);
      setTargetUserId("");
      setReason("");
      setDuration("");
    } catch (err) {
      log.error("Failed to create case:", err);
      alert("Failed to create case - check console");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (caseId: number) => {
    try {
      await revokePunishment.mutateAsync({ caseId, reason: "Revoked from dashboard" });
    } catch (err) {
      log.error("Failed to revoke punishment:", err);
    }
  };

  const handleConfigUpdate = async (updates: Partial<ModConfig>) => {
    if (!config) return;
    try {
      await saveModConfig.mutateAsync({ ...config, ...updates });
      setConfig({ ...config, ...updates });
    } catch (err) {
      log.error("Failed to update config:", err);
    }
  };

  const handleCaseCommandUpdate = async (updates: Partial<typeof DEFAULT_CASE_COMMAND_CONFIG>) => {
    if (!gid) return;
    const nextConfig = { ...caseCommandConfig, ...updates };
    setCaseCommandConfig(nextConfig);
    try {
      await saveModule.mutateAsync({
        moduleName: "moderation",
        body: {
          enabled: moduleData?.module?.enabled ?? true,
          config: {
            ...((moduleData?.module?.config ?? {}) as Record<string, unknown>),
            case_command: {
              channel_id: nextConfig.channel_id.trim(),
              allowed_role_ids: nextConfig.allowed_role_ids,
              default_timeout_minutes: nextConfig.default_timeout_minutes,
            },
          },
        },
      });
    } catch (err) {
      log.error("Failed to update case command config:", err);
    }
  };

  const getCaseBadgeColor = (type: string) => {
    switch (type) {
      case "BAN": case "TEMPBAN": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "KICK": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "WARN": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "MUTE": case "TIMEOUT": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "UNBAN": case "UNMUTE": return "bg-green-500/10 text-green-500 border-green-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTypeEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      WARN: "⚠️", KICK: "👢", BAN: "🔨", TEMPBAN: "⏱️",
      MUTE: "🔇", TIMEOUT: "⏰", UNBAN: "🔓", UNMUTE: "🔊", NOTE: "📝"
    };
    return emojis[type] || "📌";
  };

  const layoutModules = modules as Array<{ name: string; display_name?: string; enabled?: boolean }>;

  if (loading) {
    return (
      <DashboardLayout guildId={gid ?? ""} guildName={guildName} heading="Moderation" modules={layoutModules}>
        <div className="flex h-96 items-center justify-center">
          <div className="text-muted-foreground">Loading moderation data...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout guildId={gid ?? ""} guildName={guildName} heading="Moderation" modules={layoutModules}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Dialog open={actionOpen} onOpenChange={setActionOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Ban className="h-4 w-4" />
                  Take Action
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Moderation Action</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Action Type</Label>
                    <Select value={actionType} onValueChange={(v) => setActionType(v as CaseType)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select punishment type" />
                      </SelectTrigger>
                      <SelectContent position="popper" className="z-50 w-[var(--radix-select-trigger-width)] bg-background border shadow-md">
                        <SelectItem value="WARN">⚠️ Warning</SelectItem>
                        <SelectItem value="MUTE">🔇 Mute</SelectItem>
                        <SelectItem value="TIMEOUT">⏰ Timeout</SelectItem>
                        <SelectItem value="KICK">👢 Kick</SelectItem>
                        <SelectItem value="BAN">🔨 Ban</SelectItem>
                        <SelectItem value="TEMPBAN">⏱️ Temp Ban</SelectItem>
                        <SelectItem value="NOTE">📝 Note</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>User ID</Label>
                    <Input placeholder="Enter Discord User ID" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} />
                  </div>
                  {(actionType === "MUTE" || actionType === "TIMEOUT" || actionType === "TEMPBAN") && (
                    <div className="space-y-2">
                      <Label>Duration (minutes)</Label>
                      <Input type="number" placeholder="e.g., 60" value={duration} onChange={(e) => setDuration(e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Textarea placeholder="Enter reason for this action..." value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
                  </div>
                  <Button onClick={handleAction} disabled={!targetUserId || !reason || submitting} className="w-full">
                    {submitting ? "Processing..." : "Submit Action"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">Warnings (24h)</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats24h("WARN")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">Kicks (24h)</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats24h("KICK")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Bans (24h)</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats24h("BAN")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">Active Mutes</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activePunishments.filter((c) => c.type === "MUTE" || c.type === "TIMEOUT").length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="cases" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto">
            <TabsTrigger value="cases">Mod Cases</TabsTrigger>
            <TabsTrigger value="active">Active Punishments</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="cases" className="mt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by user ID, username, or reason..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <div className="rounded-xl border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Case</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">User</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Reason</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Moderator</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCases.slice(0, 20).map((c) => (
                      <tr key={c.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm font-medium">#{c.case_number}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium">{c.target_username || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{c.target_user_id.slice(0, 8)}...</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={getCaseBadgeColor(c.type)}>
                            {getTypeEmoji(c.type)} {c.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm max-w-xs truncate">{c.reason}</td>
                        <td className="px-4 py-3 text-sm">{c.moderator_username || "Unknown"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredCases.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">No cases found</div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            <div className="space-y-4">
              {activePunishments.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                  <p>No active punishments - everyone is behaving!</p>
                </Card>
              ) : (
                activePunishments.map((c) => (
                  <Card key={c.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className={getCaseBadgeColor(c.type)}>
                          {getTypeEmoji(c.type)} {c.type}
                        </Badge>
                        <div>
                          <div className="font-medium">{c.target_username || c.target_user_id}</div>
                          <div className="text-sm text-muted-foreground">Case #{c.case_number} • {c.reason}</div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleRevoke(c.id)}>
                        <XCircle className="h-4 w-4 mr-1" />
                        Revoke
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="config" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Moderation Settings</CardTitle>
                <CardDescription>Configure how the bot handles moderation actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {config && (
                  <>
                    {[
                      { label: "DM on Punish", desc: "Send DM to users when they are punished", key: "dm_on_punish" as const },
                      { label: "Show Moderator in DM", desc: "Reveal which moderator took the action", key: "show_mod_in_dm" as const },
                      { label: "Auto-punish on Warnings", desc: "Automatically punish users after reaching warning thresholds", key: "warn_auto_punish_enabled" as const },
                    ].map(({ label, desc, key }) => (
                      <div key={key} className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>{label}</Label>
                          <p className="text-sm text-muted-foreground">{desc}</p>
                        </div>
                        <Switch checked={config[key]} onCheckedChange={(v) => handleConfigUpdate({ [key]: v })} />
                      </div>
                    ))}

                    <div className="space-y-2">
                      <Label>Modlog Channel</Label>
                      <Select value={config.modlog_channel_id || "__none"} onValueChange={(value) => handleConfigUpdate({ modlog_channel_id: value === "__none" ? "" : value })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select modlog channel" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="z-50 w-[var(--radix-select-trigger-width)] bg-background border shadow-md">
                          <SelectItem value="__none">Not configured</SelectItem>
                          {channels.map((channel) => (
                            <SelectItem key={channel.id} value={channel.id}>#{channel.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-4 rounded-xl border border-border/60 p-4 lg:grid-cols-2">
                      <div className="space-y-0.5">
                        <Label>Case Command Channel</Label>
                        <p className="text-sm text-muted-foreground">Message reports from the Discord message command are sent here.</p>
                        <Select value={caseCommandConfig.channel_id || "__none"} onValueChange={(value) => handleCaseCommandUpdate({ channel_id: value === "__none" ? "" : value })}>
                          <SelectTrigger className="mt-2 w-full">
                            <SelectValue placeholder="Select case channel" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="z-50 w-[var(--radix-select-trigger-width)] bg-background border shadow-md">
                            <SelectItem value="__none">Not configured</SelectItem>
                            {channels.map((channel) => (
                              <SelectItem key={channel.id} value={channel.id}>#{channel.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-0.5">
                        <Label>Case Command Role</Label>
                        <p className="text-sm text-muted-foreground">Only this role can open cases or press case action buttons.</p>
                        <Select value={caseCommandConfig.allowed_role_ids[0] || "__none"} onValueChange={(value) => handleCaseCommandUpdate({ allowed_role_ids: value === "__none" ? [] : [value] })}>
                          <SelectTrigger className="mt-2 w-full">
                            <SelectValue placeholder="Select case role" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="z-50 w-[var(--radix-select-trigger-width)] bg-background border shadow-md">
                            <SelectItem value="__none">Not configured</SelectItem>
                            {roles.filter((role) => !role.managed).map((role) => (
                              <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Mute Role</Label>
                      <Select value={config.mute_role_id || "__none"} onValueChange={(value) => handleConfigUpdate({ mute_role_id: value === "__none" ? "" : value })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select mute role" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="z-50 w-[var(--radix-select-trigger-width)] bg-background border shadow-md">
                          <SelectItem value="__none">Not configured</SelectItem>
                          {roles.filter((role) => !role.managed).map((role) => (
                            <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
