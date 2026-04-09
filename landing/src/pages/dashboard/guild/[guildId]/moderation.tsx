import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Shield, Ban, AlertTriangle, Clock, UserX, Search, CheckCircle, XCircle } from "lucide-react";
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

type Case = {
  id: number;
  case_number: number;
  target_user_id: string;
  target_username?: string;
  moderator_user_id: string;
  moderator_username?: string;
  type: CaseType;
  reason: string;
  duration_seconds?: number;
  active: boolean;
  created_at: string;
};

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

type ModuleRow = {
  name: string;
  display_name?: string;
  description?: string;
  category?: string;
  enabled?: boolean;
};

export default function ModerationPage() {
  const router = useRouter();
  const { guildId } = router.query;

  const [cases, setCases] = useState<Case[]>([]);
  const [activePunishments, setActivePunishments] = useState<Case[]>([]);
  const [config, setConfig] = useState<ModConfig | null>(null);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<CaseType>("WARN");
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!guildId || typeof guildId !== "string") return;

    try {
      const [overviewRes, casesRes, activeRes, configRes] = await Promise.all([
        fetch(`/api/dashboard/guild/${guildId}/overview`),
        fetch(`/api/moderation/${guildId}/cases?limit=50`),
        fetch(`/api/moderation/${guildId}/active`),
        fetch(`/api/moderation/${guildId}/config`),
      ]);

      if (overviewRes.status === 401) {
        router.replace("/api/auth/discord");
        return;
      }

      const overviewData = await overviewRes.json();
      const [casesData, activeData, configData] = await Promise.all([
        casesRes.json(),
        activeRes.json(),
        configRes.json(),
      ]);

      setModules(overviewData.modules || []);
      setCases(casesData.cases || []);
      setActivePunishments(activeData.active || []);
      setConfig(configData.config || {
        warn_auto_punish_enabled: false,
        warn_threshold_1: 3,
        warn_action_1: 'MUTE',
        warn_duration_1: 3600,
        dm_on_punish: true,
        show_mod_in_dm: false
      });
    } catch (err) {
      console.error("Failed to load moderation data:", err);
    } finally {
      setLoading(false);
    }
  }, [guildId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async () => {
    if (!targetUserId || !reason) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/moderation/${guildId}/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId,
          type: actionType,
          reason,
          durationSeconds: duration ? parseInt(duration) * 60 : undefined,
        }),
      });

      if (response.ok) {
        setActionOpen(false);
        setTargetUserId("");
        setReason("");
        setDuration("");
        loadData();
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        alert(`Failed to create case: ${errorData.error || response.statusText}`);
      }
    } catch (err) {
      console.error("Failed to create case:", err);
      alert("Network error - check console");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (caseId: number) => {
    try {
      const response = await fetch(`/api/moderation/${guildId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, reason: "Revoked from dashboard" }),
      });

      if (response.ok) {
        loadData();
      }
    } catch (err) {
      console.error("Failed to revoke punishment:", err);
    }
  };

  const handleConfigUpdate = async (updates: Partial<ModConfig>) => {
    try {
      const response = await fetch(`/api/moderation/${guildId}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, ...updates }),
      });

      if (response.ok) {
        setConfig({ ...config, ...updates });
      }
    } catch (err) {
      console.error("Failed to update config:", err);
    }
  };

  const getCaseBadgeColor = (type: CaseType) => {
    switch (type) {
      case "BAN":
      case "TEMPBAN":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "KICK":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "WARN":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "MUTE":
      case "TIMEOUT":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "UNBAN":
      case "UNMUTE":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTypeEmoji = (type: CaseType) => {
    const emojis: Record<string, string> = {
      WARN: "⚠️", KICK: "👢", BAN: "🔨", TEMPBAN: "⏱️",
      MUTE: "🔇", TIMEOUT: "⏰", UNBAN: "🔓", UNMUTE: "🔊", NOTE: "📝"
    };
    return emojis[type] || "📌";
  };

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

  if (loading) {
    return (
      <DashboardLayout guildId={String(guildId || "")} guildName="Guild" heading="Moderation" modules={modules}>
        <div className="flex h-96 items-center justify-center">
          <div className="text-muted-foreground">Loading moderation data...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout guildId={String(guildId || "")} guildName="Guild" heading="Moderation" modules={modules}>
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
              <Shield className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Moderation</h1>
              <p className="text-sm text-muted-foreground">
                {activePunishments.length} active punishments • {cases.length} total cases
              </p>
            </div>
          </div>

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
                    <Input
                      placeholder="Enter Discord User ID"
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                    />
                  </div>

                  {(actionType === "MUTE" || actionType === "TIMEOUT" || actionType === "TEMPBAN") && (
                    <div className="space-y-2">
                      <Label>Duration (minutes)</Label>
                      <Input
                        type="number"
                        placeholder="e.g., 60"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Textarea
                      placeholder="Enter reason for this action..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <Button
                    onClick={handleAction}
                    disabled={!targetUserId || !reason || submitting}
                    className="w-full"
                  >
                    {submitting ? "Processing..." : "Submit Action"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
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

        {/* Main Content Tabs */}
        <Tabs defaultValue="cases" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto">
            <TabsTrigger value="cases">Mod Cases</TabsTrigger>
            <TabsTrigger value="active">Active Punishments</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="cases" className="mt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by user ID, username, or reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
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
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevoke(c.id)}
                      >
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
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>DM on Punish</Label>
                        <p className="text-sm text-muted-foreground">Send DM to users when they are punished</p>
                      </div>
                      <Switch
                        checked={config.dm_on_punish}
                        onCheckedChange={(v) => handleConfigUpdate({ dm_on_punish: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Show Moderator in DM</Label>
                        <p className="text-sm text-muted-foreground">Reveal which moderator took the action</p>
                      </div>
                      <Switch
                        checked={config.show_mod_in_dm}
                        onCheckedChange={(v) => handleConfigUpdate({ show_mod_in_dm: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Auto-punish on Warnings</Label>
                        <p className="text-sm text-muted-foreground">Automatically punish users after reaching warning thresholds</p>
                      </div>
                      <Switch
                        checked={config.warn_auto_punish_enabled}
                        onCheckedChange={(v) => handleConfigUpdate({ warn_auto_punish_enabled: v })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Modlog Channel ID</Label>
                      <Input
                        placeholder="Channel ID where mod actions are logged"
                        value={config.modlog_channel_id || ""}
                        onChange={(e) => handleConfigUpdate({ modlog_channel_id: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Mute Role ID</Label>
                      <Input
                        placeholder="Role ID used for mutes"
                        value={config.mute_role_id || ""}
                        onChange={(e) => handleConfigUpdate({ mute_role_id: e.target.value })}
                      />
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
