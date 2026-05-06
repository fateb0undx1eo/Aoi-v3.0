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
  background_color: "#0B0D12",
  panel_color: "#12141A",
  panel_border_color: "#8B4DFF",
  display_name_color: "#FFFFFF",
  username_color: "#8E93A1",
  rank_color: "#FFFFFF",
  rank_label_color: "#B24DFF",
  progress_track_color: "#24272E",
  progress_start_color: "#8F38FF",
  progress_end_color: "#B425FF",
  progress_text_color: "#ECEAF7",
  stat_card_color: "#151820",
  stat_label_color: "#9CA0AA",
  stat_value_color: "#FFFFFF",
  status_color: "#23F28A",
  grid_color: "#1D2230",
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
                  backgroundImage: `linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px), radial-gradient(circle at 82% 12%, ${form.progress_start_color}44, transparent 38%)`,
                  backgroundSize: "50px 50px, 50px 50px, 100% 100%",
                }}
              >
                <div className="rounded-2xl border p-5" style={{ backgroundColor: `${form.panel_color}D1`, borderColor: `${form.panel_border_color}AA`, boxShadow: `0 0 28px ${form.progress_start_color}33` }}>
                  <div className="grid gap-8 md:grid-cols-[170px_1fr]">
                    <div className="text-center">
                      <div className="mx-auto h-32 w-32 rounded-full border-[7px]" style={{ borderColor: form.progress_start_color, background: `linear-gradient(135deg, ${form.progress_start_color}, ${form.progress_end_color})`, boxShadow: `0 0 24px ${form.progress_start_color}88` }} />
                      <div className="mt-3 text-6xl font-black tracking-tight" style={{ color: form.rank_color }}>#43</div>
                      <div className="text-xs font-bold uppercase tracking-wide" style={{ color: form.rank_label_color }}>Global Rank</div>
                      <div className="mx-auto mt-3 w-fit rounded-full border px-5 py-1.5 text-xs font-black uppercase" style={{ color: form.status_color, borderColor: form.status_color, backgroundColor: `${form.status_color}1F` }}>Super Active</div>
                    </div>
                    <div className="py-1">
                      <div className="text-4xl font-black tracking-tight" style={{ color: form.display_name_color }}>Akira</div>
                      <div className="mt-1 text-sm font-semibold" style={{ color: form.username_color }}>@friedrichnietzscheisme</div>
                      <div className="mt-5 flex justify-between text-xs font-black uppercase" style={{ color: form.progress_text_color }}>
                      <span>Weekly Progress</span>
                        <span>2.9K / 5K</span>
                      </div>
                      <div className="mt-2 h-[18px] rounded-full" style={{ backgroundColor: form.progress_track_color }}>
                        <div className="h-[18px] w-[62%] rounded-full" style={{ background: `linear-gradient(90deg, ${form.progress_start_color}, ${form.progress_end_color})`, boxShadow: `0 0 18px ${form.progress_start_color}` }} />
                      </div>
                      <div className="mt-2 text-sm font-semibold" style={{ color: form.username_color }}>2.1K more XP for next role</div>
                      <div className="mt-5 grid gap-5 sm:grid-cols-2">
                        {["Daily XP", "Lifetime XP"].map((label, index) => (
                          <div key={label} className="rounded-xl border p-5" style={{ backgroundColor: `${form.stat_card_color}BF`, borderColor: `${form.panel_border_color}33` }}>
                            <div className="text-xs font-black uppercase" style={{ color: form.stat_label_color }}>{label}</div>
                            <div className="mt-2 text-4xl font-black" style={{ color: form.stat_value_color }}>{index === 0 ? "3.5K" : "89.1K"}</div>
                            <div className="text-sm font-semibold" style={{ color: form.username_color }}>{index === 0 ? "3,521" : "89,121"}</div>
                          </div>
                        ))}
                      </div>
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
