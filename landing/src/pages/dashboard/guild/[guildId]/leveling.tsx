import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Medal, Palette, Save } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { BoneyardCard } from "@/components/ui/boneyard-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ModuleRow = {
  name: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

type OverviewPayload = {
  guild: { name: string };
  modules: ModuleRow[];
};

type RankCardConfig = {
  background_color: string;
  panel_color: string;
  panel_border_color: string;
  display_name_color: string;
  username_color: string;
  rank_color: string;
  rank_label_color: string;
  progress_track_color: string;
  progress_start_color: string;
  progress_end_color: string;
  progress_text_color: string;
  stat_card_color: string;
  stat_label_color: string;
  stat_value_color: string;
  status_color: string;
  grid_color: string;
};

const DEFAULT_RANK_CARD: RankCardConfig = {
  background_color: "#101212",
  panel_color: "#151716",
  panel_border_color: "#2A2D2B",
  display_name_color: "#FFFFFF",
  username_color: "#9A9A9A",
  rank_color: "#FFFFFF",
  rank_label_color: "#FF1717",
  progress_track_color: "#2B2527",
  progress_start_color: "#FF1212",
  progress_end_color: "#FF4141",
  progress_text_color: "#FF1717",
  stat_card_color: "#070708",
  stat_label_color: "#A0A0A0",
  stat_value_color: "#FFFFFF",
  status_color: "#7DFF8D",
  grid_color: "#252A28",
};

const COLOR_FIELDS: Array<{ key: keyof RankCardConfig; label: string }> = [
  { key: "background_color", label: "Background" },
  { key: "grid_color", label: "Grid" },
  { key: "panel_color", label: "Avatar panel" },
  { key: "panel_border_color", label: "Panel border" },
  { key: "display_name_color", label: "Display name" },
  { key: "username_color", label: "Username / small text" },
  { key: "rank_color", label: "Rank number" },
  { key: "rank_label_color", label: "Rank label" },
  { key: "progress_track_color", label: "Progress track" },
  { key: "progress_start_color", label: "Progress start" },
  { key: "progress_end_color", label: "Progress end" },
  { key: "progress_text_color", label: "Progress text" },
  { key: "stat_card_color", label: "Stat cards" },
  { key: "stat_label_color", label: "Stat labels" },
  { key: "stat_value_color", label: "Stat values" },
  { key: "status_color", label: "Status pill" },
];

function normalizeColor(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toUpperCase() : fallback;
}

function colorInputValue(value: string, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function normalizeConfig(input?: Record<string, unknown> | null): RankCardConfig {
  const raw = (input?.rank_card ?? {}) as Partial<RankCardConfig>;
  return Object.fromEntries(
    Object.entries(DEFAULT_RANK_CARD).map(([key, fallback]) => [
      key,
      normalizeColor(raw[key as keyof RankCardConfig], fallback),
    ])
  ) as RankCardConfig;
}

export default function LevelingPage() {
  const router = useRouter();
  const { guildId } = router.query;
  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [form, setForm] = useState<RankCardConfig>(DEFAULT_RANK_CARD);
  const [message, setMessage] = useState("Use /rank to generate the card with these colors.");

  const load = useCallback(async () => {
    if (!guildId || typeof guildId !== "string") return;
    try {
      const response = await fetch(`/api/dashboard/guild/${guildId}/overview`);
      if (response.status === 401) {
        router.replace("/api/auth/discord");
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to load leveling module");
      const module = (data.modules || []).find((entry: ModuleRow) => entry.name.toLowerCase() === "leveling");
      setPayload(data);
      setEnabled(module?.enabled !== false);
      setForm(normalizeConfig(module?.config ?? {}));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leveling module");
    } finally {
      setLoading(false);
    }
  }, [guildId, router]);

  useEffect(() => {
    load();
  }, [load]);

  const previewStyle = useMemo(() => ({
    backgroundColor: form.background_color,
    color: form.display_name_color,
    borderColor: form.panel_border_color,
  }), [form]);

  const save = async () => {
    if (!guildId || typeof guildId !== "string") return;
    setSaving(true);
    setMessage("Saving...");
    try {
      const response = await fetch(`/api/modules/${guildId}/leveling`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          config: {
            rank_card: form,
          },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to save leveling settings");
      }
      setMessage("Saved. /rank will use this card style.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save leveling settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout guildId={String(guildId || "")} guildName={payload?.guild.name || "Guild"} heading="Leveling" modules={payload?.modules || []}>
        <BoneyardCard lines={5} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout guildId={String(guildId || "")} guildName={payload?.guild.name || "Guild"} heading="Leveling" modules={payload?.modules || []}>
      <div className="space-y-6">
        {error ? <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <div className="mb-2 inline-flex w-fit rounded-xl border border-border/70 bg-background/60 p-2">
                <Palette className="h-4 w-4" />
              </div>
              <CardTitle>Rank Card Styling</CardTitle>
              <CardDescription>
                The user avatar is locked to whoever runs /rank. Only card colors are configurable here.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {COLOR_FIELDS.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label>{field.label}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={colorInputValue(form[field.key], DEFAULT_RANK_CARD[field.key])}
                      onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value.toUpperCase() }))}
                      className="h-10 w-14 p-1"
                    />
                    <Input
                      value={form[field.key]}
                      onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value.toUpperCase() }))}
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 inline-flex w-fit rounded-xl border border-border/70 bg-background/60 p-2">
                <Medal className="h-4 w-4" />
              </div>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>Preview uses a locked placeholder avatar. Discord will use the command user's avatar.</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="overflow-hidden rounded-2xl border p-4"
                style={{
                  ...previewStyle,
                  backgroundImage: `linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px), radial-gradient(circle at 88% 15%, ${form.progress_start_color}33, transparent 34%)`,
                  backgroundSize: "50px 50px, 50px 50px, 100% 100%",
                }}
              >
                <div className="grid gap-6 md:grid-cols-[16.4rem_1fr]">
                  <div className="rounded-3xl border p-5 text-center" style={{ backgroundColor: `${form.panel_color}CC`, borderColor: form.panel_border_color }}>
                    <div className="mx-auto h-32 w-32 rounded-full border-[3px]" style={{ borderColor: form.progress_start_color, background: `linear-gradient(135deg, ${form.progress_start_color}, ${form.progress_end_color})`, boxShadow: `0 0 20px ${form.progress_start_color}77` }} />
                    <div className="mt-5 text-6xl font-black tracking-tight" style={{ color: form.rank_color }}>#4</div>
                    <div className="text-base uppercase" style={{ color: form.rank_label_color }}>Global Rank</div>
                  </div>
                  <div className="py-4">
                    <div className="text-4xl font-black uppercase tracking-tight" style={{ color: form.display_name_color, fontFamily: '"Arial Rounded MT Bold", "Trebuchet MS", sans-serif' }}>Jay Walker :))</div>
                    <div className="mt-8 flex justify-between text-base uppercase" style={{ color: form.progress_text_color }}>
                      <span>Weekly Progress</span>
                      <span>3K / 5K</span>
                    </div>
                    <div className="mt-3 h-4 rounded-full" style={{ backgroundColor: form.progress_track_color }}>
                      <div className="h-4 w-[60%] rounded-full" style={{ background: `linear-gradient(90deg, ${form.progress_start_color}, ${form.progress_end_color})`, boxShadow: `0 0 22px ${form.progress_start_color}` }} />
                    </div>
                    <div className="mt-2 text-sm" style={{ color: form.username_color }}>2006 more for next role</div>
                    <div className="mt-10 grid gap-5 sm:grid-cols-2">
                      {["Daily Msgs", "Lifetime"].map((label, index) => (
                        <div key={label} className="rounded-xl p-5" style={{ backgroundColor: `${form.stat_card_color}B8` }}>
                          <div className="text-base uppercase" style={{ color: form.stat_label_color }}>{label}</div>
                          <div className="mt-2 text-4xl font-black" style={{ color: form.stat_value_color, fontFamily: '"Arial Rounded MT Bold", "Trebuchet MS", sans-serif' }}>{index === 0 ? "3K" : "90K"}</div>
                          <div className="text-sm" style={{ color: form.username_color }}>{index === 0 ? "2,994" : "89,552"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">{message}</p>
                <Button onClick={save} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Leveling"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
