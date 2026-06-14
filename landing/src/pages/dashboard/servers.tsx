import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/router";
import { ChevronRight, RefreshCcw, ShieldAlert } from "lucide-react";
import { BoneyardCard } from "@/components/ui/boneyard-skeleton";
import { useGuilds } from "@/lib/api";

type GuildItem = {
  id: string;
  name: string;
  icon: string | null;
  installed: boolean;
  member_count: number | null;
  boost_level: number | null;
};

function guildIconUrl(guild: GuildItem) {
  if (!guild.icon) return null;
  const iconExt = guild.icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${iconExt}?size=128`;
}

export default function DashboardServerPicker() {
  const router = useRouter();
  const { data, isLoading, error, refetch, isRefetching } = useGuilds();

  const guilds = data?.guilds ?? [];

  const installed = useMemo(() => guilds.filter((guild) => guild.installed), [guilds]);
  const unavailable = useMemo(() => guilds.filter((guild) => !guild.installed), [guilds]);

  return (
    <div className="dashboard-canvas min-h-screen px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="subtext text-xs uppercase tracking-[0.24em] text-muted-foreground">Dashboard</p>
            <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Choose your server</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-foreground/86 sm:text-base">
              Pick a guild to open its control surface. Installed servers jump straight into the dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="dashboard-chip theme-animate inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {!isLoading && !error && (
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <div className="dashboard-panel-soft rounded-[26px] p-5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Installed</div>
              <div className="mt-3 text-3xl font-bold">{installed.length}</div>
              <div className="mt-2 text-sm text-muted-foreground">Ready to open in the dashboard.</div>
            </div>
            <div className="dashboard-panel-soft rounded-[26px] p-5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Unavailable</div>
              <div className="mt-3 text-3xl font-bold">{unavailable.length}</div>
              <div className="mt-2 text-sm text-muted-foreground">Still need bot install or guild setup.</div>
            </div>
            <div className="dashboard-panel-soft rounded-[26px] p-5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Total Guilds</div>
              <div className="mt-3 text-3xl font-bold">{guilds.length}</div>
              <div className="mt-2 text-sm text-muted-foreground">Fetched from your Discord account.</div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <BoneyardCard key={index} lines={3} />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">{(error as Error).message}</div>
        )}

        {!isLoading && !error && (
          <div className="space-y-8">
            <section>
              <h2 className="card-heading mb-4 text-xl">Available Servers</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {installed.map((guild) => (
                  <Link
                    key={guild.id}
                    href={`/dashboard/guild/${guild.id}`}
                    className="dashboard-panel theme-animate rounded-[28px] p-5 hover:-translate-y-1.5 hover:border-primary/35"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {guildIconUrl(guild) ? (
                          <img src={guildIconUrl(guild) ?? ""} alt={guild.name} className="h-12 w-12 rounded-xl border border-border/70" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-lg font-semibold">
                            {guild.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold">{guild.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">ID: {guild.id}</div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-foreground/80">
                      <div className="dashboard-chip rounded-xl px-2 py-1.5">
                        Members: {guild.member_count ?? "-"}
                      </div>
                      <div className="dashboard-chip rounded-xl px-2 py-1.5">
                        Boosts: {guild.boost_level ?? "-"}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {unavailable.length > 0 && (
              <section>
                <h2 className="card-heading mb-4 text-xl">Not Installed Yet</h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {unavailable.map((guild) => (
                    <article key={guild.id} className="dashboard-panel-soft rounded-[28px] p-5">
                      <div className="flex items-center gap-3">
                        {guildIconUrl(guild) ? (
                          <img src={guildIconUrl(guild) ?? ""} alt={guild.name} className="h-12 w-12 rounded-xl border border-border/70" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-lg font-semibold">
                            {guild.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold">{guild.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">Bot not configured</div>
                        </div>
                      </div>
                      <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-yellow-500/35 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-300">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Install bot/configure guild first
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
