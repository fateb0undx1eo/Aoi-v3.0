import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { BoneyardCard } from "@/components/ui/boneyard-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type ModuleRow = {
  name: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

type OverviewPayload = {
  guild: { name: string };
  modules: ModuleRow[];
};

type FunConfig = {
  shared_cooldown_across_types: boolean;
  max_uses_per_member: number;
  cooldown_window_seconds: number;
  interaction_timeout_seconds: number;
  resolved_drop_delete_seconds: number;
  ephemeral_notice_delete_seconds: number;
  claim_result_visibility: "public" | "ephemeral";
  pass_result_visibility: "public" | "ephemeral";
  smash_button_label: string;
  pass_button_label: string;
  summon_title_template: string;
  summon_body_template: string;
  claim_title_template: string;
  claim_body_template: string;
  pass_title_template: string;
  pass_body_template: string;
  dm_title_template: string;
  dm_body_template: string;
  cooldown_title_template: string;
  cooldown_body_template: string;
  expired_title_template: string;
  expired_body_template: string;
};

type PreviewMode = "summon" | "claim" | "pass" | "dm" | "cooldown" | "expired";
type PreviewType = "waifu" | "husbando";

const DEFAULT_CONFIG: FunConfig = {
  shared_cooldown_across_types: true,
  max_uses_per_member: 3,
  cooldown_window_seconds: 3600,
  interaction_timeout_seconds: 1800,
  resolved_drop_delete_seconds: 20,
  ephemeral_notice_delete_seconds: 15,
  claim_result_visibility: "public",
  pass_result_visibility: "public",
  smash_button_label: "Smash",
  pass_button_label: "Pass",
  summon_title_template: "{type_title} Drop",
  summon_body_template: "A {type} dropped. Smash first to claim it or pass to clear it.",
  claim_title_template: "{type_title} Claimed",
  claim_body_template: "{claimer_mention} claimed this {type}. {dm_status}",
  pass_title_template: "{type_title} Passed",
  pass_body_template: "{actor_mention} passed on this {type}.",
  dm_title_template: "You claimed your {type}",
  dm_body_template: "Server: {server_name}\nClaimed at: {claimed_at}",
  cooldown_title_template: "Slow Down",
  cooldown_body_template: "You have used /{command_name} {max_uses} time(s) in {window_text}. Try again in {retry_after}.",
  expired_title_template: "{type_title} Expired",
  expired_body_template: "Nobody claimed this {type} before the drop timed out.",
};

const SAMPLE_IMAGES = {
  waifu: "https://nekos.best/api/v2/waifu/8b05570c-824d-4fe4-a341-a3495c2e6e7f.png",
  husbando: "https://nekos.best/api/v2/husbando/37728dcc-3a62-4fd6-b986-fd2088a1fdd1.png",
} as const;

const TEMPLATE_FIELDS: [label: string, key: keyof FunConfig, multiline: boolean][] = [
  ["Summon title", "summon_title_template", false],
  ["Summon body", "summon_body_template", true],
  ["Claim title", "claim_title_template", false],
  ["Claim body", "claim_body_template", true],
  ["Pass title", "pass_title_template", false],
  ["Pass body", "pass_body_template", true],
  ["DM title", "dm_title_template", false],
  ["DM body", "dm_body_template", true],
  ["Cooldown title", "cooldown_title_template", false],
  ["Cooldown body", "cooldown_body_template", true],
  ["Expired title", "expired_title_template", false],
  ["Expired body", "expired_body_template", true],
];

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeConfig(input?: Record<string, unknown> | null): FunConfig {
  return {
    ...DEFAULT_CONFIG,
    ...input,
    shared_cooldown_across_types: input?.shared_cooldown_across_types !== false,
    max_uses_per_member: clampInteger(input?.max_uses_per_member, 1, 25, DEFAULT_CONFIG.max_uses_per_member),
    cooldown_window_seconds: clampInteger(input?.cooldown_window_seconds, 60, 86400, DEFAULT_CONFIG.cooldown_window_seconds),
    interaction_timeout_seconds: clampInteger(input?.interaction_timeout_seconds, 30, 43200, DEFAULT_CONFIG.interaction_timeout_seconds),
    resolved_drop_delete_seconds: clampInteger(input?.resolved_drop_delete_seconds, 0, 3600, DEFAULT_CONFIG.resolved_drop_delete_seconds),
    ephemeral_notice_delete_seconds: clampInteger(input?.ephemeral_notice_delete_seconds, 0, 840, DEFAULT_CONFIG.ephemeral_notice_delete_seconds),
    claim_result_visibility: input?.claim_result_visibility === "ephemeral" ? "ephemeral" : "public",
    pass_result_visibility: input?.pass_result_visibility === "ephemeral" ? "ephemeral" : "public",
  };
}

function render(template: string, ctx: Record<string, string>) {
  return template.replace(/\{([^}]+)\}/g, (_, key) => ctx[key.trim()] ?? "");
}

function getTypeTitle(type: PreviewType) {
  return type === "husbando" ? "Husbando" : "Waifu";
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours && `${hours}h`, minutes && `${minutes}m`, seconds && `${seconds}s`].filter(Boolean).join(" ") || "0s";
}

export default function FunPage() {
  const router = useRouter();
  const { guildId } = router.query;
  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Save once and `/waifu` + `/husbando` will use these settings.");
  const [enabled, setEnabled] = useState(true);
  const [form, setForm] = useState<FunConfig>(DEFAULT_CONFIG);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("summon");
  const [previewType, setPreviewType] = useState<PreviewType>("waifu");

  const load = useCallback(async () => {
    if (!guildId || typeof guildId !== "string") return;
    try {
      const response = await fetch(`/api/dashboard/guild/${guildId}/overview`);
      if (response.status === 401) {
        router.replace("/api/auth/discord");
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to load fun module");
      setPayload(data);
      const module = (data.modules || []).find((entry: ModuleRow) => entry.name.toLowerCase() === "fun");
      setEnabled(module?.enabled !== false);
      setForm(normalizeConfig((module?.config ?? {}) as Record<string, unknown>));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load fun module");
    } finally {
      setLoading(false);
    }
  }, [guildId, router]);

  useEffect(() => { load(); }, [load]);

  const previewContext = useMemo(() => ({
    type: previewType,
    type_title: getTypeTitle(previewType),
    claimer_mention: "@claimer",
    actor_mention: "@member",
    server_name: payload?.guild.name || "AOI Lounge",
    claimed_at: "April 15, 2026 at 10:32:14 PM",
    command_name: previewType,
    retry_after: "22m 55s",
    max_uses: String(form.max_uses_per_member),
    window_text: formatDuration(form.cooldown_window_seconds),
    dm_status: "Check your DMs.",
  }), [form.cooldown_window_seconds, form.max_uses_per_member, payload?.guild.name, previewType]);

  const preview = useMemo(() => {
    const mapping: Record<PreviewMode, [string, string, string]> = {
      summon: [form.summon_title_template, form.summon_body_template, "live"],
      claim: [form.claim_title_template, form.claim_body_template, form.claim_result_visibility],
      pass: [form.pass_title_template, form.pass_body_template, form.pass_result_visibility],
      dm: [form.dm_title_template, form.dm_body_template, "dm"],
      cooldown: [form.cooldown_title_template, form.cooldown_body_template, "system"],
      expired: [form.expired_title_template, form.expired_body_template, "system"],
    };
    const [title, body, visibility] = mapping[previewMode];
    return { title: render(title, previewContext), body: render(body, previewContext), visibility };
  }, [form, previewContext, previewMode]);

  const save = async () => {
    if (!guildId || typeof guildId !== "string") return;
    setSaving(true);
    setMessage("Saving fun module settings...");
    try {
      const response = await fetch(`/api/modules/${guildId}/fun`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, config: form }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Failed to save fun module");
      setMessage("Fun module settings saved.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save fun module");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout guildId={String(guildId || "")} guildName={payload?.guild.name || "Guild"} heading="Fun" modules={payload?.modules || []}>
      {loading && <BoneyardCard lines={6} />}
      {!loading && error && <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">{error}</div>}
      {!loading && !error && (
        <div className="space-y-6">
          <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
            <CardHeader>
              <CardTitle>Waifu / Husbando Drops</CardTitle>
              <CardDescription className="text-zinc-400">Configure the `fun` module for `/waifu` and `/husbando`, including cooldowns, button lifetime, public vs ephemeral result messages, and DM receipt copy.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                <div>
                  <div className="font-medium text-zinc-100">Module enabled</div>
                  <div className="text-sm text-zinc-400">If disabled, the commands stay registered but refuse usage.</div>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300">
                Commands: <span className="text-white">`/waifu`</span> and <span className="text-white">`/husbando`</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
                <CardHeader><CardTitle>Behavior</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>Shared cooldown across both commands</Label><div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-black/40 px-4 py-3"><span className="text-sm text-zinc-400">Use one pool for both commands.</span><Switch checked={form.shared_cooldown_across_types} onCheckedChange={(checked) => setForm((current) => ({ ...current, shared_cooldown_across_types: checked }))} /></div></div>
                  <div className="space-y-2"><Label>Max uses per member</Label><Input type="number" value={form.max_uses_per_member} className="border-zinc-800 bg-black text-zinc-100" onChange={(event) => setForm((current) => ({ ...current, max_uses_per_member: clampInteger(event.target.value, 1, 25, current.max_uses_per_member) }))} /></div>
                  <div className="space-y-2"><Label>Cooldown window seconds</Label><Input type="number" value={form.cooldown_window_seconds} className="border-zinc-800 bg-black text-zinc-100" onChange={(event) => setForm((current) => ({ ...current, cooldown_window_seconds: clampInteger(event.target.value, 60, 86400, current.cooldown_window_seconds) }))} /></div>
                  <div className="space-y-2"><Label>Button lifetime seconds</Label><Input type="number" value={form.interaction_timeout_seconds} className="border-zinc-800 bg-black text-zinc-100" onChange={(event) => setForm((current) => ({ ...current, interaction_timeout_seconds: clampInteger(event.target.value, 30, 43200, current.interaction_timeout_seconds) }))} /></div>
                  <div className="space-y-2"><Label>Resolved drop delete seconds</Label><Input type="number" value={form.resolved_drop_delete_seconds} className="border-zinc-800 bg-black text-zinc-100" onChange={(event) => setForm((current) => ({ ...current, resolved_drop_delete_seconds: clampInteger(event.target.value, 0, 3600, current.resolved_drop_delete_seconds) }))} /></div>
                  <div className="space-y-2"><Label>Ephemeral notice delete seconds</Label><Input type="number" value={form.ephemeral_notice_delete_seconds} className="border-zinc-800 bg-black text-zinc-100" onChange={(event) => setForm((current) => ({ ...current, ephemeral_notice_delete_seconds: clampInteger(event.target.value, 0, 840, current.ephemeral_notice_delete_seconds) }))} /></div>
                  <div className="space-y-2"><Label>Claim result visibility</Label><select value={form.claim_result_visibility} className="flex h-10 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100" onChange={(event) => setForm((current) => ({ ...current, claim_result_visibility: event.target.value as FunConfig["claim_result_visibility"] }))}><option value="public">Public</option><option value="ephemeral">Ephemeral</option></select></div>
                  <div className="space-y-2"><Label>Pass result visibility</Label><select value={form.pass_result_visibility} className="flex h-10 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100" onChange={(event) => setForm((current) => ({ ...current, pass_result_visibility: event.target.value as FunConfig["pass_result_visibility"] }))}><option value="public">Public</option><option value="ephemeral">Ephemeral</option></select></div>
                  <div className="space-y-2"><Label>Smash button label</Label><Input value={form.smash_button_label} className="border-zinc-800 bg-black text-zinc-100" onChange={(event) => setForm((current) => ({ ...current, smash_button_label: event.target.value }))} /></div>
                  <div className="space-y-2"><Label>Pass button label</Label><Input value={form.pass_button_label} className="border-zinc-800 bg-black text-zinc-100" onChange={(event) => setForm((current) => ({ ...current, pass_button_label: event.target.value }))} /></div>
                </CardContent>
              </Card>

              <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
                <CardHeader><CardTitle>Templates</CardTitle><CardDescription className="text-zinc-400">Placeholders: <code>{"{type}"}</code>, <code>{"{type_title}"}</code>, <code>{"{claimer_mention}"}</code>, <code>{"{actor_mention}"}</code>, <code>{"{server_name}"}</code>, <code>{"{claimed_at}"}</code>, <code>{"{retry_after}"}</code>, <code>{"{window_text}"}</code>, <code>{"{max_uses}"}</code>, <code>{"{dm_status}"}</code>.</CardDescription></CardHeader>
                <CardContent className="space-y-5">
                  {TEMPLATE_FIELDS.map(([label, key, multiline]) => (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      {multiline ? (
                        <Textarea value={String(form[key])} className="min-h-[110px] border-zinc-800 bg-black text-zinc-100" onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
                      ) : (
                        <Input value={String(form[key])} className="border-zinc-800 bg-black text-zinc-100" onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
                <CardHeader><CardTitle>Preview</CardTitle><CardDescription className="text-zinc-400">Preview summon, claim, pass, DM, cooldown, and expired states before saving.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">{(["waifu", "husbando"] as PreviewType[]).map((type) => <button key={type} type="button" onClick={() => setPreviewType(type)} className={`rounded-full px-3 py-1.5 text-sm ${previewType === type ? "bg-pink-500 text-white" : "border border-zinc-800 bg-zinc-900 text-zinc-300"}`}>{getTypeTitle(type)}</button>)}</div>
                  <div className="flex flex-wrap gap-2">{(["summon", "claim", "pass", "dm", "cooldown", "expired"] as PreviewMode[]).map((mode) => <button key={mode} type="button" onClick={() => setPreviewMode(mode)} className={`rounded-full px-3 py-1.5 text-xs ${previewMode === mode ? "bg-blue-500 text-white" : "border border-zinc-800 bg-zinc-900 text-zinc-300"}`}>{mode}</button>)}</div>
                  <div className="rounded-[26px] border border-zinc-800 bg-[linear-gradient(180deg,rgba(17,24,39,0.95),rgba(9,9,11,0.98))] p-4">
                    <div className="flex items-center justify-between"><span className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Discord Container</span><Badge className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-900">{preview.visibility}</Badge></div>
                    <div className="mt-4 text-lg font-semibold text-white">{preview.title}</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{preview.body}</div>
                    <img src={SAMPLE_IMAGES[previewType]} alt={previewType} className="mt-4 h-80 w-full rounded-2xl border border-zinc-800 object-cover" />
                    <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/40 p-3 text-xs leading-5 text-zinc-400">Artist: kooskoo<br />Source: https://kooskoo.tumblr.com/post/653303098327056384/rkgk</div>
                    {previewMode === "summon" && <div className="mt-4 grid grid-cols-2 gap-3"><button type="button" className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white">{form.smash_button_label}</button><button type="button" className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white">{form.pass_button_label}</button></div>}
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-300">Cooldown window: {formatDuration(form.cooldown_window_seconds)}<br />Buttons active for: {formatDuration(form.interaction_timeout_seconds)}<br />Resolved drop delete: {form.resolved_drop_delete_seconds === 0 ? "manual" : formatDuration(form.resolved_drop_delete_seconds)}<br />Ephemeral cleanup: {form.ephemeral_notice_delete_seconds === 0 ? "disabled" : formatDuration(form.ephemeral_notice_delete_seconds)}</div>
                </CardContent>
              </Card>

              <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
                <CardHeader><CardTitle>Save</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className={`rounded-2xl border p-4 text-sm ${message.toLowerCase().includes("saved") ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-zinc-800 bg-zinc-900/70 text-zinc-300"}`}>{message}</div>
                  <div className="flex gap-3"><Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={load}>Reload</Button><Button type="button" className="bg-pink-600 text-white hover:bg-pink-500" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Fun Module"}</Button></div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
