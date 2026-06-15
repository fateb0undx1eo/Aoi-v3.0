import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Save, RefreshCcw, X } from "lucide-react";
import log from "@/lib/logger";
import { BotProfilePreview } from "@/components/bot-profile-preview";
import type { BotLooksConfig, ProfileStyleConfig, SaveState } from "./types";
import {
  DEFAULT_BOT_LOOKS_CONFIG,
  DEFAULT_PROFILE_STYLE_CONFIG,
  PROFILE_STYLE_FONTS,
  PROFILE_STYLE_EFFECTS,
  normalizeBotLooksConfig,
  normalizeProfileStyleConfig,
  decimalToHexColor,
  renderStatusMessage,
} from "./utils";
import { ProfileStyleSection } from "./profile-style";

type Props = {
  guildId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleConfig: Record<string, any> | null | undefined;
  onSaveConfig: (config: Record<string, unknown>) => Promise<void>;
  onReloadForms: () => Promise<void>;
};

export default function BotLooks({ guildId, open, onOpenChange, moduleConfig, onSaveConfig, onReloadForms }: Props) {
  const [botLooksForm, setBotLooksForm] = useState<BotLooksConfig>(DEFAULT_BOT_LOOKS_CONFIG);
  const [profileStyleForm, setProfileStyleForm] = useState<ProfileStyleConfig>(DEFAULT_PROFILE_STYLE_CONFIG);
  const [useGradient, setUseGradient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    if (!moduleConfig) return;
    setBotLooksForm(normalizeBotLooksConfig((moduleConfig as any)?.bot_looks));
    setProfileStyleForm(normalizeProfileStyleConfig((moduleConfig as any)?.profile_style));
  }, [moduleConfig]);

  function updateProfileStyle(updates: Partial<ProfileStyleConfig>) {
    setProfileStyleForm((current) => ({ ...current, ...updates }));
  }

  async function handleSave(nextBotLooks = botLooksForm, nextProfileStyle = profileStyleForm) {
    if (!guildId) return;
    setSaving(true);
    setSaveState("idle");
    setSaveMessage("");
    try {
      const colors = nextProfileStyle.colors
        .filter((value) => Number.isFinite(value) && value >= 0 && value <= 0xffffff)
        .slice(0, 2);
      await onSaveConfig({
        ...(moduleConfig ?? {}),
        bot_looks: {
          ...nextBotLooks,
          activity_text: nextBotLooks.activity_text.trim(),
          custom_status: nextBotLooks.custom_status.trim(),
          streaming_url: nextBotLooks.streaming_url.trim(),
        },
        profile_style: {
          ...nextProfileStyle,
          colors,
        },
      });
      await onReloadForms();
      setSaveState("success");
      setSaveMessage("Bot profile saved and applied successfully.");
    } catch (error) {
      log.error(error);
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "Failed to save bot profile");
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
      setSaveMessage("Reloaded the latest bot profile config.");
    } finally {
      setReloading(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    setSaveState("idle");
    setSaveMessage("");
    try {
      setBotLooksForm(DEFAULT_BOT_LOOKS_CONFIG);
      setProfileStyleForm(DEFAULT_PROFILE_STYLE_CONFIG);
      const colors: number[] = [];
      await onSaveConfig({
        ...(moduleConfig ?? {}),
        bot_looks: { ...DEFAULT_BOT_LOOKS_CONFIG, activity_text: "", custom_status: "", streaming_url: "" },
        profile_style: { ...DEFAULT_PROFILE_STYLE_CONFIG, colors },
      });
      await onReloadForms();
      setSaveState("success");
      setSaveMessage("Bot profile reset to Discord defaults.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(94vw,1080px)] overflow-y-auto border-border/70 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-cyan-400" />
            Bot Profile
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Change the bot&apos;s presence, activity, status, name font, effects, and colors all in one place. Changes are saved to the community config and reapplied on restart.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <BotProfilePreview
            status={botLooksForm.status}
            activityType={botLooksForm.activity_type}
            activityText={botLooksForm.activity_text}
            customStatus={botLooksForm.custom_status}
            streamingUrl={botLooksForm.streaming_url}
            fontLabel={PROFILE_STYLE_FONTS.find((f) => f.id === profileStyleForm.font_id)?.label || "Default"}
            effectLabel={PROFILE_STYLE_EFFECTS.find((e) => e.id === profileStyleForm.effect_id)?.label || "Solid"}
            primaryColor={profileStyleForm.colors[0] !== undefined ? decimalToHexColor(profileStyleForm.colors[0]) : ""}
            secondaryColor={profileStyleForm.colors[1] !== undefined ? decimalToHexColor(profileStyleForm.colors[1]) : ""}
            useGradient={useGradient}
          />

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h3 className="mb-3 text-sm font-medium text-zinc-200">Presence & Activity</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-zinc-200">Online Status</Label>
                <Select
                  value={botLooksForm.status}
                  onValueChange={(value) =>
                    setBotLooksForm((current) => ({
                      ...current,
                      status: value as BotLooksConfig["status"],
                    }))
                  }
                >
                  <SelectTrigger className="border-zinc-800 bg-black text-zinc-100">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-black text-zinc-100">
                    <SelectItem value="online" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Online</SelectItem>
                    <SelectItem value="idle" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Idle</SelectItem>
                    <SelectItem value="dnd" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Do Not Disturb</SelectItem>
                    <SelectItem value="invisible" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Invisible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-200">Activity Mode</Label>
                <Select
                  value={botLooksForm.activity_type}
                  onValueChange={(value) =>
                    setBotLooksForm((current) => ({
                      ...current,
                      activity_type: value as BotLooksConfig["activity_type"],
                    }))
                  }
                >
                  <SelectTrigger className="border-zinc-800 bg-black text-zinc-100">
                    <SelectValue placeholder="Select activity mode" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-black text-zinc-100">
                    <SelectItem value="none" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">None</SelectItem>
                    <SelectItem value="custom" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Custom Status</SelectItem>
                    <SelectItem value="playing" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Playing</SelectItem>
                    <SelectItem value="streaming" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Streaming</SelectItem>
                    <SelectItem value="listening" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Listening</SelectItem>
                    <SelectItem value="watching" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Watching</SelectItem>
                    <SelectItem value="competing" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Competing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {botLooksForm.activity_type !== "none" && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bot-profile-activity" className="text-zinc-200">
                    {botLooksForm.activity_type === "custom" ? "Fallback Activity Text" : "Activity Text"}
                  </Label>
                  <Input
                    id="bot-profile-activity"
                    value={botLooksForm.activity_text}
                    maxLength={128}
                    placeholder={botLooksForm.activity_type === "custom" ? "Used only if custom status is empty" : "What the bot should show"}
                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                    onChange={(event) =>
                      setBotLooksForm((current) => ({
                        ...current,
                        activity_text: event.target.value.slice(0, 128),
                      }))
                    }
                  />
                </div>
                {botLooksForm.activity_type === "custom" && (
                  <div className="space-y-2">
                    <Label htmlFor="bot-profile-custom" className="text-zinc-200">Custom Status Text</Label>
                    <Input
                      id="bot-profile-custom"
                      value={botLooksForm.custom_status}
                      maxLength={128}
                      placeholder="Only used when Activity Mode is Custom Status"
                      className="border-zinc-800 bg-zinc-950 text-zinc-100"
                      onChange={(event) =>
                        setBotLooksForm((current) => ({
                          ...current,
                          custom_status: event.target.value.slice(0, 128),
                        }))
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {botLooksForm.activity_type === "streaming" && (
              <div className="mt-4 space-y-2">
                <Label htmlFor="bot-profile-streaming" className="text-zinc-200">Streaming URL</Label>
                <Input
                  id="bot-profile-streaming"
                  value={botLooksForm.streaming_url}
                  placeholder="https://twitch.tv/yourchannel"
                  className="border-zinc-800 bg-zinc-950 text-zinc-100"
                  onChange={(event) =>
                    setBotLooksForm((current) => ({
                      ...current,
                      streaming_url: event.target.value.slice(0, 256),
                    }))
                  }
                />
              </div>
            )}
          </div>

          <ProfileStyleSection
            form={profileStyleForm}
            onChange={updateProfileStyle}
            useGradient={useGradient}
            onUseGradientChange={setUseGradient}
          />

          <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4">
            {renderStatusMessage(
              saveState,
              saveMessage,
              "Save & apply updates the bot presence and profile style immediately. Use /profile style to sync or /profile clear to reset in Discord."
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-3">
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
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 border-red-900/80 bg-red-950/40 text-red-200 hover:bg-red-950"
                  onClick={handleReset}
                  disabled={resetting || saving}
                >
                  <X className="h-4 w-4" />
                  {resetting ? "Resetting..." : "Reset All"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={saving || resetting}
                  className="gap-2 bg-cyan-600 text-white hover:bg-cyan-500"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save & Apply"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
