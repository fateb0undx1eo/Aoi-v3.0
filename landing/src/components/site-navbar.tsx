"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";

type SiteNavbarProps = {
  showAnchors?: boolean;
};

const primaryAnchors = [
  { href: "/#modules", label: "Modules" },
  { href: "/#workflow", label: "Workflow" },
  { href: "/#dashboard-preview", label: "Preview" },
  { href: "/#reviews", label: "Reviews" },
];

const alternateAnchors = [
  { href: "/#modules", label: "Modules" },
  { href: "/#dashboard-preview", label: "Preview" },
];

const pageLinks = [
  { href: "/features", label: "Features Page" },
  { href: "/commands", label: "Commands Page" },
  { href: "/changelogs", label: "Changelogs Page" },
];

export function SiteNavbar({ showAnchors = true }: SiteNavbarProps) {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || "/dashboard";
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const anchors = showAnchors ? primaryAnchors : alternateAnchors;

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5">
      <nav
        className={`glass-nav mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-[1.6rem] px-4 py-3 sm:px-5 ${isScrolled ? "is-scrolled" : ""}`}
      >
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/65 bg-card/70 shadow-[0_16px_34px_-24px_hsl(var(--foreground)/0.35)] transition-transform duration-300 group-hover:scale-[1.04]">
            <BrandMark />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-[0.18em] text-foreground/68 uppercase">Discord Bot</div>
            <div className="truncate text-base font-semibold tracking-tight text-foreground">Multipurpose Platform</div>
          </div>
        </Link>

        <div className="hidden items-center gap-6 text-sm lg:flex">
          {anchors.map((anchor) => (
            <Link key={anchor.href} href={anchor.href} className="nav-link">
              {anchor.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <details className="group relative">
            <summary className="theme-animate flex cursor-pointer list-none items-center gap-2 rounded-2xl border border-border/75 bg-card/66 px-3 py-2 text-sm font-medium text-foreground/86 shadow-[0_16px_30px_-24px_hsl(var(--foreground)/0.34)] hover:border-primary/36">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Pages</span>
              <ChevronDown className="h-4 w-4 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div className="theme-animate absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-border/75 bg-card/92 p-2 shadow-[0_26px_56px_-30px_hsl(var(--foreground)/0.34)] backdrop-blur-2xl">
              {pageLinks.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className="block rounded-xl px-3 py-2.5 text-sm text-foreground/82 transition-colors hover:bg-background/72 hover:text-foreground"
                >
                  {page.label}
                </Link>
              ))}
            </div>
          </details>
          <AnimatedThemeToggle />
          <Link
            href={dashboardUrl}
            className="premium-button premium-button-secondary inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold sm:px-4"
          >
            Dashboard
          </Link>
        </div>
      </nav>
    </header>
  );
}
