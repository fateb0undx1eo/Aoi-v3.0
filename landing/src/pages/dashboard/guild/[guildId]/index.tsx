import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Activity,
  Crown,
  MessageSquare,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import Link from "next/link";
import { BoneyardCard, BoneyardSkeleton } from "@/components/ui/boneyard-skeleton";

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
  config?: Record<string, any>;
};

type GuildData = {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
  stats?: {
    member_count?: number;
    boost_level?: number;
    roles_count?: number;
    emojis_count?: number;
    channels_count?: number;
    premium_subscription_count?: number;
  };
  member_count?: number;
  boost_level?: number;
  premium_subscription_count?: number;
};

type OverviewPayload = {
  guild: GuildData;
  stats?: {
    roles_count?: number;
    channels_count?: number;
    emojis_count?: number;
    stickers_count?: number;
    message_count?: number;
  };
  analytics: AnalyticsRow[];
  modules: ModuleRow[];
  refreshed_at: string;
};

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

// Map module names to their routes and icons
const moduleMeta: Record<string, { icon: React.ReactNode; href: string; description: string }> = {
  moderation: { icon: <Shield className="h-5 w-5" />, href: "moderation", description: "Ban, kick, warn, timeout users" },
  community: { icon: <Users className="h-5 w-5" />, href: "community", description: "Welcome, leave, boost, and staff tools" },
  settings: { icon: <Zap className="h-5 w-5" />, href: "settings", description: "Bot configuration" },
  tools: { icon: <MessageSquare className="h-5 w-5" />, href: "tools", description: "Utility commands and helpers" },
  memes: { icon: <MessageSquare className="h-5 w-5" />, href: "memes", description: "Meme commands and feeds" },
};

// Get actual boost count from guild data
function getBoostCount(guild: GuildData | null): number {
  if (!guild) return 0;
  // Discord stores premium_subscription_count as the actual boost count
  return guild.premium_subscription_count ?? guild.stats?.premium_subscription_count ?? 0;
}

// Get boost tier from level
function getBoostTier(guild: GuildData | null): number {
  if (!guild) return 0;
  return guild.boost_level ?? guild.stats?.boost_level ?? 0;
}

export default function GuildOverviewPage() {
  const router = useRouter();
  const { guildId } = router.query;

  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeRange, setTimeRange] = useState<"1w" | "1m" | "all">("1w");

  const loadOverview = useCallback(async () => {
    if (!guildId || typeof guildId !== "string") return;

    try {
      const response = await fetch(`/api/dashboard/guild/${guildId}/overview`);

      if (response.status === 401) {
        router.replace("/api/auth/discord");
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load dashboard data");
      }

      setPayload(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [guildId, router]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!guildId || typeof guildId !== "string") return;
    const timer = setInterval(loadOverview, 120000);
    return () => clearInterval(timer);
  }, [guildId, loadOverview]);

  const guild = payload?.guild || null;
  const modules = payload?.modules || [];
  const analytics = payload?.analytics || [];
  const latest = analytics[analytics.length - 1];

  const maxMembers = useMemo(
    () => Math.max(1, ...analytics.map((item) => item.member_count || 0)),
    [analytics]
  );

  // Get enabled modules with their metadata
  const enabledModules = useMemo(() => {
    return modules
      .filter((m) => m.enabled !== false)
      .map((m) => ({
        ...m,
        meta: moduleMeta[m.name.toLowerCase()] || { icon: <Zap className="h-5 w-5" />, href: m.name.toLowerCase(), description: m.description || "" },
      }));
  }, [modules]);

  const stats = payload?.stats;
  const totalMembers = (latest?.human_count || 0) + (latest?.bot_count || 0);
  const boostCount = getBoostCount(guild);
  const boostTier = getBoostTier(guild);

  // Filter analytics based on time range
  const filteredAnalytics = useMemo(() => {
    if (!analytics.length) return [];
    const now = new Date();
    const days = timeRange === "1w" ? 7 : timeRange === "1m" ? 30 : 365;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return analytics.filter(a => new Date(a.date) >= cutoff);
  }, [analytics, timeRange]);

  return (
    <DashboardLayout guildId={String(guildId || "")} guildName={guild?.name || "Guild"} heading="Overview" modules={modules}>
      {loading && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-border/70 bg-card/80 p-6">
            <div className="flex items-center gap-4">
              <BoneyardSkeleton className="h-16 w-16 rounded-xl" />
              <div className="flex-1 space-y-3">
                <BoneyardSkeleton className="h-5 w-40" />
                <BoneyardSkeleton className="h-3.5 w-64" />
              </div>
            </div>
          </section>
          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <BoneyardCard key={index} lines={2} />
            ))}
          </section>
          <section className="grid gap-6 lg:grid-cols-2">
            <BoneyardCard lines={5} />
            <BoneyardCard lines={5} />
          </section>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">{error}</div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          {/* Server Header Card */}
          <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-6">
            <div className="absolute right-0 top-0 p-4">
              <div className="rounded-lg border border-border/50 bg-background/50 px-3 py-1.5 text-xs text-muted-foreground">
                {payload?.refreshed_at ? new Date(payload.refreshed_at).toLocaleTimeString() : "--:--:--"}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {guildIconUrl(guild) ? (
                <img
                  src={guildIconUrl(guild) || ""}
                  alt={guild?.name || "Guild"}
                  className="h-16 w-16 rounded-xl border-2 border-border/70 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-border/70 bg-gradient-to-br from-primary/20 to-primary/5 text-2xl font-bold">
                  {guild?.name?.slice(0, 1)?.toUpperCase() || "?"}
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{guild?.name || "Server Name"}</h1>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span>ID: {guild?.id || "000000000000000000"}</span>
                  <span>Owner: {guild?.owner_id || "Unknown"}</span>
                  {boostCount > 0 && (
                    <span className="flex items-center gap-1 text-pink-500">
                      <Crown className="h-3 w-3" />
                      {boostCount} boosts (Level {boostTier})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Stats Row - Clickable */}
          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Link 
              href={`/dashboard/guild/${guildId}/community`}
              className="rounded-xl border border-border/70 bg-card/70 p-4 transition-colors hover:border-primary/50 hover:bg-card/90"
            >
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Members</div>
              <div className="text-3xl font-bold">{guild?.member_count ?? latest?.member_count ?? "0"}</div>
            </Link>
            <button className="rounded-xl border border-border/70 bg-card/70 p-4 text-left transition-colors hover:border-primary/50 hover:bg-card/90">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-orange-500">Security</div>
              <div className="text-lg font-semibold">Stable</div>
            </button>
            <Link 
              href={`/dashboard/guild/${guildId}/settings`}
              className="rounded-xl border border-border/70 bg-card/70 p-4 transition-colors hover:border-primary/50 hover:bg-card/90"
            >
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-pink-500">Boosts</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{boostCount}</span>
                <div className="h-2 w-12 rounded-full bg-muted">
                  <div 
                    className="h-full rounded-full bg-pink-500" 
                    style={{ width: `${Math.min(100, (boostCount / 14) * 100)}%` }}
                  />
                </div>
              </div>
            </Link>
            <Link 
              href={`/dashboard/guild/${guildId}`}
              className="rounded-xl border border-border/70 bg-card/70 p-4 transition-colors hover:border-primary/50 hover:bg-card/90"
            >
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-primary">Modules Enabled</div>
              <div className="text-2xl font-bold">{enabledModules.length}</div>
            </Link>
          </section>

          {/* Quick Actions - Enabled Modules */}
          <section className="rounded-2xl border border-border/70 bg-card/70 p-6">
            <div className="mb-6 flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold">Quick Actions</h2>
                <p className="text-xs text-muted-foreground">Enabled modules and features</p>
              </div>
            </div>
            {enabledModules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No modules enabled yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {enabledModules.map((module) => (
                  <Link
                    key={module.name}
                    href={`/dashboard/guild/${guildId}/${module.meta.href}`}
                    className="group flex flex-col items-center rounded-xl border border-border/50 bg-background/50 p-4 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
                  >
                    <div className="mb-2 text-primary transition-transform group-hover:scale-110">
                      {module.meta.icon}
                    </div>
                    <div className="text-sm font-medium">{module.display_name || module.name}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{module.meta.description}</div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Growth Analytics */}
          <section className="rounded-2xl border border-border/70 bg-card/70 p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-red-500" />
                <div>
                  <h2 className="font-semibold">Growth Analytics</h2>
                  <p className="text-xs text-muted-foreground">Real-time server growth and member statistics</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-border/50 bg-background/50 p-1">
                  <button 
                    onClick={() => setTimeRange("1w")}
                    className={`rounded px-3 py-1 text-xs transition-colors ${timeRange === "1w" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    1W
                  </button>
                  <button 
                    onClick={() => setTimeRange("1m")}
                    className={`rounded px-3 py-1 text-xs transition-colors ${timeRange === "1m" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    1M
                  </button>
                  <button 
                    onClick={() => setTimeRange("all")}
                    className={`rounded px-3 py-1 text-xs transition-colors ${timeRange === "all" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    All Time
                  </button>
                </div>
                <button className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-1 text-xs text-red-500">Reset View</button>
              </div>
            </div>
            <div className="space-y-3">
              {filteredAnalytics.length === 0 && (
                <p className="text-sm text-muted-foreground">No analytics recorded yet for this guild.</p>
              )}
              {filteredAnalytics.slice(-10).reverse().map((item) => (
                <div key={item.date} className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(item.date)}</span>
                    <span>{item.member_count} members</span>
                  </div>
                  <div className="relative h-32 rounded-xl bg-gradient-to-r from-primary/20 via-primary/10 to-transparent">
                    <div className="absolute bottom-4 left-4">
                      <div className="text-2xl font-bold">{item.member_count}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(item.date)}</div>
                    </div>
                    <svg className="absolute bottom-0 left-0 right-0 h-20 w-full" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d={`M0,${80 - (item.member_count / maxMembers) * 60} Q${200},${80 - (item.member_count / maxMembers) * 40} ${400},80`}
                        fill="url(#chartGradient)"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Guild Distribution */}
          <section className="rounded-2xl border border-border/70 bg-card/70 p-6">
            <div className="mb-6 flex items-center gap-3">
              <Users className="h-5 w-5 text-red-500" />
              <div>
                <h2 className="font-semibold">Guild Distribution</h2>
                <p className="text-xs text-muted-foreground">Asset counts and member composition</p>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Donut Chart */}
              <div className="flex items-center justify-center">
                <div className="relative h-48 w-48">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    {/* Background circle */}
                    <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
                    {/* Humans segment */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="12"
                      strokeDasharray={`${((latest?.human_count || 0) / Math.max(1, totalMembers)) * 251} 251`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-3xl font-bold">{totalMembers}</div>
                    <div className="text-xs text-muted-foreground">Total Members</div>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/50 bg-background/50 p-4">
                  <div className="mb-1 text-xs text-muted-foreground">Roles</div>
                  <div className="text-2xl font-bold">{stats?.roles_count ?? "-"}</div>
                </div>
                <div className="rounded-xl border border-border/50 bg-background/50 p-4">
                  <div className="mb-1 text-xs text-muted-foreground">Channels</div>
                  <div className="text-2xl font-bold">{stats?.channels_count ?? "-"}</div>
                </div>
                <div className="rounded-xl border border-border/50 bg-background/50 p-4">
                  <div className="mb-1 text-xs font-medium uppercase tracking-wider text-orange-500">Humans</div>
                  <div className="text-lg font-bold">{latest?.human_count ?? "0"}</div>
                </div>
                <div className="rounded-xl border border-border/50 bg-background/50 p-4">
                  <div className="mb-1 text-xs font-medium uppercase tracking-wider text-blue-500">Bots</div>
                  <div className="text-lg font-bold">{latest?.bot_count ?? "0"}</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
