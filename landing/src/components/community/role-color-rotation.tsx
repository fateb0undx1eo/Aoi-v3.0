import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Palette, Save, RefreshCcw, X, ChevronDown } from "lucide-react";
import log from "@/lib/logger";
import type { RoleColorConfig, SaveState } from "./types";
import {
  DEFAULT_ROLE_COLOR_CONFIG,
  MIN_ROLE_SECONDS_INTERVAL,
  clampRoleIntervalValue,
  normalizeRoleColorConfig,
  renderStatusMessage,
} from "./utils";

type Props = {
  guildId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleConfig: Record<string, any> | null | undefined;
  roles: { id: string; name: string; editable: boolean }[];
  rolesError?: Error | null;
  onSaveConfig: (config: Record<string, unknown>) => Promise<void>;
  onReloadForms: () => Promise<void>;
};

export default function RoleColorRotation({ guildId, open, onOpenChange, moduleConfig, roles, rolesError, onSaveConfig, onReloadForms }: Props) {
  const [form, setForm] = useState<RoleColorConfig>(DEFAULT_ROLE_COLOR_CONFIG);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [roleQuery, setRoleQuery] = useState("");
  const [rolePickerOpen, setRolePickerOpen] = useState(false);

  useEffect(() => {
    if (!moduleConfig) return;
    setForm(normalizeRoleColorConfig((moduleConfig as any)?.role_color_rotation));
  }, [moduleConfig]);

  const filteredRoles = useMemo(() => {
    const normalizedQuery = roleQuery.trim().toLowerCase();
    return roles.filter((role) => !normalizedQuery || role.name.toLowerCase().includes(normalizedQuery));
  }, [roleQuery, roles]);

  const selectedRoles = useMemo(() => {
    const selected = new Set(form.role_ids);
    return roles.filter((role) => selected.has(role.id));
  }, [form.role_ids, roles]);

  const availableRoleCount = roles.length;

  const hasPersistedConfig = useMemo(() => {
    const persisted = normalizeRoleColorConfig((moduleConfig as any)?.role_color_rotation);
    return (
      persisted.enabled ||
      persisted.role_ids.length > 0 ||
      persisted.interval_value !== DEFAULT_ROLE_COLOR_CONFIG.interval_value ||
      persisted.interval_unit !== DEFAULT_ROLE_COLOR_CONFIG.interval_unit
    );
  }, [moduleConfig]);

  function toggleRole(roleId: string) {
    setForm((current) => {
      const selected = new Set(current.role_ids);
      if (selected.has(roleId)) {
        selected.delete(roleId);
      } else {
        selected.add(roleId);
      }
      return { ...current, role_ids: Array.from(selected) };
    });
    setRolePickerOpen(true);
  }

  async function handleSave() {
    if (!guildId) return;
    setSaving(true);
    setSaveState("idle");
    setSaveMessage("");
    try {
      await onSaveConfig({
        ...(moduleConfig ?? {}),
        role_color_rotation: {
          ...form,
          interval_value: clampRoleIntervalValue(form.interval_value, form.interval_unit),
        },
      });
      await onReloadForms();
      setSaveState("success");
      setSaveMessage("Role color rotation updated successfully.");
    } catch (error) {
      log.error(error);
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "Failed to save role color rotation");
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
      setSaveMessage("Reloaded the latest role color rotation config.");
    } finally {
      setReloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(94vw,1080px)] overflow-y-auto border-border/70 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Palette className="h-5 w-5 text-pink-400" />
            Randomized Role Color
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Pick the roles that should rotate colors forever, choose the interval, and toggle the feature on. Discord command toggle: <code>/randomizedrolecolor enabled:true|false</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium text-zinc-100">Rotation Status</div>
              <div className="text-sm text-zinc-400">
                {form.enabled ? "The backend timer will keep rotating selected roles until disabled." : "Rotation is currently paused."}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="role-color-enabled" className="text-sm text-zinc-200">Enabled</Label>
              <Switch
                id="role-color-enabled"
                checked={form.enabled}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: checked }))}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_180px_160px]">
            <div className="space-y-2">
              <Label htmlFor="role-interval-value" className="text-zinc-200">Interval</Label>
              <Input
                id="role-interval-value"
                type="number"
                min={1}
                value={form.interval_value}
                className="border-zinc-800 bg-zinc-950 text-zinc-100"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    interval_value: clampRoleIntervalValue(
                      Number.parseInt(event.target.value || "1", 10) || 1,
                      current.interval_unit
                    ),
                  }))
                }
              />
              <p className="text-xs text-zinc-500">
                Seconds mode has a minimum of {MIN_ROLE_SECONDS_INTERVAL} seconds to avoid unnecessary Discord API churn.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-200">Unit</Label>
              <Select
                value={form.interval_unit}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    interval_unit: value as RoleColorConfig["interval_unit"],
                    interval_value: clampRoleIntervalValue(current.interval_value, value as RoleColorConfig["interval_unit"]),
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

          <div className="space-y-3">
            <Label htmlFor="role-search" className="text-zinc-200">Choose Roles</Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setRolePickerOpen((current) => !current)}
                className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100"
              >
                <span>
                  {selectedRoles.length > 0 ? `${selectedRoles.length} role${selectedRoles.length === 1 ? "" : "s"} selected` : "Open role dropdown"}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${rolePickerOpen ? "rotate-180" : ""}`} />
              </button>

              {rolePickerOpen && (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-800 bg-black shadow-2xl">
                  <div className="border-b border-zinc-800 p-3">
                    <Input
                      id="role-search"
                      placeholder="Type a role name to filter..."
                      value={roleQuery}
                      className="border-zinc-800 bg-zinc-950 text-zinc-100"
                      onChange={(event) => setRoleQuery(event.target.value)}
                      onFocus={() => setRolePickerOpen(true)}
                    />
                    <p className="mt-2 text-xs text-zinc-500">
                      {availableRoleCount} server roles available. Roles above the bot or managed by integrations will show as unavailable.
                    </p>
                    {rolesError && (
                      <p className="mt-2 text-xs text-red-400">{rolesError instanceof Error ? rolesError.message : "Failed to load roles"}</p>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto p-2">
                    {filteredRoles.length === 0 ? (
                      <div className="rounded-lg px-3 py-4 text-sm text-zinc-500">No roles match that search.</div>
                    ) : (
                      filteredRoles.map((role) => {
                        const selected = form.role_ids.includes(role.id);
                        const disabled = !role.editable;
                        return (
                          <button
                            key={role.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              if (disabled) return;
                              toggleRole(role.id);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                              disabled
                                ? "cursor-not-allowed opacity-55"
                                : selected
                                  ? "bg-zinc-800 text-zinc-100"
                                  : "text-zinc-300 hover:bg-zinc-900"
                            }`}
                            disabled={disabled}
                          >
                            <div>
                              <div className="font-medium">{role.name}</div>
                              <div className="text-xs text-zinc-500">{role.id}</div>
                            </div>
                            {disabled ? (
                              <Badge variant="outline" className="border-zinc-700 text-zinc-400">Unavailable</Badge>
                            ) : selected ? (
                              <Badge className="bg-pink-600 text-white hover:bg-pink-600">Selected</Badge>
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
            {selectedRoles.length === 0 ? (
              <p className="text-sm text-zinc-500">No roles selected yet.</p>
            ) : (
              selectedRoles.map((role) => (
                <Badge key={role.id} variant="secondary" className="gap-2 border-zinc-700 bg-zinc-800 px-3 py-1 text-zinc-100">
                  <span>{role.name}</span>
                  <button type="button" onClick={() => toggleRole(role.id)} className="rounded-full hover:text-red-400">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              ))
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {renderStatusMessage(saveState, saveMessage, "Save the community config to sync the indefinite timer in the backend.")}
            <Button type="button" onClick={handleSave} disabled={saving} className="gap-2 bg-pink-600 text-white hover:bg-pink-500">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : hasPersistedConfig ? "Update Config" : "Save Config"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
