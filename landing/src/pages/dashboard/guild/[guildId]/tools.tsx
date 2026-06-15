import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { FeatureCard } from "@/components/feature-card";
import log from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, RefreshCcw, ListChecks, Megaphone } from "lucide-react";
import { useGuildOverview, useSaveModule, type ParsedModuleRow } from "@/lib/api";

type SaveState = "idle" | "success" | "error" | "info";

const DEFAULT_CHANNELS_ACTIVITY_CONFIG = {
  enabled: false,
  default_delete_seconds: 15,
};

type ChannelsActivityConfig = {
  enabled: boolean;
  default_delete_seconds: number;
};

function normalizeChannelsActivityConfig(config: Record<string, unknown> | null | undefined): ChannelsActivityConfig {
  return {
    enabled: Boolean(config?.enabled),
    default_delete_seconds: Math.max(0, Math.min(3600, Number.parseInt(String(config?.default_delete_seconds ?? 15), 10) || 15)),
  };
}

export default function ToolsPage() {
  const router = useRouter();
  const { guildId } = router.query;
  const gid = typeof guildId === "string" ? guildId : undefined;

  const { data, isLoading, refetch } = useGuildOverview(gid);
  const saveModule = useSaveModule(gid);

  const [channelsActivityOpen, setChannelsActivityOpen] = useState(false);
  const [channelsActivitySaving, setChannelsActivitySaving] = useState(false);
  const [channelsActivityReloading, setChannelsActivityReloading] = useState(false);
  const [channelsActivitySaveMessage, setChannelsActivitySaveMessage] = useState("");
  const [channelsActivitySaveState, setChannelsActivitySaveState] = useState<SaveState>("idle");
  const [channelsActivityForm, setChannelsActivityForm] = useState<ChannelsActivityConfig>(DEFAULT_CHANNELS_ACTIVITY_CONFIG);

  useEffect(() => {
    if (!data) return;
    const toolsModule = (data.modules ?? []).find((module) => module.name === "tools");
    setChannelsActivityForm(normalizeChannelsActivityConfig((toolsModule?.config ?? {}) as Record<string, unknown> | null));
  }, [data]);

  const guild = data?.guild ?? null;
  const modules = (data?.modules ?? []) as ParsedModuleRow[];
  const toolsModule = useMemo(
    () => modules.find((module) => module.name === "tools"),
    [modules]
  );

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

  async function handleChannelsActivitySave() {
    if (!gid) return;

    setChannelsActivitySaving(true);
    setChannelsActivitySaveState("idle");
    setChannelsActivitySaveMessage("");

    try {
      await saveModule.mutateAsync({
        moduleName: "tools",
        body: {
          enabled: toolsModule?.enabled ?? true,
          config: {
            ...((toolsModule?.config ?? {}) as Record<string, unknown>),
            channels_activity: channelsActivityForm,
          },
        },
      });

      refetch();
      setChannelsActivitySaveState("success");
      setChannelsActivitySaveMessage("Channels Activity saved successfully.");
    } catch (error) {
      log.error(error);
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
      refetch();
      setChannelsActivitySaveState("info");
      setChannelsActivitySaveMessage("Reloaded the latest Channels Activity config.");
    } finally {
      setChannelsActivityReloading(false);
    }
  }

  const layoutModules = modules as Array<{ name: string; display_name?: string; enabled?: boolean }>;

  return (
    <DashboardLayout guildId={gid ?? ""} guildName={guild?.name || "Guild"} heading="Tools" modules={layoutModules}>
      <div className="space-y-8">
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
          </div>
        </section>

        <Dialog open={channelsActivityOpen} onOpenChange={setChannelsActivityOpen}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-border/70 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Megaphone className="h-5 w-5 text-orange-400" />
                Channels Activity
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Configure the default auto-delete behavior for the admin-only command <code>/channel all</code>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-zinc-100">Default Auto Delete</div>
                  <div className="text-sm text-zinc-400">{channelsActivityForm.enabled ? "Broadcast messages will auto-delete unless the slash command overrides the timer." : "Broadcast messages stay visible unless the slash command provides a delete timer."}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="channels-activity-enabled" className="text-sm text-zinc-200">Enabled</Label>
                  <Switch id="channels-activity-enabled" checked={channelsActivityForm.enabled} onCheckedChange={(checked) => setChannelsActivityForm((current) => ({ ...current, enabled: checked }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_160px]">
                <div className="space-y-2">
                  <Label htmlFor="channels-activity-delete" className="text-zinc-200">Default delete after seconds</Label>
                  <Input id="channels-activity-delete" type="number" min={0} max={3600} value={channelsActivityForm.default_delete_seconds} className="border-zinc-800 bg-zinc-950 text-zinc-100" onChange={(event) => setChannelsActivityForm((current) => ({ ...current, default_delete_seconds: Math.max(0, Math.min(3600, Number.parseInt(event.target.value || "0", 10) || 0)) }))} />
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="outline" className="w-full gap-2 border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={handleChannelsActivityReload} disabled={channelsActivityReloading || channelsActivitySaving}>
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
                <p className="mt-3 text-xs text-zinc-500">Only members with the Administrator permission can run this command.</p>
              </div>

              <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                {renderStatusMessage(channelsActivitySaveState, channelsActivitySaveMessage, "Save updates the default auto-delete behavior.")}
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
