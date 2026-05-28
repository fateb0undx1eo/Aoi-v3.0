import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  BellRing,
  Bot,
  ChevronRight,
  Crown,
  Gauge,
  Layers3,
  MessageSquareMore,
  Quote,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { SiteNavbar } from "@/components/site-navbar";

const heroStats = [
  { label: "Response stack", value: "24/7" },
  { label: "Modules online", value: "18+" },
  { label: "Command sync", value: "<120ms" },
];

const moduleCards = [
  {
    icon: ShieldCheck,
    title: "Moderation Core",
    description: "Anti-raid rules, warnings, timed actions, and clean escalation paths in one dependable surface.",
  },
  {
    icon: Sparkles,
    title: "Utility Layer",
    description: "Autoresponders, reminders, sticky prompts, and daily-use commands without bloated setup.",
  },
  {
    icon: Wand2,
    title: "Workflow Automation",
    description: "Connect routine staff actions into streamlined flows that stay readable as your server grows.",
  },
  {
    icon: MessageSquareMore,
    title: "Message Systems",
    description: "Announcements, DM tools, waifu drops, custom containers, and other polished member-facing flows.",
  },
  {
    icon: TerminalSquare,
    title: "Command Hub",
    description: "Permission-aware slash commands grouped into focused modules instead of scattered utilities.",
  },
  {
    icon: Crown,
    title: "Growth Control",
    description: "One premium dashboard that scales from daily moderation to larger community operations.",
  },
];

const workflowSteps = [
  {
    tag: "/warn",
    title: "Staff actions stay structured",
    description: "Every moderation action starts from clear command surfaces with context-first flow.",
  },
  {
    tag: "case",
    title: "Message reports become real cases",
    description: "Staff can turn a reported message into a clean warn, timeout, or kick flow from Discord.",
  },
  {
    tag: "/channel all",
    title: "Operations stay coordinated",
    description: "Broadcast fast when you need the whole server aligned, with delete timing controlled from the dashboard.",
  },
  {
    tag: "/waifu",
    title: "Community features stay fun",
    description: "Member-facing drops and utility commands live beside serious operations instead of in a separate stack.",
  },
];

const showcaseCards = [
  { icon: Bot, title: "Unified command routing", summary: "One stack across moderation, fun, tools, and community." },
  { icon: Gauge, title: "Live server control", summary: "Premium dashboard editing with clean state and real module boundaries." },
  { icon: Layers3, title: "Design consistency", summary: "Commands, dashboard, and announcement surfaces all feel like one platform." },
];

const chartBars = [34, 52, 48, 64, 58, 44, 72, 82, 76, 88, 62, 70];
const workflowGraphBars = [52, 64, 58, 84, 76, 68];

const dashboardSignals = [
  { label: "Automod policy", state: "Active", accent: "text-emerald-400" },
  { label: "Community queue", state: "Stable", accent: "text-foreground/76" },
  { label: "Broadcast checks", state: "Ready", accent: "text-primary" },
];

const featureShowcase = [
  {
    icon: ShieldCheck,
    title: "Enterprise-grade moderation",
    description: "Anti-raid systems, automated filters, and escalation paths that protect communities around the clock.",
    stat: "99.9%",
    statLabel: "Uptime",
  },
  {
    icon: Zap,
    title: "Lightning-fast automation",
    description: "Workflow triggers, auto-roles, and scheduled commands that stay responsive without losing clarity.",
    stat: "<120ms",
    statLabel: "Response",
  },
  {
    icon: Users,
    title: "Community engagement",
    description: "Announcements, waifu drops, member tools, and premium server features that keep activity healthy.",
    stat: "18+",
    statLabel: "Modules",
  },
];

const trustedReviews = [
  { name: "karma", role: "owner", quote: "We replaced a pile of separate bots and the server immediately felt more controlled." },
  { name: "chineseguy", role: "admin", quote: "Staff onboarding got easier because commands and dashboard settings finally speak the same language." },
  { name: "inferno", role: "mod lead", quote: "The premium UI helps because it reflects actual structure, not just decoration over messy logic." },
  { name: "rei fanta", role: "community manager", quote: "Announcements, moderation, and community tools no longer feel stitched from different products." },
  { name: "akira", role: "operations", quote: "Feature boundaries are clean. We enabled only what we needed and it all still feels connected." },
  { name: "pixxie", role: "server owner", quote: "It looks premium, but more importantly it keeps the staff calm when the server gets busy." },
];

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

function Reveal({
  children,
  className,
  delay = 0,
  amount = 0.22,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  amount?: number;
}) {
  const reducedMotion = useReducedMotionPreference();

  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 18 }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function MagneticButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={`premium-button premium-button-${variant} inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold`}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}

function InteractiveSurface({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reducedMotion = useReducedMotionPreference();
  const cardRef = useRef<HTMLElement>(null);

  const resetTilt = () => {
    if (!cardRef.current) {
      return;
    }

    cardRef.current.style.setProperty("--pointer-x", "50%");
    cardRef.current.style.setProperty("--pointer-y", "50%");
    cardRef.current.style.setProperty("--rotate-x", "0deg");
    cardRef.current.style.setProperty("--rotate-y", "0deg");
  };

  const handleMove = (event: ReactMouseEvent<HTMLElement>) => {
    if (reducedMotion || !cardRef.current) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;

    cardRef.current.style.setProperty("--pointer-x", `${px * 100}%`);
    cardRef.current.style.setProperty("--pointer-y", `${py * 100}%`);
    cardRef.current.style.setProperty("--rotate-x", "0deg");
    cardRef.current.style.setProperty("--rotate-y", "0deg");
  };

  useEffect(() => {
    resetTilt();
  }, []);

  return (
    <Reveal delay={delay}>
      <article
        ref={cardRef}
        onMouseMove={handleMove}
        onMouseLeave={resetTilt}
        className={`lux-surface interactive-card ${className}`}
      >
        {children}
      </article>
    </Reveal>
  );
}

function SectionDivider() {
  return (
    <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="section-divider" />
    </div>
  );
}

function DashboardMock({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const reducedMotion = useReducedMotionPreference();

  return (
    <motion.div
      className={`dashboard-mock rounded-xl p-4 sm:p-5 ${className}`}
      initial={reducedMotion ? false : { opacity: 0, y: 22, scale: 0.985 }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.24 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="dashboard-scanline" />
      <div className={`relative z-10 grid gap-4 ${compact ? "lg:grid-cols-[4.5rem_1fr]" : "lg:grid-cols-[5.25rem_1fr]"}`}>
        <div className="hidden rounded-xl border border-border bg-background p-3 lg:block">
          <div className="flex h-full flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-primary">
                <BrandMark quiet />
              </div>
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-11 rounded-lg border border-border bg-card"
                  style={{ opacity: index === 1 ? 1 : 0.72 }}
                />
              ))}
            </div>
            <div className="rounded-lg border border-border bg-card p-3 text-center text-[10px] uppercase tracking-[0.24em] text-primary">
              Live
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Control Center</div>
              <div className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Realtime dashboard operations
              </div>
            </div>
            <div className="flex items-center gap-2">
              {["Stable", "Alerts", "Ready"].map((label, index) => (
                <div
                  key={label}
                  className="dashboard-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-foreground/78"
                >
                  <span
                    className="pulse-dot inline-flex h-2 w-2 rounded-full bg-primary"
                    style={{ animationDelay: `${index * 0.2}s` }}
                  />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">Server Pulse</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">98.7%</div>
                </div>
                <div className="rounded-full border border-emerald-500/25 bg-emerald-500/12 px-3 py-1 text-xs font-medium text-emerald-400">
                  +12%
                </div>
              </div>

              <div className="mt-6 h-40">
                <div className="flex h-full items-end gap-2">
                  {chartBars.map((height, index) => (
                    <motion.div
                      key={index}
                      className="dashboard-bar flex-1 rounded-full"
                      style={{
                        height: `${height}%`,
                        background: "hsl(var(--primary))",
                        animationDelay: `${index * 0.08}s`,
                      }}
                      initial={reducedMotion ? false : { scaleY: 0.1, opacity: 0.35 }}
                      whileInView={reducedMotion ? undefined : { scaleY: 1, opacity: 1 }}
                      viewport={{ once: true, amount: 0.42 }}
                      transition={{ duration: 0.55, delay: index * 0.035, ease: [0.16, 1, 0.3, 1] }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">Modules</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  {dashboardSignals.map((signal) => (
                    <div key={signal.label} className="rounded-lg border border-border bg-card p-3">
                      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{signal.label}</div>
                      <div className={`mt-2 text-sm font-semibold ${signal.accent}`}>{signal.state}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">Activity Feed</div>
                  <BellRing className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-3 space-y-3">
                  {["Announcement queued", "Moderation log synced", "Waifu drop config updated"].map((item, index) => (
                    <div key={item} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                      <span
                        className="pulse-dot inline-flex h-2.5 w-2.5 rounded-full bg-primary"
                        style={{ animationDelay: `${index * 0.22}s` }}
                      />
                      <span className="text-sm text-foreground/84">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ReviewCard({
  review,
}: {
  review: (typeof trustedReviews)[number];
}) {
  return (
    <div className="review-card lux-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            {review.name.slice(0, 2)}
          </div>
          <div>
            <div className="card-heading text-base capitalize">{review.name}</div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{review.role}</div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background p-2 text-primary">
          <Quote className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-5 text-sm leading-7 text-foreground/88 sm:text-[0.95rem]">&quot;{review.quote}&quot;</p>
    </div>
  );
}

function AoiCatMascot({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 170"
      role="img"
      aria-label="AOI cat mascot"
      className={`cat-mascot ${className}`}
    >
      <path
        className="cat-tail"
        d="M160 107c29-4 35-29 21-42-9-8-22-6-26 5-3 8 1 17 10 18 7 1 12-3 13-9"
      />
      <path
        className="cat-body"
        d="M57 134c-9-19-6-45 8-61 12-14 32-20 51-16 23 5 38 21 43 44 3 14 1 26-7 36-12 14-35 19-58 17-18-1-31-7-37-20Z"
      />
      <path className="cat-ear" d="M69 75 73 34l31 27Z" />
      <path className="cat-ear" d="M130 60 163 34l-2 43Z" />
      <path className="cat-face" d="M72 82c14-12 51-17 73 0 11 9 13 28 5 42-10 17-29 22-49 21-22-1-38-9-43-25-4-13 2-29 14-38Z" />
      <ellipse className="cat-eye" cx="91" cy="102" rx="11" ry="13" />
      <ellipse className="cat-eye" cx="128" cy="102" rx="11" ry="13" />
      <ellipse className="cat-pupil" cx="94" cy="103" rx="4" ry="8" />
      <ellipse className="cat-pupil" cx="125" cy="103" rx="4" ry="8" />
      <path className="cat-nose" d="M108 116h11l-6 6Z" />
      <path className="cat-mouth" d="M113 122c-4 6-10 7-15 3m15-3c4 6 10 7 15 3" />
      <path className="cat-whisker" d="M82 119 50 111m32 17-35 2m90-11 32-8m-32 17 35 2" />
      <path className="cat-collar" d="M73 137c24 13 56 13 78-1" />
      <circle className="cat-tag" cx="113" cy="144" r="7" />
    </svg>
  );
}

export default function LandingPage() {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || "/dashboard";
  const reducedMotion = useReducedMotionPreference();
  const leftReviews = trustedReviews.slice(0, Math.ceil(trustedReviews.length / 2));
  const rightReviews = trustedReviews.slice(Math.ceil(trustedReviews.length / 2));

  return (
    <div className="theme-surface min-h-screen overflow-x-clip bg-background text-foreground">
      <SiteNavbar />

      <main id="top" className="relative z-10">
        <section className="public-section aoi-grid-shell relative isolate overflow-hidden px-4 pb-14 pt-8 text-foreground sm:px-6 lg:px-8">
          <div className="relative mx-auto grid min-h-[calc(100svh-9rem)] max-w-7xl items-center gap-8 px-1 pb-10 pt-6 sm:px-0 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:pt-8">
            <Reveal className="relative">
              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Better-for-your-server Discord bot
              </div>
              <h1 className="mt-5 max-w-2xl text-4xl leading-[1.02] tracking-normal sm:text-5xl lg:text-[3.9rem] xl:text-[4.45rem]">
                Fuel your Discord
                <span className="block text-primary">community</span>
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-foreground/82 sm:text-base">
                Clean moderation, fast automations, slash commands, and server tools in one sharp AOI control stack.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <MagneticButton href={dashboardUrl}>
                  Open Dashboard
                  <ArrowRight className="h-4 w-4" />
                </MagneticButton>
                <MagneticButton href="/#modules" variant="secondary">
                  Explore Bot Modules
                  <ChevronRight className="h-4 w-4" />
                </MagneticButton>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {heroStats.map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    className="lux-surface rounded-xl px-4 py-4"
                    initial={reducedMotion ? false : { opacity: 0, y: 16 }}
                    whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.55, delay: 0.12 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{stat.label}</div>
                    <div className="mt-2 card-heading text-2xl text-foreground">{stat.value}</div>
                  </motion.div>
                ))}
              </div>
            </Reveal>

            <div className="relative">
              <AoiCatMascot className="absolute -right-3 -top-12 z-30 w-36 rotate-3 sm:w-44 lg:-right-8 lg:-top-16 lg:w-52" />
              <div className="floating-chip absolute -left-5 top-10 z-20 hidden rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground/84 md:block">
                Staff tools synced
              </div>
              <div
                className="floating-chip absolute -right-4 bottom-8 z-20 hidden rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-primary md:block"
                style={{ animationDelay: "-3s" }}
              >
                99.98% command uptime
              </div>
              <div className="relative">
                <DashboardMock compact />
              </div>
            </div>
          </div>
        </section>

        <SectionDivider />

        <section id="modules" className="public-section py-14 text-foreground sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <Reveal className="lg:sticky lg:top-28">
              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                <Layers3 className="h-4 w-4 text-primary" />
                Module architecture
              </div>
              <h2 className="mt-6 text-3xl sm:text-4xl">
                Every part of the platform feels
                <span className="text-primary"> intentionally connected.</span>
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-8 text-foreground/82 sm:text-base">
                A premium landing page is pointless if the product underneath feels random. The structure here reflects real module boundaries, real command flow, and real dashboard control.
              </p>

              <div className="mt-7 space-y-3">
                {["Shared command language", "Consistent dashboard editing", "Member-facing flows without visual drift"].map((item, index) => (
                  <div key={item} className="lux-surface rounded-xl px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-primary">
                        {index === 0 ? <TerminalSquare className="h-4 w-4" /> : index === 1 ? <Gauge className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                      </div>
                      <div className="text-sm font-medium text-foreground/86">{item}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {moduleCards.map((module, index) => {
                const Icon = module.icon;
                return (
                  <InteractiveSurface key={module.title} delay={index * 0.06} className="p-5 sm:p-6">
                    <div className="relative z-10">
                      <div className="mb-5 inline-flex rounded-lg border border-border bg-background p-3 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="card-heading text-[1.32rem]">{module.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-foreground/84">{module.description}</p>
                    </div>
                  </InteractiveSurface>
                );
              })}
            </div>
          </div>
          </div>
        </section>

        <SectionDivider />

        <section id="workflow" className="public-section py-14 text-foreground sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center">
            <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
              <Zap className="h-4 w-4 text-primary" />
              Command-first workflow
            </div>
            <h2 className="mt-6 text-3xl sm:text-4xl">
              Setup looks premium because the
              <span className="text-primary"> flow is frictionless.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-foreground/74 sm:text-base">
              The page now sells an operational system, not isolated features. Commands start the action, the dashboard refines the behavior, and the server experience stays polished.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-5 lg:grid-cols-[0.94fr_1.06fr]">
            <div className="grid gap-4">
              {workflowSteps.map((step, index) => (
                <InteractiveSurface key={step.tag} delay={index * 0.08} className="p-5">
                  <div className="relative z-10 flex items-start gap-4">
                    <div className="mt-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-primary">
                      {step.tag}
                    </div>
                    <div>
                      <h3 className="card-heading text-xl">{step.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-foreground/84">{step.description}</p>
                    </div>
                  </div>
                </InteractiveSurface>
              ))}
            </div>

            <Reveal>
              <div className="lux-surface overflow-hidden rounded-xl p-5 sm:p-7">
                <div className="relative z-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Realtime load</div>
                      <div className="mt-2 card-heading text-5xl text-foreground sm:text-6xl">1.8k</div>
                    </div>
                    <div className="rounded-full border border-emerald-500/24 bg-emerald-500/14 px-3 py-1 text-xs font-semibold text-emerald-400">
                      Stable
                    </div>
                  </div>
                  <p className="mt-3 max-w-md text-sm text-foreground/72">
                    Message flow, moderation traffic, and member tools all sit under one tuned control plane.
                  </p>
                </div>

                <div className="relative z-10 mt-8 h-56 premium-graph">
                  {[25, 50, 75].map((percent) => (
                    <div
                      key={percent}
                      className="premium-grid-line"
                      style={{ bottom: `${percent}%` }}
                    />
                  ))}

                  <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-4 pb-10">
                    {workflowGraphBars.map((height, index) => (
                      <motion.div
                        key={index}
                        className="premium-bar flex-1"
                        style={{ height: `${height}%` }}
                        initial={reducedMotion ? false : { scaleY: 0, opacity: 0 }}
                        whileInView={reducedMotion ? undefined : { scaleY: 1, opacity: 1 }}
                        viewport={{ once: true, amount: 0.4 }}
                        transition={{ duration: 0.7, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                      />
                    ))}
                  </div>

                  <div className="absolute inset-x-0 bottom-2 flex justify-between px-4">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                      <span key={label} className="premium-axis-label">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="relative z-10 mt-8 grid gap-3 sm:grid-cols-3">
                  {showcaseCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div key={card.title} className="relative rounded-lg border border-border bg-background p-4">
                        <div className="mb-3 inline-flex rounded-lg border border-border bg-card p-2.5 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="text-sm font-semibold text-foreground">{card.title}</div>
                        <p className="mt-2 text-sm leading-6 text-foreground/68">{card.summary}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          </div>
          </div>
        </section>

        <SectionDivider />

        <section className="public-section py-8 text-foreground">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="marquee-shell rounded-xl border border-border bg-card px-8 py-4">
            <div className="animate-marquee-horizontal flex w-[200%] items-center gap-6 whitespace-nowrap">
              {Array.from({ length: 18 }).map((_, index) => (
                <span key={index} className="inline-flex items-center gap-4 text-[11px] uppercase tracking-[0.34em] text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-foreground/82">Operate communities cleanly</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>Dashboard + commands + automations</span>
                </span>
              ))}
            </div>
          </div>
          </div>
        </section>

        <SectionDivider />

        <section id="dashboard-preview" className="public-section py-14 text-foreground sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center">
            <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              AOI capabilities
            </div>
            <h2 className="mt-6 text-3xl sm:text-4xl">
              Everything you need to
              <span className="text-primary"> scale confidently.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-sm leading-8 text-foreground/82 sm:text-base">
              From day-one moderation to community growth operations, every feature is built to work together seamlessly.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {featureShowcase.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <InteractiveSurface key={feature.title} delay={index * 0.1} className="p-6">
                  <div className="relative z-10">
                    <div className="mb-5 inline-flex rounded-lg border border-border bg-background p-3 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="card-heading text-xl">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-foreground/84">{feature.description}</p>
                    <div className="mt-6 flex items-baseline gap-2">
                      <span className="card-heading text-3xl text-primary">{feature.stat}</span>
                      <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{feature.statLabel}</span>
                    </div>
                  </div>
                </InteractiveSurface>
              );
            })}
          </div>
          </div>
        </section>

        <SectionDivider />

        <section id="reviews" className="public-section py-14 text-foreground sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center">
            <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
              <Quote className="h-4 w-4 text-primary" />
              Trusted by communities
            </div>
            <h2 className="mt-6 text-3xl sm:text-4xl">
              Communities rely on
              <span className="text-primary"> controlled operations.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-sm leading-8 text-foreground/82 sm:text-base">
              Staff teams get faster moderation, cleaner dashboards, and fewer scattered bot surfaces.
            </p>
          </Reveal>

          <div className="mt-10 space-y-5">
            <div className="marquee-shell">
              <div className="animate-review-left flex w-[200%] gap-5">
                {[...leftReviews, ...leftReviews].map((review, index) => (
                  <ReviewCard key={`${review.name}-${index}`} review={review} />
                ))}
              </div>
            </div>
            <div className="marquee-shell">
              <div className="animate-review-right flex w-[200%] gap-5">
                {[...rightReviews, ...rightReviews].map((review, index) => (
                  <ReviewCard key={`${review.name}-${index}`} review={review} />
                ))}
              </div>
            </div>
          </div>
          </div>
        </section>

        <SectionDivider />

        <section className="public-section px-4 py-14 text-foreground sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-6xl">
          <InteractiveSurface className="grid overflow-hidden p-0 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="relative z-10 p-8 sm:p-10 lg:p-12">
              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                <Zap className="h-4 w-4 text-primary" />
                Final call
              </div>
              <h2 className="mt-6 text-3xl sm:text-4xl">
                Keep the server premium.
                <span className="block text-primary">Keep operations under control.</span>
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-foreground/82 sm:text-base">
                One command stack, one dashboard language, one polished member experience. That is what the landing page now communicates from the first second.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <MagneticButton href={dashboardUrl}>
                  Open Dashboard
                  <ArrowRight className="h-4 w-4" />
                </MagneticButton>
                <MagneticButton href="/features" variant="secondary">
                  Explore Features
                </MagneticButton>
              </div>
            </div>

            <div className="relative flex min-h-[20rem] items-center justify-center overflow-hidden p-10">
              <div className="relative z-10 flex flex-col items-center text-center">
                <BrandMark large quiet />
                <div className="mt-8 rounded-lg border border-border bg-background px-5 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  AOI control stack
                </div>
              </div>
            </div>
          </InteractiveSurface>
          </div>
        </section>
      </main>
    </div>
  );
}
