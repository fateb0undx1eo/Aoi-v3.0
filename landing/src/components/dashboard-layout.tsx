import Link from "next/link";
import { useRouter } from "next/router";
import {
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftOpen,
  Settings2,
  Shield,
  Terminal,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";
import { useDashboardStore } from "@/lib/dashboard-store";

type ModuleItem = {
  name: string;
  display_name?: string;
  enabled?: boolean;
};

type DashboardLayoutProps = {
  children: ReactNode;
  guildId: string;
  guildName?: string;
  heading?: string;
  modules?: ModuleItem[];
};

function slugify(name = "") {
  return String(name).trim().toLowerCase().replace(/\s+/g, "-");
}

function getModuleVisual(name = "") {
  const key = slugify(name);

  const visuals: Record<string, { icon: typeof LayoutDashboard; accent: string; summary: string }> = {
    community: { icon: Users, accent: "text-rose-400", summary: "Engagement, onboarding, and daily community systems." },
    fun: { icon: Gamepad2, accent: "text-fuchsia-400", summary: "Drops, playful interactions, and claim-based features." },
    moderation: { icon: Shield, accent: "text-orange-400", summary: "Cases, punishments, and moderation controls." },
    settings: { icon: Settings2, accent: "text-cyan-400", summary: "Guild-wide configuration and core preferences." },
    tools: { icon: Wrench, accent: "text-amber-400", summary: "Utility actions, broadcasts, and operator shortcuts." },
  };

  return visuals[key] || { icon: LayoutDashboard, accent: "text-zinc-300", summary: "Manage this module." };
}

export function DashboardLayout({
  children,
  guildId,
  guildName = "Guild",
  heading = "Overview",
  modules = [],
}: DashboardLayoutProps) {
  const router = useRouter();
  const sidebarOpen = useDashboardStore((state) => state.sidebarOpen);
  const setSidebarOpen = useDashboardStore((state) => state.setSidebarOpen);
  const [closing, setClosing] = useState(false);
  const ANIMATION_DURATION = 250;

  function closeMobile() {
    if (!sidebarOpen) return;
    setClosing(true);
    setTimeout(() => {
      setSidebarOpen(false);
      setClosing(false);
    }, ANIMATION_DURATION);
  }

  function toggleMobile() {
    if (closing) {
      setClosing(false);
      setSidebarOpen(true);
    } else if (sidebarOpen) {
      closeMobile();
    } else {
      setSidebarOpen(true);
    }
  }

  const overviewHref = `/dashboard/guild/${guildId}`;
  const currentPath = useMemo(() => router.asPath.split("?")[0], [router.asPath]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPath]);

  useEffect(() => {
    if (!sidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobile();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

  const moduleLinks = useMemo(
    () =>
      modules
        .filter((item) => item.enabled !== false)
        .filter((item) => slugify(item.name) !== "tickets")
        .map((item) => ({
          key: slugify(item.name),
          label: item.display_name || item.name,
          href: `/dashboard/guild/${guildId}/${slugify(item.name)}`,
          ...getModuleVisual(item.name),
        })),
    [guildId, modules]
  );

  const activeModule = useMemo(
    () => moduleLinks.find((item) => item.href === currentPath),
    [currentPath, moduleLinks]
  );

  const hasModules = moduleLinks.length > 0;

  return (
    <div className="dashboard-canvas min-h-screen text-foreground">
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5">
        <nav className="glass-nav mx-auto flex max-w-[96rem] items-center justify-between gap-3 rounded-xl px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMobile}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-2 text-foreground/86 hover:border-primary/45 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <Link href="/" className="group flex min-w-0 items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1536" width="24" height="24" className="text-foreground" style={{display:'block'}}><path fill="currentColor" d="M 775.0 1238.5 L 680.0 1234.5 L 594.0 1222.5 L 503.0 1197.5 L 445.0 1172.5 L 380.0 1132.5 L 329.5 1086.0 L 308.5 1060.0 L 287.5 1027.0 L 264.5 976.0 L 247.5 910.0 L 243.5 880.0 L 242.5 824.0 L 250.5 739.0 L 266.5 647.0 L 304.5 512.0 L 352.5 392.0 L 390.5 326.0 L 401.0 313.5 L 418.0 300.5 L 427.0 297.5 L 448.0 300.5 L 472.0 314.5 L 502.0 339.5 L 546.5 388.0 L 618.0 483.5 L 626.0 484.5 L 701.0 471.5 L 752.0 470.5 L 825.0 471.5 L 916.0 483.5 L 977.5 401.0 L 1033.0 340.5 L 1083.0 302.5 L 1095.0 297.5 L 1116.0 300.5 L 1133.0 311.5 L 1153.0 338.5 L 1184.5 397.0 L 1233.5 522.0 L 1269.5 655.0 L 1285.5 748.0 L 1293.5 825.0 L 1292.5 881.0 L 1288.5 910.0 L 1270.5 980.0 L 1247.5 1029.0 L 1226.5 1062.0 L 1205.5 1088.0 L 1155.0 1134.5 L 1090.0 1174.5 L 1032.0 1199.5 L 941.0 1224.5 L 855.0 1236.5 L 776.0 1239.5 Z"/></svg>
              </div>
              <div className="truncate text-sm font-semibold tracking-[0.18em] text-foreground/68 uppercase">AOI</div>
            </Link>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              onClick={toggleMobile}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-2 text-foreground/86 hover:border-primary/45"
              title="Modules"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <AnimatedThemeToggle />
            <Link
              href="/api/auth/logout"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground/86 hover:border-primary/45"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Link>
            <div className="hidden sm:flex items-center gap-2 border-l border-border pl-3 ml-1 text-sm text-foreground/88">
              <span className="text-muted-foreground">Guild:</span>
              <span className="font-medium text-foreground">{guildName}</span>
            </div>
          </div>
        </nav>
      </header>

      <div className="relative mx-auto flex max-w-[96rem] gap-6 px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        {(sidebarOpen || closing) && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-30 bg-black/60"
              onClick={closeMobile}
              aria-label="Close Menu"
            />
            <aside className={`fixed left-0 top-0 z-40 h-full w-64 border-r border-border bg-card p-5 shadow-xl ${closing ? "animate-slide-out-left" : "animate-slide-in-left"}`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                    {guildName.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{guildName}</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Guild Workspace</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeMobile}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="space-y-1">
                <Link
                  href={overviewHref}
                  onClick={closeMobile}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    currentPath === overviewHref
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground/82 hover:bg-background/72 hover:text-foreground"
                  }`}
                >
                  Overview
                </Link>

                <Link
                  href={`/dashboard/guild/${guildId}/logs`}
                  onClick={closeMobile}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    currentPath === `/dashboard/guild/${guildId}/logs`
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground/82 hover:bg-background/72 hover:text-foreground"
                  }`}
                >
                  <Terminal className="h-4 w-4" />
                  Logs
                </Link>

                {hasModules && (
                  <div className="pt-3">
                    <div className="px-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Modules</div>
                    {moduleLinks.map((item) => (
                      <Link
                        key={item.key}
                        href={item.href}
                        onClick={closeMobile}
                        className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                          item.href === currentPath
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-foreground/82 hover:bg-background/72 hover:text-foreground"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}

                {!hasModules && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Modules are still being prepared for this guild.
                  </div>
                )}
              </nav>

              <div className="absolute bottom-5 left-5 right-5 border-t border-border pt-4">
                <Link
                  href="/dashboard"
                  onClick={closeMobile}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/82 transition-colors hover:bg-background/72 hover:text-foreground"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                  Change Server
                </Link>
              </div>
            </aside>
          </>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground">{heading}</h1>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
