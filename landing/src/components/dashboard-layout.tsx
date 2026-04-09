import Link from "next/link";
import { useRouter } from "next/router";
import { LayoutDashboard, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";
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

  const moduleLinks = useMemo(
    () =>
      modules
        .filter((item) => item.enabled !== false)
        .map((item) => ({
          key: slugify(item.name),
          label: item.display_name || item.name,
          href: `/dashboard/guild/${guildId}/${slugify(item.name)}`,
        })),
    [guildId, modules]
  );

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
        {/* Mobile overlay - closes sidebar when clicked */}
        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close Menu"
          />
        )}

        {/* Sidebar - overlays on mobile, pushes on desktop */}
        <aside
          className={`fixed left-0 top-[57px] z-40 h-[calc(100vh-57px)] border-r border-border/70 bg-background/95 p-4 backdrop-blur-xl transition-transform duration-300 lg:sticky lg:top-[57px] ${
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          } ${sidebarCollapsed ? "w-20" : "w-72"}`}
        >
          <div className="space-y-3">
            <Link
              href={overviewHref}
              className={`theme-animate flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                router.asPath === overviewHref
                  ? "border-primary/45 bg-primary/10"
                  : "border-border/70 bg-card/55 text-foreground/85"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>Overview</span>}
            </Link>

            {!sidebarCollapsed && (
              <div>
                <div className="mb-2 px-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Modules</div>
                <nav className="space-y-2">
                  {moduleLinks.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`theme-animate flex rounded-xl border px-3 py-2 text-sm ${
                        router.asPath === item.href
                          ? "border-primary/45 bg-primary/10"
                          : "border-border/70 bg-card/55 text-foreground/85"
                      }`}
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            )}

            {!sidebarCollapsed && (
              <Link
                href="/dashboard"
                className="theme-animate block rounded-xl border border-border/70 bg-card/55 px-3 py-2 text-sm text-foreground/85"
                onClick={() => setMobileOpen(false)}
              >
                Change Server
              </Link>
            )}
          </div>
        </aside>

        {/* Main content - full width on mobile, adjusted for sidebar on desktop */}
        <main className="relative z-10 w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-5 rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Current Section</div>
              <div className="mt-1 text-lg font-semibold">{heading}</div>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
