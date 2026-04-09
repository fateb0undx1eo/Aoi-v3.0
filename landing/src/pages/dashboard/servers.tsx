import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { ChevronRight, RefreshCcw, ShieldAlert } from "lucide-react";
import { BoneyardCard } from "@/components/ui/boneyard-skeleton";

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
  const [guilds, setGuilds] = useState<GuildItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const installed = useMemo(() => guilds.filter((guild) => guild.installed), [guilds]);
  const unavailable = useMemo(() => guilds.filter((guild) => !guild.installed), [guilds]);

  async function loadGuilds() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/discord/guilds");
      if (response.status === 401) {
        router.replace("/api/auth/discord");
        return;
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load guilds");
      }

      setGuilds(Array.isArray(payload.guilds) ? payload.guilds : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load guilds");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGuilds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="subtext text-xs uppercase tracking-[0.24em] text-muted-foreground">Dashboard</p>
            <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Choose your server</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-foreground/86 sm:text-base">
              After selecting a server, you will be redirected to the guild overview.
            </p>
          </div>
          <button
            type="button"
            onClick={loadGuilds}
            className="theme-animate inline-flex items-center gap-2 rounded-xl border border-border/75 bg-card/65 px-4 py-2 text-sm"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <BoneyardCard key={index} lines={3} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">{error}</div>
        )}

        {!loading && !error && (
          <div className="space-y-8">
            <section>
              <h2 className="card-heading mb-4 text-xl">Available Servers</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {installed.map((guild) => (
                  <Link
                    key={guild.id}
                    href={`/dashboard/guild/${guild.id}`}
                    className="theme-animate rounded-2xl border border-border/70 bg-card/70 p-4 shadow-[0_20px_46px_-32px_hsl(var(--foreground)/0.45)] hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {guildIconUrl(guild) ? (
                          <img src={guildIconUrl(guild) || ""} alt={guild.name} className="h-12 w-12 rounded-xl border border-border/70" />
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
                      <div className="rounded-lg border border-border/70 bg-background/55 px-2 py-1.5">
                        Members: {guild.member_count ?? "-"}
                      </div>
                      <div className="rounded-lg border border-border/70 bg-background/55 px-2 py-1.5">
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
                    <article key={guild.id} className="rounded-2xl border border-border/70 bg-card/55 p-4">
                      <div className="flex items-center gap-3">
                        {guildIconUrl(guild) ? (
                          <img src={guildIconUrl(guild) || ""} alt={guild.name} className="h-12 w-12 rounded-xl border border-border/70" />
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
