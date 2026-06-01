"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
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

const pageGroups = [
  { heading: "Explore", links: [{ href: "/features", label: "Features" }, { href: "/commands", label: "Commands" }, { href: "/changelogs", label: "Changelogs" }] },
  { heading: "Resources", links: [{ href: "/premium", label: "Premium" }, { href: "/docs", label: "Docs" }, { href: "/support", label: "Support" }] },
];

function HamburgerMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="theme-animate flex items-center justify-center p-2 text-foreground/86 hover:text-foreground"
        aria-label="Menu"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="theme-animate absolute right-0 mt-3 w-52 overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm z-50">
            {pageGroups.map((group) => (
              <div key={group.heading} className="mb-2 last:mb-0">
                <div className="px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{group.heading}</div>
                {group.links.map((page) => (
                  <Link
                    key={page.href}
                    href={page.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-2 py-1.5 text-sm text-foreground/82 transition-colors hover:bg-background/72 hover:text-foreground"
                  >
                    {page.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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
        className={`glass-nav mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-xl px-4 py-3 sm:px-5 ${isScrolled ? "is-scrolled" : ""}`}
      >
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1536" width="24" height="24" className="text-foreground" style={{display:'block'}}><path fill="currentColor" d="M 775.0 1238.5 L 680.0 1234.5 L 594.0 1222.5 L 503.0 1197.5 L 445.0 1172.5 L 380.0 1132.5 L 329.5 1086.0 L 308.5 1060.0 L 287.5 1027.0 L 264.5 976.0 L 247.5 910.0 L 243.5 880.0 L 242.5 824.0 L 250.5 739.0 L 266.5 647.0 L 304.5 512.0 L 352.5 392.0 L 390.5 326.0 L 401.0 313.5 L 418.0 300.5 L 427.0 297.5 L 448.0 300.5 L 472.0 314.5 L 502.0 339.5 L 546.5 388.0 L 618.0 483.5 L 626.0 484.5 L 701.0 471.5 L 752.0 470.5 L 825.0 471.5 L 916.0 483.5 L 977.5 401.0 L 1033.0 340.5 L 1083.0 302.5 L 1095.0 297.5 L 1116.0 300.5 L 1133.0 311.5 L 1153.0 338.5 L 1184.5 397.0 L 1233.5 522.0 L 1269.5 655.0 L 1285.5 748.0 L 1293.5 825.0 L 1292.5 881.0 L 1288.5 910.0 L 1270.5 980.0 L 1247.5 1029.0 L 1226.5 1062.0 L 1205.5 1088.0 L 1155.0 1134.5 L 1090.0 1174.5 L 1032.0 1199.5 L 941.0 1224.5 L 855.0 1236.5 L 776.0 1239.5 Z"/></svg>
          </div>
          <div className="truncate text-sm font-semibold tracking-[0.18em] text-foreground/68 uppercase">AOI</div>
        </Link>

        <div className="hidden items-center gap-6 text-sm lg:flex">
          {anchors.map((anchor) => (
            <Link key={anchor.href} href={anchor.href} className="nav-link">
              {anchor.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <HamburgerMenu />
          <AnimatedThemeToggle />
          <Link
            href={dashboardUrl}
            className="nav-dashboard-button inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold sm:px-4"
          >
            Dashboard
          </Link>
        </div>
      </nav>
    </header>
  );
}
