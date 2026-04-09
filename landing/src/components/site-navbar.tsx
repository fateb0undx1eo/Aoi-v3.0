import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";

type SiteNavbarProps = {
  showAnchors?: boolean;
};

export function SiteNavbar({ showAnchors = true }: SiteNavbarProps) {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || "/dashboard";

  return (
    <header className="theme-animate sticky top-0 z-50 border-b border-border/65 bg-background/82 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="leading-none">
            <div className="text-sm font-bold tracking-tight">Discord Bot</div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Multipurpose</div>
          </div>
        </Link>

        <div className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
          {showAnchors ? (
            <>
              <Link href="/#modules" className="hover:text-foreground">
                Modules
              </Link>
              <Link href="/#features" className="hover:text-foreground">
                Features
              </Link>
              <Link href="/#reviews" className="hover:text-foreground">
                Reviews
              </Link>
            </>
          ) : (
            <>
              <Link href="/#modules" className="hover:text-foreground">
                Modules
              </Link>
              <Link href="/#showcase" className="hover:text-foreground">
                Showcase
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <details className="group relative">
            <summary className="theme-animate flex cursor-pointer list-none items-center gap-1 rounded-xl border border-border/80 bg-card px-3 py-2 text-sm font-medium hover:border-primary/45">
              Pages
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="theme-animate absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card p-2 shadow-xl backdrop-blur">
              <Link href="/features" className="block rounded-lg px-3 py-2 text-sm hover:bg-background/80">
                Features Page
              </Link>
              <Link href="/commands" className="block rounded-lg px-3 py-2 text-sm hover:bg-background/80">
                Commands Page
              </Link>
              <Link href="/changelogs" className="block rounded-lg px-3 py-2 text-sm hover:bg-background/80">
                Changelogs Page
              </Link>
            </div>
          </details>
          <AnimatedThemeToggle />
          <Link
            href={dashboardUrl}
            className="theme-animate inline-flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-sm font-semibold text-foreground ring-1 ring-border hover:border-primary/45 sm:px-4"
          >
            Dashboard
          </Link>
        </div>
      </nav>
    </header>
  );
}
