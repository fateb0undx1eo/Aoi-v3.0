import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LogIn, Save, RefreshCcw } from "lucide-react";
import log from "@/lib/logger";
import type { DmWelcomerConfig, SaveState } from "./types";
import {
  DEFAULT_DM_WELCOMER_CONFIG,
  normalizeDmWelcomerConfig,
  renderStatusMessage,
} from "./utils";

type Props = {
  guildId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleConfig: Record<string, any> | null | undefined;
  onSaveConfig: (config: Record<string, unknown>) => Promise<void>;
  onReloadForms: () => Promise<void>;
};

export default function DmWelcomer({ guildId, open, onOpenChange, moduleConfig, onSaveConfig, onReloadForms }: Props) {
  const [form, setForm] = useState<DmWelcomerConfig>(DEFAULT_DM_WELCOMER_CONFIG);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    if (!moduleConfig) return;
    setForm(normalizeDmWelcomerConfig((moduleConfig as any)?.dm_welcomer));
  }, [moduleConfig]);

  const hasPersistedConfig = useMemo(() => {
    const persisted = normalizeDmWelcomerConfig((moduleConfig as any)?.dm_welcomer);
    return (
      persisted.enabled ||
      persisted.title !== DEFAULT_DM_WELCOMER_CONFIG.title ||
      persisted.message !== DEFAULT_DM_WELCOMER_CONFIG.message ||
      persisted.image_url !== ""
    );
  }, [moduleConfig]);

  async function handleSave(nextForm = form) {
    if (!guildId) return;
    setSaving(true);
    setSaveState("idle");
    setSaveMessage("");
    try {
      await onSaveConfig({
        ...(moduleConfig ?? {}),
        dm_welcomer: {
          ...nextForm,
          title: nextForm.title.trim() || DEFAULT_DM_WELCOMER_CONFIG.title,
          message: nextForm.message.trim() || DEFAULT_DM_WELCOMER_CONFIG.message,
          image_url: nextForm.image_url.trim(),
        },
      });
      await onReloadForms();
      setSaveState("success");
      setSaveMessage("DM welcomer saved successfully.");
    } catch (error) {
      log.error(error);
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "Failed to save DM welcomer");
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
      setSaveMessage("Reloaded the latest DM welcomer config.");
    } finally {
      setReloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                {form.enabled ? "New members will receive this DM after joining if their privacy settings allow it." : "The DM welcomer is currently paused."}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="dm-welcomer-enabled" className="text-sm text-zinc-200">Enabled</Label>
              <Switch
                id="dm-welcomer-enabled"
                checked={form.enabled}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: checked }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dm-welcomer-title" className="text-zinc-200">Title</Label>
            <Input
              id="dm-welcomer-title"
              value={form.title}
              className="border-zinc-800 bg-zinc-950 text-zinc-100"
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value.slice(0, 120) }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dm-welcomer-message" className="text-zinc-200">Message</Label>
            <Textarea
              id="dm-welcomer-message"
              value={form.message}
              className="min-h-[140px] border-zinc-800 bg-zinc-950 text-zinc-100"
              onChange={(event) =>
                setForm((current) => ({ ...current, message: event.target.value.slice(0, 1200) }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dm-welcomer-image" className="text-zinc-200">Banner Image URL</Label>
            <Input
              id="dm-welcomer-image"
              value={form.image_url}
              placeholder="https://..."
              className="border-zinc-800 bg-zinc-950 text-zinc-100"
              onChange={(event) =>
                setForm((current) => ({ ...current, image_url: event.target.value.slice(0, 300) }))
              }
            />
          </div>

          <div className="rounded-2xl border border-green-900/50 bg-green-500/5 p-4 text-sm text-green-100">
            <div className="font-medium">Preview</div>
            <div className="mt-2 text-green-200/90">{form.title || DEFAULT_DM_WELCOMER_CONFIG.title}</div>
            <div className="mt-2 whitespace-pre-wrap text-zinc-300">{form.message || DEFAULT_DM_WELCOMER_CONFIG.message}</div>
          </div>

          <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {renderStatusMessage(saveState, saveMessage, "Save the DM welcomer to update what new members receive after joining.")}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                onClick={handleReload}
                disabled={reloading || saving}
              >
                <RefreshCcw className="h-4 w-4" />
                {reloading ? "Reloading..." : "Reload"}
              </Button>
              <Button type="button" onClick={() => handleSave()} disabled={saving} className="gap-2 bg-green-600 text-white hover:bg-green-500">
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : hasPersistedConfig ? "Update Config" : "Save Config"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
