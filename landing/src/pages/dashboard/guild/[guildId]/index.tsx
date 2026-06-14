import Link from "next/link";
import { useRouter } from "next/router";
import {
  Activity,
  Crown,
  Heart,
  LayoutDashboard,
  MessageSquare,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { BoneyardCard, BoneyardHeroCard } from "@/components/ui/boneyard-skeleton";
import { useGuildOverview, type OverviewPayload } from "@/lib/api";

type AnalyticsRow = {
  date: string;
  member_count: number;
  human_count: number;
  bot_count: number;
};

type ModuleRow = {
  name: string;
  display_name?: string;
  description?: string;
  category?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

type GuildData = {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
  member_count?: number;
  premium_tier?: number;
  premium_subscription_count?: number;
};

type RealtimeState = "idle" | "connecting" | "live" | "offline";

function guildIconUrl(guild: GuildData | null) {
  if (!guild?.icon || !guild?.id) return null;
  const iconHash = guild.icon;
  const iconExt = iconHash.startsWith("a_") ? "gif" : "png";
  const iconPath = iconHash.includes(".") ? iconHash : `${iconHash}.${iconExt}`;
  return `https://cdn.discordapp.com/icons/${guild.id}/${iconPath}?size=256`;
}

function formatDate(input: string) {
  return new Date(input).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRelativeTime(input: string) {
  const delta = Date.now() - new Date(input).getTime();
  const seconds = Math.max(Math.round(delta / 1000), 0);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

const moduleMeta: Record<string, { icon: ReactNode; href: string; description: string }> = {
  moderation: { icon: <Shield className="h-5 w-5" />, href: "moderation", description: "Ban, kick, warn, timeout users" },
  community: { icon: <Users className="h-5 w-5" />, href: "community", description: "Welcome, leave, boost, and staff tools" },
  fun: { icon: <Heart className="h-5 w-5" />, href: "fun", description: "Waifu and husbando drops with claim buttons" },
  settings: { icon: <Zap className="h-5 w-5" />, href: "settings", description: "Bot configuration" },
  tools: { icon: <MessageSquare className="h-5 w-5" />, href: "tools", description: "Utility commands and helpers" },
};

function buildChartPath(points: number[], width: number, height: number) {
  if (points.length === 0) return "";
  const maxValue = Math.max(...points, 1);
  const stepX = points.length === 1 ? width : width / (points.length - 1);
  return points
    .map((value, index) => {
      const x = index * stepX;
      const y = height - (value / maxValue) * (height - 12) - 6;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function getBoostCount(guild: GuildData | null): number {
  return guild?.premium_subscription_count ?? 0;
}

function getBoostTier(guild: GuildData | null): number {
  return guild?.premium_tier ?? 0;
}

export default function GuildOverviewPage() {
  const router = useRouter();
  const { guildId } = router.query;
  const gid = typeof guildId === "string" ? guildId : undefined;

  const { data: initialPayload, isLoading, error, refetch, isRefetching } = useGuildOverview(gid);

  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [timeRange, setTimeRange] = useState<"1w" | "1m" | "all">("1w");
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("idle");

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

  useEffect(() => {
    if (initialPayload) {
      startTransition(() => setPayload(initialPayload));
    }
  }, [initialPayload]);

  const applyPayload = useCallback((nextPayload: OverviewPayload) => {
    startTransition(() => setPayload(nextPayload));
  }, []);

  useEffect(() => {
    if (!gid) return;

    const cleanupSocket = () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (reconnectTimerRef.current != null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelledRef.current) return;
      const attempt = Math.min(reconnectAttemptsRef.current + 1, 5);
      reconnectAttemptsRef.current = attempt;
      const delay = Math.min(2500 * attempt, 15000);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    async function connect() {
      cleanupSocket();
      setRealtimeState("connecting");

      try {
        const response = await fetch(`/api/dashboard/guild/${gid}/socket-ticket`, {
          method: "POST",
        });

        if (!response.ok) throw new Error("Failed to create realtime connection");

        const data = await response.json();
        if (!data?.ticket || !data?.wsUrl) throw new Error("Invalid realtime connection payload");

        const socket = new WebSocket(`${data.wsUrl}?ticket=${encodeURIComponent(data.ticket)}`);
        socketRef.current = socket;

        socket.onopen = () => {
          reconnectAttemptsRef.current = 0;
          setRealtimeState("live");
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message?.type === "overview:update" && message.payload) {
              applyPayload(message.payload);
            }
          } catch { }
        };

        socket.onerror = () => setRealtimeState("offline");
        socket.onclose = () => {
          setRealtimeState("offline");
          scheduleReconnect();
        };
      } catch {
        setRealtimeState("offline");
        scheduleReconnect();
      }
    }

    connect();

    return cleanupSocket;
  }, [gid, applyPayload]);

  useEffect(() => {
    if (!gid) return;
    const timer = setInterval(() => {
      refetch();
    }, realtimeState === "live" ? 5 * 60 * 1000 : 90 * 1000);
    return () => clearInterval(timer);
  }, [gid, refetch, realtimeState]);

  const guild = payload?.guild ?? null;
  const modules = payload?.modules ?? [];
  const analytics = payload?.analytics ?? [];
  const stats = payload?.stats;
  const latest = analytics[analytics.length - 1];
  const boostCount = getBoostCount(guild);
  const boostTier = getBoostTier(guild);

  const enabledModules = useMemo(
    () =>
      modules
        .filter((module) => module.enabled !== false)
        .filter((module) => module.name.toLowerCase() !== "tickets")
        .map((module) => ({
          ...module,
          meta:
            moduleMeta[module.name.toLowerCase()] ?? {
              icon: <LayoutDashboard className="h-5 w-5" />,
              href: module.name.toLowerCase(),
              description: module.description || "Manage this module.",
            },
        })),
    [modules]
  );

  const filteredAnalytics = useMemo(() => {
    if (!analytics.length) return [];
    const now = new Date();
    const days = timeRange === "1w" ? 7 : timeRange === "1m" ? 30 : 365;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return analytics.filter((item) => new Date(item.date) >= cutoff);
  }, [analytics, timeRange]);

  const deferredAnalytics = useDeferredValue(filteredAnalytics);
  const memberSeries = useMemo(() => deferredAnalytics.map((item) => item.member_count || 0), [deferredAnalytics]);
  const chartPath = useMemo(() => buildChartPath(memberSeries, 520, 180), [memberSeries]);
  const totalMembers = latest?.member_count ?? guild?.member_count ?? 0;
  const humanMembers = latest?.human_count ?? Math.max(totalMembers - (latest?.bot_count ?? 0), 0);
  const botMembers = latest?.bot_count ?? 0;

  const topStats = [
    {
      label: "Members",
      value: totalMembers,
      helper: `${humanMembers} humans / ${botMembers} bots`,
      href: `/dashboard/guild/${gid}/community`,
    },
    {
      label: "Boosts",
      value: boostCount,
      helper: boostCount > 0 ? `Tier ${boostTier}` : "No boosts yet",
      href: `/dashboard/guild/${gid}/settings`,
    },
    {
      label: "Live Modules",
      value: enabledModules.length,
      helper: `${modules.length} total configured`,
      href: `/dashboard/guild/${gid}`,
    },
    {
      label: "Channels",
      value: stats?.channels_count ?? 0,
      helper: `${stats?.roles_count ?? 0} roles, ${stats?.emojis_count ?? 0} emojis`,
      href: `/dashboard/guild/${gid}/community`,
    },
  ];

  const layoutModules = modules as Array<{ name: string; display_name?: string; enabled?: boolean }>;

  return (
    <DashboardLayout guildId={gid ?? ""} guildName={guild?.name || "Guild"} heading="Overview" modules={layoutModules}>
      {isLoading && (
        <div className="space-y-6">
          <BoneyardHeroCard />
          <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <BoneyardCard key={index} lines={2} />
            ))}
          </section>
          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <BoneyardCard lines={6} />
            <BoneyardCard lines={5} />
          </section>
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-[24px] border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
          {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && guild && (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-[30px] border border-border/70 bg-card/80">
            <div className="border-b border-border/60 px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {guildIconUrl(guild) ? (
                    <img
                      src={guildIconUrl(guild) ?? ""}
                      alt={guild.name}
                      className="h-16 w-16 rounded-2xl border border-border/70 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/70 bg-primary/12 text-2xl font-bold text-primary">
                      {guild.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Guild Overview</div>
                    <h1 className="mt-2 text-3xl font-semibold text-foreground">{guild.name}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span>ID: {guild.id}</span>
                      <span>Owner: {guild.owner_id}</span>
                      {boostCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-pink-400">
                          <Crown className="h-3.5 w-3.5" />
                          {boostCount} boosts
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    <span className={`h-2.5 w-2.5 rounded-full ${realtimeState === "live" ? "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.8)]" : realtimeState === "connecting" ? "bg-amber-400" : "bg-red-400"}`} />
                    {realtimeState === "live" ? "Live Feed" : realtimeState === "connecting" ? "Connecting" : "Fallback Polling"}
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-right">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Refreshed</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{formatRelativeTime(payload?.refreshed_at ?? "")}</div>
                    {isRefetching && <div className="mt-1 text-[11px] text-primary">Refreshing snapshot...</div>}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px bg-border/60 xl:grid-cols-4">
              {topStats.map((stat) => (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="bg-card px-5 py-5 transition-colors hover:bg-primary/5"
                >
                  <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">{stat.label}</div>
                  <div className="mt-3 text-3xl font-semibold text-foreground">{stat.value}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{stat.helper}</div>
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-border/70 bg-card/70 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-primary" />
                  <div>
                    <h2 className="font-semibold text-foreground">Guild Trend</h2>
                    <p className="text-xs text-muted-foreground">Cached backend snapshots plus live overview refreshes.</p>
                  </div>
                </div>

                <div className="flex rounded-xl border border-border/70 bg-background/60 p-1">
                  {(["1w", "1m", "all"] as const).map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setTimeRange(range)}
                      className={`rounded-lg px-3 py-1.5 text-xs uppercase tracking-[0.22em] transition-colors ${
                        timeRange === range ? "bg-primary/14 text-primary" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-[24px] border border-border/60 bg-background/40 p-4">
                {deferredAnalytics.length === 0 ? (
                  <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                    No analytics recorded yet for this guild.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Current Population</div>
                        <div className="mt-2 text-4xl font-semibold text-foreground">{totalMembers}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl border border-border/60 bg-card/70 px-4 py-3">
                          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Humans</div>
                          <div className="mt-2 text-lg font-semibold text-foreground">{humanMembers}</div>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-card/70 px-4 py-3">
                          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Bots</div>
                          <div className="mt-2 text-lg font-semibold text-foreground">{botMembers}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 h-[220px] overflow-hidden rounded-[22px] border border-border/60 bg-card/50 p-4">
                      <svg viewBox="0 0 520 180" className="h-full w-full">
                        <defs>
                          <linearGradient id="overviewLineFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d={chartPath} fill="none" stroke="hsl(var(--foreground))" strokeWidth="2" strokeLinecap="round" />
                        {chartPath && (
                          <path
                            d={`${chartPath} L 520 180 L 0 180 Z`}
                            fill="url(#overviewLineFill)"
                            opacity="0.7"
                          />
                        )}
                      </svg>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-between gap-3 text-xs text-muted-foreground">
                      {deferredAnalytics.slice(Math.max(deferredAnalytics.length - 6, 0)).map((point) => (
                        <div key={point.date} className="min-w-[68px]">
                          <div>{formatDate(point.date)}</div>
                          <div className="mt-1 text-foreground">{point.member_count}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <section className="rounded-[28px] border border-border/70 bg-card/70 p-6">
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-primary" />
                  <div>
                    <h2 className="font-semibold text-foreground">Quick Actions</h2>
                    <p className="text-xs text-muted-foreground">Jump straight into live modules.</p>
                  </div>
                </div>

                {enabledModules.length === 0 ? (
                  <p className="mt-5 text-sm text-muted-foreground">No modules enabled yet.</p>
                ) : (
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    {enabledModules.map((module) => (
                      <Link
                        key={module.name}
                        href={`/dashboard/guild/${gid}/${module.meta.href}`}
                        className="group rounded-[22px] border border-border/60 bg-background/50 px-4 py-4 transition-all hover:border-primary/40 hover:bg-primary/5"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 text-primary transition-transform group-hover:scale-110">
                            {module.meta.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">{module.display_name || module.name}</div>
                            <div className="mt-1 text-xs leading-6 text-muted-foreground">{module.meta.description}</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-[28px] border border-border/70 bg-card/70 p-6">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <h2 className="font-semibold text-foreground">Guild Distribution</h2>
                    <p className="text-xs text-muted-foreground">Server structure and live composition.</p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Roles</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{stats?.roles_count ?? 0}</div>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Channels</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{stats?.channels_count ?? 0}</div>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Emojis</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{stats?.emojis_count ?? 0}</div>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Stickers</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{stats?.stickers_count ?? 0}</div>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
