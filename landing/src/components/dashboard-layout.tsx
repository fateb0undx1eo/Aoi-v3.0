import Link from "next/link";
import { useRouter } from "next/router";
import {
  Atom,
  Gamepad2,
  LayoutDashboard,
  Medal,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Shield,
  Users,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";

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
    leveling: { icon: Medal, accent: "text-emerald-400", summary: "Rank cards, XP visuals, and progression styling." },
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const overviewHref = `/dashboard/guild/${guildId}`;
  const currentPath = useMemo(() => router.asPath.split("?")[0], [router.asPath]);

  useEffect(() => {
    setMobileOpen(false);
  }, [currentPath]);

  useEffect(() => {
    try {
      window.localStorage.setItem("dashboard_sidebar_collapsed", sidebarCollapsed ? "1" : "0");
    } catch {
      // Ignore storage access failures and keep the UI responsive.
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

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
              onClick={() => setMobileOpen((value) => !value)}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-2 text-foreground/86 hover:border-primary/45 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <Link href={`/dashboard/guild/${guildId}`} className="group flex min-w-0 items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1536" width="24" height="24" className="text-foreground" style={{display:'block'}}><path fill="currentColor" d="M 775.0 1238.5 L 680.0 1234.5 L 594.0 1222.5 L 503.0 1197.5 L 445.0 1172.5 L 380.0 1132.5 L 329.5 1086.0 L 308.5 1060.0 L 287.5 1027.0 L 264.5 976.0 L 247.5 910.0 L 243.5 880.0 L 242.5 824.0 L 250.5 739.0 L 266.5 647.0 L 304.5 512.0 L 352.5 392.0 L 390.5 326.0 L 401.0 313.5 L 418.0 300.5 L 427.0 297.5 L 448.0 300.5 L 472.0 314.5 L 502.0 339.5 L 546.5 388.0 L 618.0 483.5 L 626.0 484.5 L 701.0 471.5 L 752.0 470.5 L 825.0 471.5 L 916.0 483.5 L 977.5 401.0 L 1033.0 340.5 L 1083.0 302.5 L 1095.0 297.5 L 1116.0 300.5 L 1133.0 311.5 L 1153.0 338.5 L 1184.5 397.0 L 1233.5 522.0 L 1269.5 655.0 L 1285.5 748.0 L 1293.5 825.0 L 1292.5 881.0 L 1288.5 910.0 L 1270.5 980.0 L 1247.5 1029.0 L 1226.5 1062.0 L 1205.5 1088.0 L 1155.0 1134.5 L 1090.0 1174.5 L 1032.0 1199.5 L 941.0 1224.5 L 855.0 1236.5 L 776.0 1239.5 Z"/></svg>
              </div>
              <div className="truncate text-sm font-semibold tracking-[0.18em] text-foreground/68 uppercase">AOI</div>
            </Link>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <div className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground/88">
              <span className="text-muted-foreground">Guild:</span>{" "}
              <span className="font-medium text-foreground">{guildName}</span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((value) => !value)}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-2 text-foreground/86 hover:border-primary/45"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
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
          </div>
        </nav>
      </header>

      <div className="relative mx-auto flex max-w-[96rem] gap-6 px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close Menu"
          />
        )}

        <aside
          className={`fixed left-4 top-[5.25rem] z-40 h-[calc(100vh-6.5rem)] transition-transform duration-300 lg:sticky lg:left-auto lg:top-[5.9rem] lg:h-[calc(100vh-7.4rem)] ${
            mobileOpen ? "translate-x-0" : "-translate-x-[120%] lg:translate-x-0"
          } ${sidebarCollapsed ? "w-24" : "w-[20rem]"}`}
        >
          <div className="dashboard-panel dashboard-panel-lift flex h-full flex-col gap-4 rounded-[30px] p-4">
            <div className={`dashboard-panel-soft rounded-[24px] ${sidebarCollapsed ? "px-2.5 py-3" : "px-4 py-4"}`}>
              <div className={`flex ${sidebarCollapsed ? "justify-center" : "items-start gap-3"}`}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <span className="text-lg font-semibold">{guildName.slice(0, 1).toUpperCase()}</span>
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Guild Workspace</div>
                    <div className="mt-1 truncate text-base font-semibold text-foreground">{guildName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {hasModules ? `${moduleLinks.length} live modules available` : "Loading modules"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto pr-1">
              <div className="space-y-2">
                {!sidebarCollapsed && (
                  <div className="px-1 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Command Center</div>
                )}

                <Link
                  href={overviewHref}
                  title="Overview"
                  className={`theme-animate flex items-center rounded-[22px] border px-3 py-3 ${
                    currentPath === overviewHref
                      ? "border-primary/38 bg-primary/10"
                      : "border-border bg-transparent hover:border-primary/24 hover:bg-primary/6"
                  } ${sidebarCollapsed ? "justify-center" : "gap-3"}`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${currentPath === overviewHref ? "bg-primary/14 text-primary" : "bg-black/10 text-foreground/78"}`}>
                    <LayoutDashboard className="h-4 w-4" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">Overview</div>
                      <div className="text-xs text-muted-foreground">Guild summary and quick access</div>
                    </div>
                  )}
                </Link>
              </div>

              <div className="space-y-2">
                {!sidebarCollapsed && (
                  <div className="flex items-center justify-between px-1">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Modules</div>
                    <div className="dashboard-chip rounded-full px-2 py-0.5 text-[10px] text-muted-foreground">
                      {moduleLinks.length}
                    </div>
                  </div>
                )}

                <nav className="space-y-2">
                  {moduleLinks.map((item) => {
                    const active = item.href === currentPath;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        title={item.label}
                        className={`theme-animate flex items-center rounded-[22px] border px-3 py-3 ${
                          active
                              ? "border-primary/38 bg-primary/10"
                              : "border-border bg-transparent hover:border-primary/24 hover:bg-primary/6"
                        } ${sidebarCollapsed ? "justify-center" : "gap-3"}`}
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${active ? "bg-primary/14 text-primary" : `bg-black/10 ${item.accent}`}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {!sidebarCollapsed && (
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium capitalize text-foreground">{item.label}</div>
                            <div className="text-xs text-muted-foreground">{item.summary}</div>
                          </div>
                        )}
                      </Link>
                    );
                  })}

                  {!hasModules && !sidebarCollapsed && (
                    <div className="rounded-[22px] border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                      Modules are still being prepared for this guild.
                    </div>
                  )}
                </nav>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <Link
                href="/dashboard"
                title="Change Server"
                className={`theme-animate flex items-center rounded-[22px] border border-border px-3 py-3 hover:border-primary/24 hover:bg-primary/6 ${
                  sidebarCollapsed ? "justify-center" : "gap-3"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black/10 text-foreground/78">
                  <PanelLeftOpen className="h-4 w-4" />
                </div>
                {!sidebarCollapsed && (
                  <div>
                    <div className="font-medium text-foreground">Change Server</div>
                    <div className="text-xs text-muted-foreground">Return to the server picker</div>
                  </div>
                )}
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="dashboard-panel dashboard-panel-lift mb-6 rounded-[30px] px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Current Section</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{heading}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {activeModule?.summary || "Operate your selected guild from one premium control surface."}
                </div>
              </div>
              <div className="dashboard-chip rounded-full px-4 py-2 text-sm">
                <span className="text-muted-foreground">Guild:</span>{" "}
                <span className="font-medium text-foreground">{guildName}</span>
              </div>
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
