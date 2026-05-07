import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { CalendarDays, Clock3, Medal, MessageSquareText, Palette, Save, Sparkles, Trophy, TrendingUp, UserRound, Zap } from "lucide-react";
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

type RankCardPreviewData = {
  displayName: string;
  username: string;
  rank: string;
  rankLabel: string;
  progressLabel: string;
  progressValue: string;
  progressPercent: number;
  progressPercentText: string;
  progressHint: string;
  statusText: string;
  dailyXpLabel: string;
  dailyXpValue: string;
  dailyXpSubvalue: string;
  lifetimeXpLabel: string;
  lifetimeXpValue: string;
  lifetimeXpSubvalue: string;
  memberSinceLabel: string;
  memberSinceValue: string;
  streakLabel: string;
  streakValue: string;
  lastActiveLabel: string;
  lastActiveValue: string;
  roleBadgeText: string;
  avatarUrl: string;
};

const DEFAULT_RANK_CARD: RankCardConfig = {
  background_color: "#0B0F14",
  panel_color: "#11161C",
  panel_border_color: "#A855F7",
  display_name_color: "#FFFFFF",
  username_color: "#9CA3AF",
  rank_color: "#FFFFFF",
  rank_label_color: "#9CA3AF",
  progress_track_color: "#1A1F26",
  progress_start_color: "#A855F7",
  progress_end_color: "#A855F7",
  progress_text_color: "#FFFFFF",
  stat_card_color: "#11161C",
  stat_label_color: "#9CA3AF",
  stat_value_color: "#FFFFFF",
  status_color: "#22C55E",
  grid_color: "#FFFFFF",
};

const DEFAULT_PREVIEW_DATA: RankCardPreviewData = {
  displayName: "Akira",
  username: "@friedrichnietzscheisme",
  rank: "#43",
  rankLabel: "GLOBAL RANK",
  progressLabel: "WEEKLY PROGRESS",
  progressValue: "2.9K / 5K",
  progressPercent: 58,
  progressPercentText: "58%",
  progressHint: "2.1K more for next role",
  statusText: "SUPER ACTIVE",
  dailyXpLabel: "DAILY XP",
  dailyXpValue: "3.5K",
  dailyXpSubvalue: "3,521",
  lifetimeXpLabel: "LIFETIME XP",
  lifetimeXpValue: "89.1K",
  lifetimeXpSubvalue: "89,121",
  memberSinceLabel: "Member since",
  memberSinceValue: "Jan 12, 2024",
  streakLabel: "Activity streak",
  streakValue: "28 days",
  lastActiveLabel: "Last active",
  lastActiveValue: "5m ago",
  roleBadgeText: "RANKED USER",
  avatarUrl: "https://images.unsplash.com/photo-1614642264762-d0a3b8bf3700?auto=format&fit=crop&w=320&q=80",
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
  const [previewData] = useState<RankCardPreviewData>(DEFAULT_PREVIEW_DATA);
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
              <CardDescription>Preview data is placeholder content and can be mapped to per-user values later.</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="overflow-hidden rounded-2xl border p-4"
                style={{
                  ...previewStyle,
                  backgroundImage: "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)",
                  backgroundSize: "44px 44px, 44px 44px",
                }}
              >
                <div className="rounded-[20px] border p-6" style={{ backgroundColor: form.background_color, borderColor: `${form.panel_border_color}8C`, boxShadow: `0 0 0 1px ${form.panel_border_color}26, 0 26px 80px -44px ${form.panel_border_color}85` }}>
                  <div className="grid gap-7 lg:grid-cols-[255px_1fr]">
                    <div className="relative border-b border-white/10 pb-7 text-center lg:border-b-0 lg:border-r lg:pb-0 lg:pr-7">
                      <div className="absolute left-3 top-3 h-[92%] w-[92%] rounded-[26px]" style={{ border: `1px solid ${form.panel_border_color}2E` }} />
                      <div className="relative mx-auto mt-4 h-[170px] w-[170px] rounded-full border-[8px] p-[7px]" style={{ borderColor: form.progress_start_color, backgroundColor: form.panel_color, boxShadow: `0 0 0 8px ${form.progress_start_color}1F, 0 0 46px ${form.progress_start_color}66` }}>
                        <img src={previewData.avatarUrl} alt="Rank avatar placeholder" className="h-full w-full rounded-full object-cover" />
                      </div>
                      <div className="absolute bottom-[128px] right-[26px] flex h-11 w-11 items-center justify-center rounded-full border text-white" style={{ borderColor: `${form.panel_border_color}55`, backgroundColor: `${form.panel_color}E6` }}>
                        <Sparkles className="h-5 w-5" style={{ color: form.progress_start_color }} />
                      </div>
                      <div className="relative mt-7 text-[86px] font-black leading-none tracking-[-0.03em]" style={{ color: form.rank_color }}>
                        {previewData.rank}
                        <span className="absolute left-0 top-0 -z-10 w-full text-[88px] tracking-[-0.045em]" style={{ color: `${form.rank_color}12` }}>
                          {previewData.rank}
                        </span>
                      </div>
                      <div className="-mt-1 text-[29px] font-black leading-none tracking-[-0.045em]" style={{ color: `${form.rank_color}14` }}>
                        {previewData.rank.replace("#", "")}
                      </div>
                      <div className="mt-1 text-[30px] font-black leading-none tracking-[-0.05em]" style={{ color: `${form.rank_color}10` }}>
                        {previewData.rank.replace("#", "")}
                      </div>
                      <div className="mt-3 text-[26px] font-bold uppercase tracking-[0.11em]" style={{ color: form.rank_label_color }}>
                        {previewData.rankLabel}
                      </div>
                      <div className="mx-auto mt-7 inline-flex items-center gap-3 rounded-full border px-6 py-2 text-base font-black uppercase tracking-wide" style={{ color: form.status_color, borderColor: `${form.status_color}70`, backgroundColor: "#0C2A1D" }}>
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: form.status_color }} />
                        {previewData.statusText}
                      </div>
                    </div>
                    <div className="py-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[56px] font-black leading-none tracking-[-0.04em]" style={{ color: form.display_name_color }}>{previewData.displayName}</div>
                          <div className="mt-2 text-[29px] font-medium tracking-[-0.01em]" style={{ color: form.username_color }}>{previewData.username}</div>
                        </div>
                        <div className="inline-flex items-center gap-3 rounded-xl border px-4 py-2 text-sm font-bold uppercase tracking-wide" style={{ color: form.rank_label_color, borderColor: `${form.panel_border_color}4D`, backgroundColor: `${form.panel_color}BF` }}>
                          <UserRound className="h-4 w-4" style={{ color: form.progress_start_color }} />
                          {previewData.roleBadgeText}
                        </div>
                      </div>

                      <div className="mt-7 text-[31px] font-bold uppercase tracking-[0.07em]" style={{ color: form.stat_label_color }}>
                        {previewData.progressLabel}
                      </div>
                      <div className="mt-3 h-12 rounded-full border p-[2px]" style={{ borderColor: `${form.progress_track_color}C0`, backgroundColor: `${form.progress_track_color}66` }}>
                        <div
                          className="flex h-full items-center justify-center rounded-full text-[30px] font-black tracking-[-0.02em]"
                          style={{
                            width: `${previewData.progressPercent}%`,
                            background: `linear-gradient(90deg, ${form.progress_start_color}, ${form.progress_end_color})`,
                            color: form.progress_text_color,
                          }}
                        >
                          {previewData.progressValue}
                        </div>
                      </div>
                      <div className="-mt-[36px] pr-6 text-right text-[27px] font-black tracking-[-0.02em]" style={{ color: form.rank_label_color }}>{previewData.progressPercentText}</div>
                      <div className="mt-6 inline-flex items-center gap-3 text-[30px] font-semibold tracking-[-0.01em]" style={{ color: form.username_color }}>
                        <TrendingUp className="h-5 w-5" style={{ color: form.progress_start_color }} />
                        {previewData.progressHint}
                      </div>

                      <div className="mt-7 rounded-2xl border p-5" style={{ borderColor: `${form.panel_border_color}24`, backgroundColor: `${form.stat_card_color}A6` }}>
                        <div className="grid gap-5 md:grid-cols-2">
                          <div className="rounded-2xl border p-4" style={{ borderColor: `${form.panel_border_color}2A`, backgroundColor: `${form.panel_color}99` }}>
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl border" style={{ borderColor: `${form.panel_border_color}50`, color: form.progress_start_color }}>
                                <MessageSquareText className="h-6 w-6" />
                              </div>
                              <div className="text-[30px] font-bold uppercase tracking-[0.07em]" style={{ color: form.stat_label_color }}>{previewData.dailyXpLabel}</div>
                            </div>
                            <div className="mt-2 text-[58px] font-black leading-none tracking-[-0.04em]" style={{ color: form.stat_value_color }}>{previewData.dailyXpValue}</div>
                            <div className="mt-1 text-[29px] font-semibold tracking-[-0.01em]" style={{ color: form.username_color }}>{previewData.dailyXpSubvalue}</div>
                          </div>
                          <div className="rounded-2xl border p-4" style={{ borderColor: `${form.panel_border_color}2A`, backgroundColor: `${form.panel_color}99` }}>
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl border" style={{ borderColor: `${form.panel_border_color}50`, color: form.progress_start_color }}>
                                <Trophy className="h-6 w-6" />
                              </div>
                              <div className="text-[30px] font-bold uppercase tracking-[0.07em]" style={{ color: form.stat_label_color }}>{previewData.lifetimeXpLabel}</div>
                            </div>
                            <div className="mt-2 text-[58px] font-black leading-none tracking-[-0.04em]" style={{ color: form.stat_value_color }}>{previewData.lifetimeXpValue}</div>
                            <div className="mt-1 text-[29px] font-semibold tracking-[-0.01em]" style={{ color: form.username_color }}>{previewData.lifetimeXpSubvalue}</div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-3" style={{ borderColor: `${form.panel_border_color}26` }}>
                        <div className="flex items-start gap-2">
                          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" style={{ color: form.rank_label_color }} />
                          <div>
                            <div className="text-[26px] font-medium leading-tight tracking-[-0.01em]" style={{ color: form.rank_label_color }}>{previewData.memberSinceLabel}</div>
                            <div className="text-[29px] font-semibold leading-tight tracking-[-0.01em]" style={{ color: form.stat_value_color }}>{previewData.memberSinceValue}</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Zap className="mt-0.5 h-4 w-4 shrink-0" style={{ color: form.rank_label_color }} />
                          <div>
                            <div className="text-[26px] font-medium leading-tight tracking-[-0.01em]" style={{ color: form.rank_label_color }}>{previewData.streakLabel}</div>
                            <div className="text-[29px] font-semibold leading-tight tracking-[-0.01em]" style={{ color: form.stat_value_color }}>{previewData.streakValue}</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: form.rank_label_color }} />
                          <div>
                            <div className="text-[26px] font-medium leading-tight tracking-[-0.01em]" style={{ color: form.rank_label_color }}>{previewData.lastActiveLabel}</div>
                            <div className="text-[29px] font-semibold leading-tight tracking-[-0.01em]" style={{ color: form.stat_value_color }}>{previewData.lastActiveValue}</div>
                          </div>
                        </div>
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
