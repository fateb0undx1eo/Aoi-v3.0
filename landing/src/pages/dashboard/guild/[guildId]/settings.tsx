import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { BoneyardCard } from "@/components/ui/boneyard-skeleton";
import { Button } from "@/components/ui/button";
import log from "@/lib/logger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings, Command, Shield, Save } from "lucide-react";

type ModuleRow = {
  name: string;
  display_name?: string;
  description?: string;
  category?: string;
  enabled?: boolean;
};

type GuildPayload = {
  guild: Record<string, any>;
  modules: ModuleRow[];
};

type GuildChannel = {
  id: string;
  name: string;
  type: number;
};

type SettingsPayload = {
  prefix?: string;
  logs?: Array<{
    event_name: string;
    channel_id?: string | null;
    enabled?: boolean;
  }>;
};

type SaveState = "idle" | "success" | "error";

function statusClass(state: SaveState) {
  if (state === "success") return "border-emerald-700/60 bg-emerald-500/10 text-emerald-300";
  if (state === "error") return "border-red-700/60 bg-red-500/10 text-red-300";
  return "border-border/70 bg-background/60 text-muted-foreground";
}

export default function SettingsPage() {
  const router = useRouter();
  const { guildId } = router.query;

  const [payload, setPayload] = useState<GuildPayload | null>(null);
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefix, setPrefix] = useState("!");
  const [errorLogsEnabled, setErrorLogsEnabled] = useState(false);
  const [errorLogChannelId, setErrorLogChannelId] = useState("");
  const [prefixSaving, setPrefixSaving] = useState(false);
  const [errorLogsSaving, setErrorLogsSaving] = useState(false);
  const [prefixSaveState, setPrefixSaveState] = useState<SaveState>("idle");
  const [errorLogsSaveState, setErrorLogsSaveState] = useState<SaveState>("idle");
  const [prefixMessage, setPrefixMessage] = useState("Prefix updates are saved directly through the backend settings route.");
  const [errorLogsMessage, setErrorLogsMessage] = useState("Choose a channel and save to update error log routing.");

  const loadGuildData = useCallback(async () => {
    if (!guildId || typeof guildId !== "string") return;

    try {
      const [overviewResponse, settingsResponse, channelsResponse] = await Promise.all([
        fetch(`/api/dashboard/guild/${guildId}/overview`),
        fetch(`/api/settings/${guildId}`),
        fetch(`/api/guilds/${guildId}/channels`),
      ]);

      if (overviewResponse.status === 401 || settingsResponse.status === 401 || channelsResponse.status === 401) {
        router.replace("/api/auth/discord");
        return;
      }

      const overviewData = await overviewResponse.json();
      const settingsData = await settingsResponse.json().catch(() => ({ settings: {} }));
      const channelsData = await channelsResponse.json().catch(() => ({ channels: [] }));

      if (!overviewResponse.ok) {
        throw new Error(overviewData?.error || "Failed to load guild data");
      }
      if (!settingsResponse.ok) {
        throw new Error(settingsData?.error || "Failed to load settings");
      }

      const settings = (settingsData?.settings || {}) as SettingsPayload;
      const errorLogConfig = (settings.logs || []).find((row) => row.event_name === "error");

      setPayload(overviewData);
      setChannels(Array.isArray(channelsData.channels) ? channelsData.channels : []);
      setPrefix(String(settings.prefix || "!"));
      setErrorLogsEnabled(Boolean(errorLogConfig?.enabled));
      setErrorLogChannelId(String(errorLogConfig?.channel_id || ""));
    } catch (err) {
      log.error("Failed to load guild data:", err);
    } finally {
      setLoading(false);
    }
  }, [guildId, router]);

  useEffect(() => {
    loadGuildData();
  }, [loadGuildData]);

  const guild = payload?.guild || null;
  const modules = payload?.modules || [];

  const textChannels = useMemo(() => {
    return channels.filter((channel) => channel.type === 0 || channel.type === 5 || channel.type === 15);
  }, [channels]);

  async function savePrefix() {
    if (!guildId || typeof guildId !== "string") return;
    const nextPrefix = prefix.trim();
    if (!nextPrefix || nextPrefix.length > 8) {
      setPrefixSaveState("error");
      setPrefixMessage("Prefix must be 1 to 8 characters.");
      return;
    }

    setPrefixSaving(true);
    setPrefixSaveState("idle");
    try {
      const response = await fetch(`/api/settings/${guildId}/prefix`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: nextPrefix }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Failed to save prefix");
      setPrefix(nextPrefix);
      setPrefixSaveState("success");
      setPrefixMessage("Prefix saved successfully.");
    } catch (error) {
      setPrefixSaveState("error");
      setPrefixMessage(error instanceof Error ? error.message : "Failed to save prefix");
    } finally {
      setPrefixSaving(false);
    }
  }

  async function saveErrorLogs() {
    if (!guildId || typeof guildId !== "string") return;
    if (errorLogsEnabled && !errorLogChannelId) {
      setErrorLogsSaveState("error");
      setErrorLogsMessage("Choose an error log channel before enabling error logs.");
      return;
    }

    setErrorLogsSaving(true);
    setErrorLogsSaveState("idle");
    try {
      const response = await fetch(`/api/settings/${guildId}/error-logs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: errorLogsEnabled, channelId: errorLogChannelId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Failed to save error log routing");
      setErrorLogsSaveState("success");
      setErrorLogsMessage("Error log routing saved successfully.");
    } catch (error) {
      setErrorLogsSaveState("error");
      setErrorLogsMessage(error instanceof Error ? error.message : "Failed to save error log routing");
    } finally {
      setErrorLogsSaving(false);
    }
  }

  return (
    <DashboardLayout guildId={String(guildId || "")} guildName={guild?.name || "Guild"} heading="Settings" modules={modules}>
      {loading ? (
        <div className="space-y-4">
          <BoneyardCard lines={2} />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <BoneyardCard key={index} lines={3} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Command className="h-5 w-5 text-blue-500" />
                  <div>
                    <CardTitle>Prefix</CardTitle>
                    <CardDescription>Update the guild command prefix from the dashboard.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="guild-prefix">Prefix</Label>
                  <Input id="guild-prefix" value={prefix} maxLength={8} onChange={(event) => setPrefix(event.target.value)} />
                </div>
                <div className={`rounded-lg border px-3 py-2 text-sm ${statusClass(prefixSaveState)}`}>{prefixMessage}</div>
                <Button type="button" onClick={savePrefix} disabled={prefixSaving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {prefixSaving ? "Saving..." : "Save Prefix"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-emerald-500" />
                  <div>
                    <CardTitle>Error Logs</CardTitle>
                    <CardDescription>Route runtime error logs to a Discord channel without using a slash command.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/50 p-4">
                  <div>
                    <div className="font-medium">Enable error logs</div>
                    <div className="text-sm text-muted-foreground">When enabled, backend error events use the selected channel.</div>
                  </div>
                  <Switch checked={errorLogsEnabled} onCheckedChange={setErrorLogsEnabled} />
                </div>
                <div className="space-y-2">
                  <Label>Error log channel</Label>
                  <Select value={errorLogChannelId || "__none__"} onValueChange={(value) => setErrorLogChannelId(value === "__none__" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No channel selected</SelectItem>
                      {textChannels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>#{channel.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={`rounded-lg border px-3 py-2 text-sm ${statusClass(errorLogsSaveState)}`}>{errorLogsMessage}</div>
                <Button type="button" onClick={saveErrorLogs} disabled={errorLogsSaving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {errorLogsSaving ? "Saving..." : "Save Error Logs"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
