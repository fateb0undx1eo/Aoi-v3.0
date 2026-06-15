import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ImageIcon, Save, RefreshCcw } from "lucide-react";
import log from "@/lib/logger";
import type { MemeAutopostConfig, SaveState } from "./types";
import {
  DEFAULT_MEME_AUTPOST_CONFIG,
  MIN_MEME_SECONDS_INTERVAL,
  clampMemeIntervalValue,
  sanitizeSubreddits,
  normalizeMemeAutopostConfig,
  renderStatusMessage,
} from "./utils";

type Props = {
  guildId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleConfig: Record<string, any> | null | undefined;
  roles: { id: string; name: string }[];
  channels: { id: string; name: string }[];
  channelsError?: Error | null;
  onSaveConfig: (config: Record<string, unknown>) => Promise<void>;
  onReloadForms: () => Promise<void>;
};

export default function MemeAutopost({ guildId, open, onOpenChange, moduleConfig, roles, channels, channelsError, onSaveConfig, onReloadForms }: Props) {
  const [form, setForm] = useState<MemeAutopostConfig>(DEFAULT_MEME_AUTPOST_CONFIG);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [subredditDraft, setSubredditDraft] = useState("");

  useEffect(() => {
    if (!moduleConfig) return;
    const next = normalizeMemeAutopostConfig((moduleConfig as any)?.meme_autopost);
    setForm(next);
    setSubredditDraft(next.subreddits.join(", "));
  }, [moduleConfig]);

  const memeSubredditPreview = useMemo(() => sanitizeSubreddits(subredditDraft), [subredditDraft]);

  const hasPersistedConfig = useMemo(() => {
    const persisted = normalizeMemeAutopostConfig((moduleConfig as any)?.meme_autopost);
    return (
      persisted.enabled ||
      persisted.channel_id !== "" ||
      persisted.ping_role_id !== "" ||
      persisted.subreddits.length > 0 ||
      persisted.interval_value !== DEFAULT_MEME_AUTPOST_CONFIG.interval_value ||
      persisted.interval_unit !== DEFAULT_MEME_AUTPOST_CONFIG.interval_unit
    );
  }, [moduleConfig]);

  async function handleSave() {
    if (!guildId) return;
    setSaving(true);
    setSaveState("idle");
    setSaveMessage("");
    try {
      await onSaveConfig({
        ...(moduleConfig ?? {}),
        meme_autopost: {
          ...form,
          interval_value: clampMemeIntervalValue(form.interval_value, form.interval_unit),
          subreddits: sanitizeSubreddits(subredditDraft),
        },
      });
      await onReloadForms();
      setSaveState("success");
      setSaveMessage("Meme autopost updated successfully.");
    } catch (error) {
      log.error(error);
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "Failed to save meme autopost");
    } finally {
      setSaving(false);
    }
  }

  async function handleReload() {
    setReloading(true);
    setSaveState("idle");
    setSaveMessage("");
    try {
      await onReloadForms();
      setSaveState("info");
      setSaveMessage("Reloaded the latest meme autopost config.");
    } finally {
      setReloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                {form.enabled ? "The backend timer will keep pulling random Reddit image posts until disabled." : "Meme autopost is currently paused."}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="meme-enabled" className="text-sm text-zinc-200">Enabled</Label>
              <Switch
                id="meme-enabled"
                checked={form.enabled}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: checked }))}
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
                value={form.interval_value}
                className="border-zinc-800 bg-zinc-950 text-zinc-100"
                onChange={(event) =>
                  setForm((current) => ({
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
                value={form.interval_unit}
                onValueChange={(value) =>
                  setForm((current) => ({
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
                onClick={handleReload}
                disabled={reloading || saving}
              >
                <RefreshCcw className="h-4 w-4" />
                {reloading ? "Reloading..." : "Reload"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-zinc-200">Target Channel</Label>
              <Select
                value={form.channel_id || "__none__"}
                onValueChange={(value) =>
                  setForm((current) => ({
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
              {channelsError && (
                <p className="text-xs text-red-400">{channelsError instanceof Error ? channelsError.message : "Failed to load channels"}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-200">Ping Role</Label>
              <Select
                value={form.ping_role_id || "__none__"}
                onValueChange={(value) =>
                  setForm((current) => ({
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
                  {roles.map((role) => (
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
            {renderStatusMessage(saveState, saveMessage, "Save the community config to start or stop the Reddit autopost timer in the backend.")}
            <Button type="button" onClick={handleSave} disabled={saving} className="gap-2 bg-blue-600 text-white hover:bg-blue-500">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : hasPersistedConfig ? "Update Config" : "Save Config"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
