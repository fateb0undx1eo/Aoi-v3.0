import { nanoid } from "nanoid";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Star, Save, RefreshCcw, X, ChevronDown, Eye } from "lucide-react";
import log from "@/lib/logger";
import type { PremiumFeatureConfig, PremiumFeatureTrigger, SaveState } from "./types";
import {
  DEFAULT_PREMIUM_FEATURE_CONFIG,
  normalizePremiumFeatureConfig,
  sanitizePremiumLinks,
  renderPreviewText,
  renderStatusMessage,
} from "./utils";

type Props = {
  guildId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleConfig: Record<string, any> | null | undefined;
  roles: { id: string; name: string }[];
  rolesError?: Error | null;
  emojis: { id: string; name: string; url: string }[];
  onSaveConfig: (config: Record<string, unknown>) => Promise<void>;
  onReloadForms: () => Promise<void>;
};

export default function PremiumFeature({ guildId, open, onOpenChange, moduleConfig, roles, rolesError, emojis, onSaveConfig, onReloadForms }: Props) {
  const [form, setForm] = useState<PremiumFeatureConfig>(DEFAULT_PREMIUM_FEATURE_CONFIG);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [activePreviewId, setActivePreviewId] = useState("");
  const [expandedTriggerIds, setExpandedTriggerIds] = useState<string[]>([]);
  const [triggerRolePickerId, setTriggerRolePickerId] = useState("");
  const [triggerRoleQuery, setTriggerRoleQuery] = useState("");

  const [roleQuery, setRoleQuery] = useState("");
  const [rolePickerOpen, setRolePickerOpen] = useState(false);

  useEffect(() => {
    if (!moduleConfig) return;
    const next = normalizePremiumFeatureConfig((moduleConfig as any)?.premium_feature_1);
    setForm(next);
    setActivePreviewId(next.triggers[0]?.id || "");
    setExpandedTriggerIds(next.triggers.map((trigger) => trigger.id));
  }, [moduleConfig]);

  useEffect(() => {
    if (form.triggers.length === 0) {
      if (activePreviewId) setActivePreviewId("");
      return;
    }
    if (!form.triggers.some((trigger) => trigger.id === activePreviewId)) {
      setActivePreviewId(form.triggers[0]!.id);
    }
  }, [activePreviewId, form.triggers]);

  const emojiById = useMemo(() => new Map(emojis.map((emoji) => [emoji.id, emoji])), [emojis]);

  const filteredRoles = useMemo(() => {
    const normalizedQuery = roleQuery.trim().toLowerCase();
    return roles.filter((role) => !normalizedQuery || role.name.toLowerCase().includes(normalizedQuery));
  }, [roleQuery, roles]);

  const filteredTriggerRoles = useMemo(() => {
    const normalizedQuery = triggerRoleQuery.trim().toLowerCase();
    return roles.filter((role) => !normalizedQuery || role.name.toLowerCase().includes(normalizedQuery));
  }, [triggerRoleQuery, roles]);

  const selectedRoles = useMemo(() => {
    const selected = new Set(form.role_ids);
    return roles.filter((role) => selected.has(role.id));
  }, [form.role_ids, roles]);

  const activePreview = useMemo(
    () => form.triggers.find((trigger) => trigger.id === activePreviewId) || form.triggers[0] || null,
    [activePreviewId, form.triggers]
  );

  const hasPersistedConfig = useMemo(() => {
    const persisted = normalizePremiumFeatureConfig((moduleConfig as any)?.premium_feature_1);
    return (
      persisted.enabled ||
      persisted.cooldown_seconds !== DEFAULT_PREMIUM_FEATURE_CONFIG.cooldown_seconds ||
      persisted.webhook_enabled ||
      persisted.webhook_url !== "" ||
      persisted.role_ids.length > 0 ||
      persisted.triggers.length > 0
    );
  }, [moduleConfig]);

  function toggleRole(roleId: string) {
    setForm((current) => {
      const selected = new Set(current.role_ids);
      if (selected.has(roleId)) selected.delete(roleId);
      else selected.add(roleId);
      return { ...current, role_ids: Array.from(selected) };
    });
    setRolePickerOpen(true);
  }

  function toggleTriggerExpansion(triggerId: string) {
    setExpandedTriggerIds((current) =>
      current.includes(triggerId)
        ? current.filter((id) => id !== triggerId)
        : [...current, triggerId]
    );
  }

  function toggleTriggerRole(triggerId: string, roleId: string) {
    setForm((current) => ({
      ...current,
      triggers: current.triggers.map((trigger) => {
        if (trigger.id !== triggerId) return trigger;
        const selected = new Set(trigger.role_ids);
        if (selected.has(roleId)) selected.delete(roleId);
        else selected.add(roleId);
        return { ...trigger, role_ids: Array.from(selected) };
      }),
    }));
    setTriggerRolePickerId(triggerId);
  }

  function createTrigger(): PremiumFeatureTrigger {
    return {
      id: `premium-trigger-${nanoid()}`,
      trigger: "",
      response_links: [],
      footer_text: "",
      delete_trigger_message: false,
      use_main_roles: true,
      role_ids: [],
    };
  }

  function updateTrigger(triggerId: string, updates: Partial<PremiumFeatureTrigger>) {
    setForm((current) => ({
      ...current,
      triggers: current.triggers.map((trigger) =>
        trigger.id === triggerId ? { ...trigger, ...updates } : trigger
      ),
    }));
  }

  function addTrigger() {
    const next = createTrigger();
    setForm((current) => ({ ...current, triggers: [...current.triggers, next] }));
    setActivePreviewId(next.id);
    setExpandedTriggerIds((current) => Array.from(new Set([...current, next.id])));
  }

  function removeTrigger(triggerId: string) {
    setForm((current) => ({
      ...current,
      triggers: current.triggers.filter((trigger) => trigger.id !== triggerId),
    }));
    setExpandedTriggerIds((current) => current.filter((id) => id !== triggerId));
    if (triggerRolePickerId === triggerId) {
      setTriggerRolePickerId("");
      setTriggerRoleQuery("");
    }
  }

  async function handleSave() {
    if (!guildId) return;
    setSaving(true);
    setSaveState("idle");
    setSaveMessage("");
    try {
      await onSaveConfig({
        ...(moduleConfig ?? {}),
        premium_feature_1: {
          ...form,
          cooldown_seconds: Math.max(0, form.cooldown_seconds || 0),
          webhook_enabled:
            form.webhook_enabled &&
            /^https:\/\/discord(?:app)?\.com\/api\/webhooks\//i.test(form.webhook_url.trim()),
          webhook_url: form.webhook_url.trim().slice(0, 500),
          role_ids: Array.from(new Set(form.role_ids)),
          triggers: form.triggers
            .map((trigger) => ({
              ...trigger,
              trigger: trigger.trigger.trim().slice(0, 100),
              response_links: sanitizePremiumLinks(trigger.response_links.join("\n")),
              footer_text: trigger.footer_text.trim().slice(0, 500),
              role_ids: Array.from(new Set(trigger.role_ids)),
            }))
            .filter((trigger) => trigger.trigger && trigger.response_links.length > 0),
        },
      });
      await onReloadForms();
      setSaveState("success");
      setSaveMessage("Premium Feature #1 updated successfully.");
    } catch (error) {
      log.error(error);
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "Failed to save Premium Feature #1");
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
      setSaveMessage("Reloaded the latest Premium Feature #1 config.");
    } finally {
      setReloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(95vw,1440px)] overflow-y-auto border-border/70 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Star className="h-5 w-5 text-amber-400" />
            Premium Feature #1
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Create role-gated trigger replies with container media, optional footer text, trigger deletion, and one shared cooldown across all triggers.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.72fr)]">
          <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium text-zinc-100">Feature Status</div>
                <div className="text-sm text-zinc-400">
                  {form.enabled
                    ? "Allowed roles can trigger these replies until you disable the feature or change the trigger list."
                    : "Premium Feature #1 is currently paused."}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="premium-feature-enabled" className="text-sm text-zinc-200">Enabled</Label>
                <Switch
                  id="premium-feature-enabled"
                  checked={form.enabled}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: checked }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <div className="space-y-2">
                <Label htmlFor="premium-feature-cooldown" className="text-zinc-200">Shared Cooldown (seconds)</Label>
                <Input
                  id="premium-feature-cooldown"
                  type="number"
                  min={0}
                  value={form.cooldown_seconds}
                  className="border-zinc-800 bg-zinc-950 text-zinc-100"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      cooldown_seconds: Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0),
                    }))
                  }
                />
                <p className="text-xs text-zinc-500">This cooldown is shared across every trigger in this feature for the same user.</p>
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

            <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-zinc-100">Webhook Delivery</div>
                  <div className="text-sm text-zinc-400">
                    If enabled, trigger responses use the webhook URL below instead of sending through the bot account.
                  </div>
                </div>
                <Switch
                  checked={form.webhook_enabled}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, webhook_enabled: checked }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="premium-feature-webhook" className="text-zinc-200">Webhook URL</Label>
                <Input
                  id="premium-feature-webhook"
                  value={form.webhook_url}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="border-zinc-800 bg-zinc-950 text-zinc-100"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, webhook_url: event.target.value.slice(0, 500) }))
                  }
                />
                <p className="text-xs text-zinc-500">
                  Use a Discord webhook URL. If webhook delivery fails, the bot will fall back to normal channel sending.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-zinc-200">Allowed Roles</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRolePickerOpen((current) => !current)}
                  className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100"
                >
                  <span>
                    {selectedRoles.length > 0
                      ? `${selectedRoles.length} role${selectedRoles.length === 1 ? "" : "s"} selected`
                      : "Open role dropdown"}
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
                          return (
                            <button
                              key={role.id}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => toggleRole(role.id)}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                selected ? "bg-zinc-800 text-zinc-100" : "text-zinc-300 hover:bg-zinc-900"
                              }`}
                            >
                              <span>{role.name}</span>
                              {selected ? (
                                <Badge className="bg-amber-500 text-black hover:bg-amber-500">Selected</Badge>
                              ) : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedRoles.length === 0 ? (
                  <p className="text-sm text-zinc-500">No roles selected yet.</p>
                ) : (
                  selectedRoles.map((role) => (
                    <Badge key={role.id} variant="secondary" className="border-zinc-700 bg-zinc-800 px-3 py-1 text-zinc-100">
                      @{role.name}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-zinc-200">Triggers</Label>
                  <p className="text-xs text-zinc-500">Case does not matter. The trigger must match the message text exactly after trimming.</p>
                </div>
                <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={addTrigger}>
                  Add Trigger
                </Button>
              </div>

              {form.triggers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
                  No triggers yet. Add one to define a phrase and the container response links that should appear.
                </div>
              ) : (
                <div className="space-y-4">
                  {form.triggers.map((trigger, index) => (
                    <div key={trigger.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-zinc-100">Trigger {index + 1}</div>
                          <div className="text-xs text-zinc-500">{trigger.trigger || "No trigger phrase yet"}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2 border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                            onClick={() => setActivePreviewId(trigger.id)}
                          >
                            <Eye className="h-4 w-4" />
                            Preview
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-zinc-800 bg-zinc-950 px-3 text-zinc-100 hover:bg-zinc-900"
                            onClick={() => toggleTriggerExpansion(trigger.id)}
                          >
                            <ChevronDown className={`h-4 w-4 transition-transform ${expandedTriggerIds.includes(trigger.id) ? "rotate-180" : "-rotate-90"}`} />
                          </Button>
                          <button type="button" onClick={() => removeTrigger(trigger.id)} className="rounded-full text-zinc-400 hover:text-red-400">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {expandedTriggerIds.includes(trigger.id) && (
                        <>
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-zinc-200">Trigger Text</Label>
                              <Input
                                value={trigger.trigger}
                                placeholder="Type the exact trigger phrase"
                                className="border-zinc-800 bg-zinc-950 text-zinc-100"
                                onChange={(event) => updateTrigger(trigger.id, { trigger: event.target.value.slice(0, 100) })}
                              />
                            </div>
                            <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
                              <div>
                                <div className="font-medium text-zinc-100">Delete Trigger Message</div>
                                <div className="text-xs text-zinc-500">Remove the user&apos;s trigger message before posting the container response.</div>
                              </div>
                              <Switch
                                checked={trigger.delete_trigger_message}
                                onCheckedChange={(checked) => updateTrigger(trigger.id, { delete_trigger_message: checked })}
                              />
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
                            <div>
                              <div className="font-medium text-zinc-100">Use Main Allowed Roles</div>
                              <div className="text-xs text-zinc-500">Turn this off if this trigger should use its own private role list instead of the main one above.</div>
                            </div>
                            <Switch
                              checked={trigger.use_main_roles}
                              onCheckedChange={(checked) =>
                                updateTrigger(trigger.id, {
                                  use_main_roles: checked,
                                  role_ids: checked ? [] : trigger.role_ids,
                                })
                              }
                            />
                          </div>

                          {!trigger.use_main_roles && (
                            <div className="mt-4 space-y-3">
                              <Label className="text-zinc-200">Trigger-Specific Roles</Label>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTriggerRolePickerId((current) => current === trigger.id ? "" : trigger.id);
                                    setTriggerRoleQuery("");
                                  }}
                                  className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100"
                                >
                                  <span>
                                    {trigger.role_ids.length > 0
                                      ? `${trigger.role_ids.length} role${trigger.role_ids.length === 1 ? "" : "s"} selected`
                                      : "Open role dropdown"}
                                  </span>
                                  <ChevronDown className={`h-4 w-4 transition-transform ${triggerRolePickerId === trigger.id ? "rotate-180" : ""}`} />
                                </button>

                                {triggerRolePickerId === trigger.id && (
                                  <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-800 bg-black shadow-2xl">
                                    <div className="border-b border-zinc-800 p-3">
                                      <Input
                                        placeholder="Type a role name to filter..."
                                        value={triggerRoleQuery}
                                        className="border-zinc-800 bg-zinc-950 text-zinc-100"
                                        onChange={(event) => setTriggerRoleQuery(event.target.value)}
                                        onFocus={() => setTriggerRolePickerId(trigger.id)}
                                      />
                                    </div>
                                    <div className="max-h-72 overflow-y-auto p-2">
                                      {filteredTriggerRoles.length === 0 ? (
                                        <div className="rounded-lg px-3 py-4 text-sm text-zinc-500">No roles match that search.</div>
                                      ) : (
                                        filteredTriggerRoles.map((role) => {
                                          const selected = trigger.role_ids.includes(role.id);
                                          return (
                                            <button
                                              key={role.id}
                                              type="button"
                                              onMouseDown={(event) => event.preventDefault()}
                                              onClick={() => toggleTriggerRole(trigger.id, role.id)}
                                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                                selected ? "bg-zinc-800 text-zinc-100" : "text-zinc-300 hover:bg-zinc-900"
                                              }`}
                                            >
                                              <span>{role.name}</span>
                                              {selected ? (
                                                <Badge className="bg-amber-500 text-black hover:bg-amber-500">Selected</Badge>
                                              ) : null}
                                            </button>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {trigger.role_ids.length === 0 ? (
                                  <p className="text-sm text-zinc-500">No trigger-specific roles selected yet.</p>
                                ) : (
                                  roles
                                    .filter((role) => trigger.role_ids.includes(role.id))
                                    .map((role) => (
                                      <Badge key={role.id} variant="secondary" className="border-zinc-700 bg-zinc-800 px-3 py-1 text-zinc-100">
                                        @{role.name}
                                      </Badge>
                                    ))
                                )}
                              </div>
                            </div>
                          )}

                          <div className="mt-4 space-y-2">
                            <Label className="text-zinc-200">Response Links</Label>
                            <Textarea
                              value={trigger.response_links.join("\n")}
                              placeholder={"https://...\nhttps://..."}
                              className="min-h-[120px] border-zinc-800 bg-zinc-950 text-zinc-100"
                              onChange={(event) =>
                                updateTrigger(trigger.id, { response_links: sanitizePremiumLinks(event.target.value) })
                              }
                            />
                            <p className="text-xs text-zinc-500">
                              Add image or GIF links separated by commas or new lines. They will be rendered inside the container.
                            </p>
                          </div>

                          <div className="mt-4 space-y-2">
                            <Label className="text-zinc-200">Footer Text</Label>
                            <Input
                              value={trigger.footer_text}
                              placeholder="Optional footer text"
                              className="border-zinc-800 bg-zinc-950 text-zinc-100"
                              onChange={(event) => updateTrigger(trigger.id, { footer_text: event.target.value.slice(0, 500) })}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-0 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-zinc-500">Trigger Preview</div>
                {activePreview && (
                  <Badge className="border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-800">
                    {activePreview.trigger || "No trigger phrase yet"}
                  </Badge>
                )}
              </div>

              {!activePreview ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
                  Pick a trigger preview from the config tab.
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-zinc-700 bg-black p-4">
                  {activePreview.response_links.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
                      Add at least one response link to see the container preview.
                    </div>
                  ) : (
                    activePreview.response_links.map((link, index) => (
                      <img key={`${link}-${index}`} src={link} alt="Premium trigger preview" className="max-h-72 w-full rounded-xl border border-zinc-800 object-cover" />
                    ))
                  )}

                  {activePreview.footer_text && (
                    <>
                      <div className="h-px w-full bg-zinc-800" />
                      <div className="whitespace-pre-wrap text-sm text-zinc-300">{renderPreviewText(activePreview.footer_text, emojiById)}</div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 lg:hidden">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-zinc-500">Trigger Preview</div>
                {activePreview && (
                  <Badge className="border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-800">
                    {activePreview.trigger || "No trigger phrase yet"}
                  </Badge>
                )}
              </div>

              {!activePreview ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
                  Pick a trigger preview from the config tab.
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-zinc-700 bg-black p-4">
                  {activePreview.response_links.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
                      Add at least one response link to see the container preview.
                    </div>
                  ) : (
                    activePreview.response_links.map((link, index) => (
                      <img key={`${link}-${index}`} src={link} alt="Premium trigger preview" className="max-h-72 w-full rounded-xl border border-zinc-800 object-cover" />
                    ))
                  )}

                  {activePreview.footer_text && (
                    <>
                      <div className="h-px w-full bg-zinc-800" />
                      <div className="whitespace-pre-wrap text-sm text-zinc-300">{renderPreviewText(activePreview.footer_text, emojiById)}</div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
          {renderStatusMessage(saveState, saveMessage, "Save to sync the allowed roles, trigger list, shared cooldown, and container replies.")}
          <Button type="button" onClick={handleSave} disabled={saving} className="gap-2 bg-amber-500 text-black hover:bg-amber-400">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : hasPersistedConfig ? "Update Config" : "Save Config"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
