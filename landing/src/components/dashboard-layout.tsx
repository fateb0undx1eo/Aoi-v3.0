import Link from "next/link";
import { useRouter } from "next/router";
import {
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Shield,
  Sun,
  Users,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const overviewHref = `/dashboard/guild/${guildId}`;
  const currentPath = useMemo(() => router.asPath.split("?")[0], [router.asPath]);

  useEffect(() => {
    setMobileOpen(false);
  }, [currentPath]);

  const moduleLinks = useMemo(
    () =>
      modules
        .filter((item) => item.enabled !== false)
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
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-8%] top-[8%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,hsl(var(--dashboard-accent)/0.14),transparent_68%)] blur-3xl" />
        <div className="absolute right-[-10%] top-[12%] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,hsl(var(--dashboard-accent)/0.09),transparent_72%)] blur-3xl" />
      </div>

      <header className="theme-animate sticky top-0 z-50 border-b border-[hsl(var(--dashboard-stroke)/0.74)] bg-[hsl(var(--dashboard-panel)/0.72)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="dashboard-chip inline-flex rounded-2xl p-2 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((value) => !value)}
              className="dashboard-chip hidden rounded-2xl p-2 lg:inline-flex"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>

            <div className="dashboard-chip flex items-center gap-3 rounded-[24px] px-3.5 py-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Discord Bot</div>
                <div className="text-sm font-semibold text-foreground">Premium Dashboard</div>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <div className="dashboard-chip rounded-full px-4 py-2 text-sm text-foreground/88">
              <span className="text-muted-foreground">Guild:</span>{" "}
              <span className="font-medium text-foreground">{guildName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="dashboard-chip theme-animate inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm"
              aria-label="Toggle theme"
            >
              {mounted ? (
                theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
              ) : (
                <span className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{mounted ? (theme === "dark" ? "Light" : "Dark") : ""}</span>
            </button>
            <Link
              href="/api/auth/logout"
              className="dashboard-chip theme-animate inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Link>
          </div>
        </div>
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
          <div className="dashboard-panel flex h-full flex-col gap-4 rounded-[30px] p-4">
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
                      ? "border-primary/38 bg-primary/10 shadow-[0_24px_48px_-34px_hsl(var(--primary)/0.8)]"
                      : "border-[hsl(var(--dashboard-stroke)/0.7)] bg-transparent hover:border-primary/24 hover:bg-primary/6"
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
                            ? "border-primary/38 bg-primary/10 shadow-[0_24px_48px_-34px_hsl(var(--primary)/0.8)]"
                            : "border-[hsl(var(--dashboard-stroke)/0.7)] bg-transparent hover:border-primary/24 hover:bg-primary/6"
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
                    <div className="rounded-[22px] border border-dashed border-[hsl(var(--dashboard-stroke)/0.7)] px-3 py-4 text-sm text-muted-foreground">
                      Modules are still being prepared for this guild.
                    </div>
                  )}
                </nav>
              </div>
            </div>

            <div className="border-t border-[hsl(var(--dashboard-stroke)/0.7)] pt-4">
              <Link
                href="/dashboard"
                title="Change Server"
                className={`theme-animate flex items-center rounded-[22px] border border-[hsl(var(--dashboard-stroke)/0.7)] px-3 py-3 hover:border-primary/24 hover:bg-primary/6 ${
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
          <div className="dashboard-panel mb-6 rounded-[30px] px-5 py-5">
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
