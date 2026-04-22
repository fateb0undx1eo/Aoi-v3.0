import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  BellRing,
  Bot,
  ChevronRight,
  Crown,
  Gauge,
  Layers3,
  MessageSquareMore,
  Play,
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

const heroWords = ["Moderation", "Automation", "Commands", "Embeds", "Utilities", "Analytics"];

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
    tag: "/sticky",
    title: "Channels stay self-guided",
    description: "Keep rules, onboarding prompts, and repetitive guidance visible without manual staff cleanup.",
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

const dashboardSignals = [
  { label: "Automod policy", state: "Active", accent: "text-emerald-400" },
  { label: "Community queue", state: "Stable", accent: "text-foreground/76" },
  { label: "Broadcast checks", state: "Ready", accent: "text-primary" },
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

function usePageScrollMetrics() {
  const [metrics, setMetrics] = useState({ progress: 0, scrollY: 0 });

  useEffect(() => {
    let frame = 0;

    const update = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const scrollY = window.scrollY;
      setMetrics({
        progress: height > 0 ? Math.min(scrollY / height, 1) : 0,
        scrollY,
      });
      frame = 0;
    };

    const onScroll = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return metrics;
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
      initial={reducedMotion ? false : { opacity: 0, y: 28, filter: "blur(10px)" }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function MorphWord() {
  const [index, setIndex] = useState(0);
  const [isMorphing, setIsMorphing] = useState(false);

  useEffect(() => {
    let morphTimer: ReturnType<typeof setTimeout> | null = null;
    const timer = setInterval(() => {
      setIsMorphing(true);
      setIndex((current) => (current + 1) % heroWords.length);
      if (morphTimer) {
        clearTimeout(morphTimer);
      }
      morphTimer = setTimeout(() => setIsMorphing(false), 540);
    }, 5400);

    return () => {
      clearInterval(timer);
      if (morphTimer) {
        clearTimeout(morphTimer);
      }
    };
  }, []);

  const word = heroWords[index];

  return (
    <span className="relative inline-flex min-w-[11ch] justify-center sm:justify-start">
      <svg className="pointer-events-none absolute h-0 w-0">
        <filter id="hero-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </svg>

      <span className={isMorphing ? "[filter:url(#hero-goo)]" : undefined}>
        <AnimatePresence mode="wait">
          <motion.span
            key={word}
            initial={{ opacity: 0, y: 8, scale: 0.985, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, scale: 1.012, filter: "blur(4px)" }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block bg-[linear-gradient(120deg,hsl(var(--foreground)),hsl(var(--primary))_68%,hsl(var(--hero-blue)))] bg-clip-text text-transparent"
          >
            {word}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
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
  const reducedMotion = useReducedMotionPreference();
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number; size: number }>>([]);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMove = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (reducedMotion) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const moveX = ((x / rect.width) - 0.5) * 10;
    const moveY = ((y / rect.height) - 0.5) * 10;
    setOffset({ x: moveX, y: moveY });
  };

  const handleLeave = () => setOffset({ x: 0, y: 0 });

  const handleClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 0.95;
    const id = Date.now();
    setRipples((current) => [
      ...current,
      { id, x: event.clientX - rect.left, y: event.clientY - rect.top, size },
    ]);

    window.setTimeout(() => {
      setRipples((current) => current.filter((ripple) => ripple.id !== id));
    }, 620);
  };

  return (
    <Link
      href={href}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={handleClick}
      className={`premium-button premium-button-${variant} inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold`}
      style={reducedMotion ? undefined : { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="button-ripple"
          style={{ left: ripple.x, top: ripple.y, width: ripple.size, height: ripple.size }}
        />
      ))}
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
    cardRef.current.style.setProperty("--rotate-x", `${(0.5 - py) * 8}deg`);
    cardRef.current.style.setProperty("--rotate-y", `${(px - 0.5) * 10}deg`);
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
      className={`dashboard-mock rounded-[2rem] p-4 sm:p-5 ${className}`}
      initial={reducedMotion ? false : { opacity: 0, y: 22, scale: 0.985 }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.24 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="dashboard-scanline" />
      <div className={`relative z-10 grid gap-4 ${compact ? "lg:grid-cols-[4.5rem_1fr]" : "lg:grid-cols-[5.25rem_1fr]"}`}>
        <div className="hidden rounded-[1.5rem] border border-border/70 bg-background/58 p-3 backdrop-blur-xl lg:block">
          <div className="flex h-full flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                <BrandMark />
              </div>
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-11 rounded-2xl border border-border/60 bg-card/72"
                  style={{ opacity: index === 1 ? 1 : 0.72 }}
                />
              ))}
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/70 p-3 text-center text-[10px] uppercase tracking-[0.24em] text-primary">
              Live
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-[1.7rem] border border-border/70 bg-background/56 p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
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
            <div className="rounded-[1.6rem] border border-border/70 bg-background/58 p-4 backdrop-blur-xl sm:p-5">
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
                        background: "linear-gradient(180deg, hsl(var(--primary)), hsl(var(--hero-red) / 0.92))",
                        boxShadow: "0 0 22px hsl(var(--primary) / 0.34)",
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
              <div className="rounded-[1.6rem] border border-border/70 bg-background/58 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">Modules</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  {dashboardSignals.map((signal) => (
                    <div key={signal.label} className="rounded-2xl border border-border/65 bg-card/76 p-3">
                      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{signal.label}</div>
                      <div className={`mt-2 text-sm font-semibold ${signal.accent}`}>{signal.state}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[1.6rem] border border-border/70 bg-background/58 p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">Activity Feed</div>
                  <BellRing className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-3 space-y-3">
                  {["Announcement queued", "Moderation log synced", "Waifu drop config updated"].map((item, index) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl border border-border/65 bg-card/74 px-3 py-2.5">
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
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,hsl(var(--primary)/0.22),hsl(var(--hero-blue)/0.18))] text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            {review.name.slice(0, 2)}
          </div>
          <div>
            <div className="card-heading text-base capitalize">{review.name}</div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{review.role}</div>
          </div>
        </div>
        <div className="rounded-2xl border border-primary/25 bg-primary/10 p-2 text-primary shadow-[0_0_22px_-10px_hsl(var(--primary)/0.55)]">
          <Quote className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-5 text-sm leading-7 text-foreground/88 sm:text-[0.95rem]">&quot;{review.quote}&quot;</p>
    </div>
  );
}

export default function LandingPage() {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || "/dashboard";
  const reducedMotion = useReducedMotionPreference();
  const { progress, scrollY } = usePageScrollMetrics();
  const heroParallax = reducedMotion ? 0 : Math.min(scrollY * 0.08, 34);
  const leftReviews = trustedReviews.slice(0, Math.ceil(trustedReviews.length / 2));
  const rightReviews = trustedReviews.slice(Math.ceil(trustedReviews.length / 2));

  return (
    <div className="theme-surface min-h-screen overflow-x-clip bg-background text-foreground">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-px bg-border/35">
        <div
          className="h-full origin-left bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--hero-blue)),hsl(var(--hero-red)))] shadow-[0_0_28px_hsl(var(--primary)/0.5)]"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="landing-noise absolute inset-0" />
      </div>

      <SiteNavbar />

      <main id="top" className="relative z-10">
        <section className="relative isolate overflow-hidden px-4 pb-14 pt-8 sm:px-6 lg:px-8">
          <div className="absolute inset-x-0 top-0 h-[48rem] overflow-hidden" style={{ transform: `translate3d(0, ${heroParallax}px, 0)` }}>
            <div className="hero-mesh" />
            <div className="hero-grid" />
            <div className="hero-orb left-[8%] top-[18%] h-52 w-52" />
            <div className="hero-orb bottom-[16%] right-[10%] h-64 w-64" style={{ animationDelay: "-5s" }} />
            <div className="hero-spotlight" />
          </div>

          <div className="relative mx-auto grid min-h-[calc(100svh-7rem)] max-w-6xl items-center gap-12 pb-8 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pt-16">
            <Reveal className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-4 py-2 text-xs uppercase tracking-[0.28em] text-muted-foreground backdrop-blur-xl">
                <Sparkles className="h-4 w-4 text-primary" />
                Premium Discord platform
              </div>
              <h1 className="mt-7 max-w-4xl text-5xl leading-[0.92] tracking-[-0.07em] sm:text-6xl lg:text-7xl xl:text-[5.3rem]">
                The premium control center for
                <span className="mt-4 block">
                  <MorphWord />
                </span>
                <span className="mt-4 block text-foreground/52">built to run serious communities cleanly.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-8 text-foreground/82 sm:text-lg">
                Replace disconnected moderation, utility, dashboard, and community stacks with one system that feels expensive because it is structured properly.
              </p>

              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <MagneticButton href={dashboardUrl}>
                  Open Dashboard
                  <ArrowRight className="h-4 w-4" />
                </MagneticButton>
                <MagneticButton href="/#modules" variant="secondary">
                  Explore Modules
                  <ChevronRight className="h-4 w-4" />
                </MagneticButton>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {heroStats.map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    className="lux-surface rounded-[1.4rem] px-4 py-4"
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
              <div className="floating-chip absolute -left-5 top-10 z-20 hidden rounded-2xl border border-border/70 bg-card/72 px-4 py-3 text-sm font-medium text-foreground/84 shadow-[0_22px_44px_-28px_hsl(var(--foreground)/0.34)] backdrop-blur-xl md:block">
                Staff tools synced
              </div>
              <div
                className="floating-chip absolute -right-4 bottom-8 z-20 hidden rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary shadow-[0_0_30px_-12px_hsl(var(--primary)/0.48)] backdrop-blur-xl md:block"
                style={{ animationDelay: "-3s" }}
              >
                99.98% command uptime
              </div>
              <DashboardMock compact />
            </div>
          </div>
        </section>

        <SectionDivider />

        <section id="modules" className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <Reveal className="lg:sticky lg:top-28">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/58 px-4 py-2 text-xs uppercase tracking-[0.28em] text-muted-foreground backdrop-blur-xl">
                <Layers3 className="h-4 w-4 text-primary" />
                Module architecture
              </div>
              <h2 className="mt-6 text-4xl sm:text-5xl">
                Every part of the platform feels
                <span className="text-primary"> intentionally connected.</span>
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-8 text-foreground/82 sm:text-base">
                A premium landing page is pointless if the product underneath feels random. The structure here reflects real module boundaries, real command flow, and real dashboard control.
              </p>

              <div className="mt-8 space-y-3">
                {["Shared command language", "Consistent dashboard editing", "Member-facing flows without visual drift"].map((item, index) => (
                  <div key={item} className="lux-surface rounded-[1.35rem] px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        {index === 0 ? <TerminalSquare className="h-4 w-4" /> : index === 1 ? <Gauge className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                      </div>
                      <div className="text-sm font-medium text-foreground/86">{item}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            <div className="grid gap-5 sm:grid-cols-2">
              {moduleCards.map((module, index) => {
                const Icon = module.icon;
                return (
                  <InteractiveSurface key={module.title} delay={index * 0.06} className="p-6 sm:p-7">
                    <div className="relative z-10">
                      <div className="mb-5 inline-flex rounded-2xl border border-border/70 bg-background/66 p-3 text-primary backdrop-blur-xl">
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
        </section>

        <SectionDivider />

        <section id="workflow" className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <Reveal className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/58 px-4 py-2 text-xs uppercase tracking-[0.28em] text-muted-foreground backdrop-blur-xl">
              <Zap className="h-4 w-4 text-primary" />
              Command-first workflow
            </div>
            <h2 className="mt-6 text-4xl sm:text-5xl">
              Setup looks premium because the
              <span className="text-primary"> flow is frictionless.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-sm leading-8 text-foreground/82 sm:text-base">
              The page now sells an operational system, not isolated features. Commands start the action, the dashboard refines the behavior, and the server experience stays polished.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-5 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="grid gap-4">
              {workflowSteps.map((step, index) => (
                <InteractiveSurface key={step.tag} delay={index * 0.08} className="p-6">
                  <div className="relative z-10 flex items-start gap-4">
                    <div className="mt-1 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
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
              <div className="lux-surface overflow-hidden rounded-[2rem] bg-[#08080a] p-6 text-white sm:p-8">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_26%_18%,rgba(255,34,34,0.24),transparent_24%),radial-gradient(circle_at_84%_10%,rgba(125,0,0,0.22),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.28em] text-white/62">Realtime load</div>
                      <div className="mt-2 card-heading text-5xl sm:text-6xl">1.8k</div>
                    </div>
                    <div className="rounded-full border border-emerald-500/24 bg-emerald-500/14 px-3 py-1 text-xs font-semibold text-emerald-400">
                      Stable
                    </div>
                  </div>
                  <p className="mt-3 max-w-md text-sm text-white/66">
                    Message flow, moderation traffic, and member tools all sit under one tuned control plane.
                  </p>
                </div>

                <div className="relative z-10 mt-8 h-48">
                  <div className="absolute inset-x-0 bottom-0 flex items-end gap-2">
                    {chartBars.map((height, index) => (
                      <motion.div
                        key={index}
                        className="dashboard-bar flex-1 rounded-full"
                        style={{
                          height: `${height}%`,
                          background: "linear-gradient(180deg,#ff4747 0%, #c20c0c 68%, #540000 100%)",
                          boxShadow: "0 0 24px rgba(255,32,32,0.45)",
                          animationDelay: `${index * 0.07}s`,
                        }}
                        initial={reducedMotion ? false : { scaleY: 0.12, opacity: 0.42 }}
                        whileInView={reducedMotion ? undefined : { scaleY: 1, opacity: 1 }}
                        viewport={{ once: true, amount: 0.4 }}
                        transition={{ duration: 0.55, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 mt-4 flex justify-between px-1 text-[10px] uppercase tracking-[0.26em] text-white/45">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                </div>

                <div className="relative z-10 mt-8 grid gap-3 sm:grid-cols-3">
                  {showcaseCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div key={card.title} className="rounded-[1.4rem] border border-white/8 bg-white/5 p-4 backdrop-blur-xl">
                        <div className="mb-3 inline-flex rounded-xl border border-white/10 bg-white/6 p-2.5 text-red-300">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="text-sm font-semibold text-white">{card.title}</div>
                        <p className="mt-2 text-sm leading-6 text-white/60">{card.summary}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <SectionDivider />

        <section className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="marquee-shell rounded-[1.8rem] border border-border/70 bg-card/54 px-0 py-4 backdrop-blur-xl">
            <div className="animate-marquee-horizontal flex w-[200%] items-center gap-6 whitespace-nowrap">
              {Array.from({ length: 18 }).map((_, index) => (
                <span key={index} className="inline-flex items-center gap-4 text-[11px] uppercase tracking-[0.34em] text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-foreground/82 shadow-[0_0_18px_hsl(var(--primary)/0.18)]">Operate communities cleanly</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.55)]" />
                  <span>Dashboard + commands + automations</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        <SectionDivider />

        <section id="dashboard-preview" className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/58 px-4 py-2 text-xs uppercase tracking-[0.28em] text-muted-foreground backdrop-blur-xl">
                <Play className="h-4 w-4 text-primary" />
                Premium dashboard preview
              </div>
              <h2 className="mt-6 text-4xl sm:text-5xl">
                Not a placeholder.
                <span className="block text-primary">A real visual promise.</span>
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-8 text-foreground/82 sm:text-base">
                The empty video slot is gone. This mockup sells the product immediately, shows motion in the interface, and gives the page a premium center of gravity.
              </p>

              <div className="mt-8 grid gap-4">
                {[
                  "Animated signal cards, pulses, and live-state chips make the preview feel active.",
                  "The composition mirrors the actual dashboard language instead of generic SaaS scaffolding.",
                  "Hover depth, gradients, and layered panels keep dark mode black/red and light mode white/cyan clean.",
                ].map((item) => (
                  <div key={item} className="lux-surface rounded-[1.4rem] px-4 py-4">
                    <div className="flex items-start gap-3 text-sm leading-7 text-foreground/84">
                      <div className="mt-1 text-primary">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                      <span>{item}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            <DashboardMock className="min-h-[38rem]" />
          </div>
        </section>

        <SectionDivider />

        <section id="reviews" className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <Reveal className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/58 px-4 py-2 text-xs uppercase tracking-[0.28em] text-muted-foreground backdrop-blur-xl">
              <Quote className="h-4 w-4 text-primary" />
              Trusted by communities
            </div>
            <h2 className="mt-6 text-4xl sm:text-5xl">
              Testimonials now move like a
              <span className="text-primary"> premium carousel.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-sm leading-8 text-foreground/82 sm:text-base">
              Staggered auto-scrolling tracks, glowing quote marks, and gradient avatars lift this section without turning it into visual noise.
            </p>
          </Reveal>

          <div className="mt-12 space-y-5">
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
        </section>

        <SectionDivider />

        <section className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6 sm:pb-24 lg:px-8">
          <InteractiveSurface className="grid overflow-hidden p-0 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="relative z-10 p-8 sm:p-10 lg:p-12">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/58 px-4 py-2 text-xs uppercase tracking-[0.28em] text-muted-foreground backdrop-blur-xl">
                <Zap className="h-4 w-4 text-primary" />
                Final call
              </div>
              <h2 className="mt-6 text-4xl sm:text-5xl">
                Keep the server premium.
                <span className="block text-primary">Keep operations under control.</span>
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-8 text-foreground/82 sm:text-base">
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
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.2),transparent_52%),radial-gradient(circle_at_65%_30%,hsl(var(--hero-blue)/0.14),transparent_34%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent,hsl(var(--foreground)/0.04),transparent)]" />
              <div className="relative z-10 flex flex-col items-center text-center">
                <BrandMark large />
                <div className="mt-8 rounded-full border border-border/70 bg-card/62 px-5 py-2 text-xs uppercase tracking-[0.34em] text-muted-foreground backdrop-blur-xl">
                  Premium Discord stack
                </div>
              </div>
            </div>
          </InteractiveSurface>
        </section>
      </main>
    </div>
  );
}
