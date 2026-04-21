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

  const visuals: Record<string, { icon: typeof LayoutDashboard; accent: string }> = {
    community: { icon: Users, accent: "text-red-400" },
    fun: { icon: Gamepad2, accent: "text-pink-400" },
    moderation: { icon: Shield, accent: "text-orange-400" },
    settings: { icon: Settings2, accent: "text-cyan-400" },
    tools: { icon: Wrench, accent: "text-amber-400" },
  };

  return visuals[key] || { icon: LayoutDashboard, accent: "text-zinc-300" };
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

  const hasModules = moduleLinks.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="theme-animate sticky top-0 z-50 border-b border-border/65 bg-background/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[92rem] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex rounded-xl border border-border/75 bg-card/70 p-2 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="hidden rounded-xl border border-border/75 bg-card/70 p-2 lg:inline-flex"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Dashboard</div>
              <div className="text-sm font-semibold">{guildName}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="theme-animate inline-flex items-center gap-2 rounded-xl border border-border/75 bg-card/70 px-3 py-2 text-sm"
              aria-label="Toggle theme"
            >
              <span className="flex items-center">
                {mounted ? (
                  theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
                ) : (
                  <span className="h-4 w-4" />
                )}
              </span>
              <span className="hidden sm:inline">
                {mounted ? (theme === "dark" ? "Light" : "Dark") : ""}
              </span>
            </button>
            <Link
              href="/api/auth/logout"
              className="theme-animate inline-flex items-center gap-2 rounded-xl border border-border/75 bg-card/70 px-3 py-2 text-sm"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex w-full max-w-[92rem]">
        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close Menu"
          />
        )}

        <aside
          className={`fixed left-0 top-[57px] z-40 h-[calc(100vh-57px)] p-4 transition-transform duration-300 lg:sticky lg:top-[57px] ${
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          } ${sidebarCollapsed ? "w-24" : "w-[19.5rem]"}`}
        >
          <div className="flex h-full flex-col rounded-[28px] border border-border/65 bg-[linear-gradient(180deg,hsl(var(--card-solid)/0.96),hsl(var(--card)/0.82))] p-4 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.88)]">
            <div className={`rounded-2xl border border-border/60 bg-background/35 ${sidebarCollapsed ? "px-2 py-3" : "px-3.5 py-3.5"}`}>
              <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"}`}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-black/20 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Workspace</div>
                    <div className="truncate text-sm font-semibold text-zinc-50">{guildName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {hasModules ? `${moduleLinks.length} active modules` : "Loading modules"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex-1 space-y-5 overflow-y-auto pr-1">
              <div className="space-y-2">
                {!sidebarCollapsed && (
                  <div className="px-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Core</div>
                )}
                <Link
                  href={overviewHref}
                  title="Overview"
                  className={`theme-animate flex items-center rounded-2xl border px-3 py-3 text-sm ${
                    currentPath === overviewHref
                      ? "border-primary/45 bg-primary/12 text-zinc-50 shadow-[0_18px_40px_-28px_hsl(var(--primary)/0.75)]"
                      : "border-border/65 bg-background/20 text-foreground/82 hover:border-primary/30 hover:bg-background/35"
                  } ${sidebarCollapsed ? "justify-center" : "gap-3"}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${currentPath === overviewHref ? "bg-primary/16 text-primary" : "bg-black/15 text-zinc-300"}`}>
                    <LayoutDashboard className="h-4 w-4" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="min-w-0">
                      <div className="font-medium">Overview</div>
                      <div className="text-xs text-muted-foreground">Guild summary and analytics</div>
                    </div>
                  )}
                </Link>
              </div>

              <div className="space-y-2">
                {!sidebarCollapsed && (
                  <div className="flex items-center justify-between px-1">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Modules</div>
                    <div className="rounded-full border border-border/60 bg-background/30 px-2 py-0.5 text-[10px] text-muted-foreground">
                      {moduleLinks.length}
                    </div>
                  </div>
                )}

                <nav className="space-y-2">
                  {moduleLinks.map((item) => {
                    const active = currentPath === item.href;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        title={item.label}
                        className={`theme-animate flex items-center rounded-2xl border px-3 py-3 text-sm ${
                          active
                            ? "border-primary/45 bg-primary/10 text-zinc-50 shadow-[0_18px_40px_-28px_hsl(var(--primary)/0.75)]"
                            : "border-border/65 bg-background/20 text-foreground/82 hover:border-primary/30 hover:bg-background/35"
                        } ${sidebarCollapsed ? "justify-center" : "gap-3"}`}
                        onClick={() => setMobileOpen(false)}
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-primary/16 text-primary" : `bg-black/15 ${item.accent}`}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {!sidebarCollapsed && (
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium capitalize">{item.label}</div>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              Active
                            </div>
                          </div>
                        )}
                      </Link>
                    );
                  })}

                  {!hasModules && !sidebarCollapsed && (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-background/15 px-3 py-4 text-sm text-muted-foreground">
                      Modules will appear once this guild finishes loading.
                    </div>
                  )}
                </nav>
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t border-border/55 pt-4">
              <Link
                href="/dashboard"
                title="Change Server"
                className={`theme-animate flex items-center rounded-2xl border border-border/65 bg-background/20 px-3 py-3 text-sm text-foreground/82 hover:border-primary/30 hover:bg-background/35 ${
                  sidebarCollapsed ? "justify-center" : "gap-3"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/15 text-zinc-300">
                  <PanelLeftOpen className="h-4 w-4" />
                </div>
                {!sidebarCollapsed && (
                  <div>
                    <div className="font-medium">Change Server</div>
                    <div className="text-xs text-muted-foreground">Back to server picker</div>
                  </div>
                )}
              </Link>
            </div>
          </div>
        </aside>

        <main className="relative z-10 w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[78rem]">
            <div className="mb-5 rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,hsl(var(--card-solid)/0.86),hsl(var(--card)/0.72))] px-5 py-4 shadow-[0_24px_56px_-42px_rgba(0,0,0,0.9)]">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Current Section</div>
              <div className="mt-1 text-lg font-semibold text-zinc-50">{heading}</div>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
