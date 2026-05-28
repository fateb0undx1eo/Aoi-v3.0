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
    <div 
      className={`footer-cat-container ${className}`}
      role="img"
      aria-label="Sleeping cat mascot"
    >
      <div className="mouse-detector">
        <div className="cat">
          {/* Sleeping Zzz */}
          <div className="sleep-symbol">
            <span>Z</span>
            <span>z</span>
            <span>z</span>
          </div>

          {/* The Cat SVG */}
          <div className="thecat">
            <svg
              width="45.952225mm"
              height="35.678726mm"
              viewBox="0 0 45.952225 35.678726"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs />
              <g transform="translate(-121.80376,-101.90461)">
                {/* Cat Body */}
                <path
                  style={{ display: 'inline', fill: '#1a1a2e', stroke: '#2d2d44', strokeWidth: '0.3' }}
                  d="m 144.95859,104.74193 c 6.01466,-2.1201 14.02915,-0.85215 17.62787,2.77812 3.59872,3.63027 2.91927,7.6226 -0.0661,11.80703 -2.98542,4.18443 -9.54667,3.58363 -15.1474,3.43959 -5.60073,-0.14404 -10.30411,-0.0586 -11.67474,-3.9026 7.85671,-2.22341 3.24576,-12.00205 9.26042,-14.12214 z"
                  id="path1"
                />

                {/* Right Ear */}
                <path
                  style={{ display: 'inline', fill: '#1a1a2e', stroke: '#2d2d44', strokeWidth: '0.3' }}
                  d="m 156.30732,121.30486 c 0,0 -3.82398,2.52741 -4.14054,3.7997 -0.31656,1.2723 0.31438,2.18109 0.95701,2.55128 0.64264,0.3702 1.59106,-0.085 2.13559,-0.75306 0.54452,-0.6681 1.5629,-2.25488 2.47945,-3.20579 0.91654,-0.95091 2.96407,-2.74361 2.96407,-2.74361 l 0.73711,-3.60348 z"
                  id="path2"
                />

                {/* Left Ear */}
                <path
                  style={{ display: 'inline', fill: '#1a1a2e', stroke: '#2d2d44', strokeWidth: '0.3' }}
                  d="m 136.93356,123.08347 c 0,0 -3.20149,3.2804 -3.24123,4.59088 -0.0397,1.31049 0.60411,1.83341 1.3106,2.05901 0.7065,0.22559 1.60304,-0.55255 1.99363,-1.32084 0.39056,-0.76832 1.14875,-2.30337 2.04139,-3.29463 0.89264,-0.99126 3.37363,-3.37561 3.37363,-3.37561 l -1.30007,-3.61169 z"
                  id="path3"
                />

                {/* Whiskers Left Bottom */}
                <path
                  style={{ display: 'inline', fill: '#1a1a2e', stroke: '#2d2d44', strokeWidth: '0.3' }}
                  d="m 130.12859,121.60522 c -2.15849,1.92962 -3.38576,3.23532 -3.61836,4.5256 -0.23257,1.2903 0.0956,1.80324 0.76105,2.13059 0.66549,0.32733 1.66701,-0.31006 2.16665,-1.01233 0.49961,-0.70231 1.04598,-1.14963 2.83575,-3.05671 1.78977,-1.90708 5.91823,-3.27102 5.91823,-3.27102 l -0.75313,-3.99546 c 0,0 -5.15171,2.7497 -7.31019,4.67933 z"
                  id="path4"
                />

                {/* Face/Body Front */}
                <path
                  id="path5"
                  style={{ display: 'inline', fill: '#2d2d44', stroke: '#3d3d5c', strokeWidth: '0.3' }}
                  d="m 147.59927,113.85404 c 0.68896,4.40837 -4.04042,7.93759 -10.51533,8.9455 -6.47491,1.00791 -12.24344,-0.88717 -12.9324,-5.29555 -0.68895,-4.40838 3.44199,-9.94186 9.9169,-10.94977 6.47491,-1.0079 12.84186,2.89144 13.53083,7.29982 z"
                />

                {/* Left Head Top */}
                <path
                  style={{ display: 'inline', fill: '#1a1a2e', stroke: '#2d2d44', strokeWidth: '0.3' }}
                  d="m 126.36446,111.82609 c 0,0 -2.37067,-6.28072 -0.86724,-7.10855 1.50342,-0.82783 5.87139,3.72617 5.87139,3.72617 z"
                  id="path6"
                />

                {/* Right Head Top */}
                <path
                  style={{ display: 'inline', fill: '#1a1a2e', stroke: '#2d2d44', strokeWidth: '0.3' }}
                  d="m 143.50182,108.85407 c 0,0 -0.0544,-6.71302 -1.75519,-6.94283 -1.70081,-0.22982 -4.13211,5.59314 -4.13211,5.59314 z"
                  id="path7"
                />

                {/* Whiskers Left */}
                <g id="g25" style={{ display: 'inline' }}>
                  <path
                    style={{ fill: 'none', stroke: '#4a4a6a', strokeWidth: '0.529167', strokeLinecap: 'round' }}
                    d="m 125.27102,116.06007 -2.97783,-1.05373"
                    id="path8"
                  />
                  <path
                    style={{ fill: 'none', stroke: '#4a4a6a', strokeWidth: '0.529167', strokeLinecap: 'round' }}
                    d="m 124.91643,116.80991 -2.84808,0.0754"
                    id="path9"
                  />
                  <path
                    style={{ fill: 'none', stroke: '#4a4a6a', strokeWidth: '0.529167', strokeLinecap: 'round' }}
                    d="m 124.97798,118.00308 -2.53111,0.5156"
                    id="path10"
                  />
                </g>

                {/* Whiskers Right */}
                <g
                  id="g13"
                  transform="rotate(-23.188815,49.755584,71.047761)"
                  style={{ display: 'inline', fill: 'none', stroke: '#4a4a6a', strokeLinecap: 'round' }}
                >
                  <path style={{ strokeWidth: '0.529167' }} d="m 121.77448,146.87682 3.00963,-0.95912" id="path11" />
                  <path style={{ strokeWidth: '0.529167' }} d="m 122.10521,147.63749 2.84427,0.16537" id="path12" />
                  <path style={{ strokeWidth: '0.529167' }} d="m 122.00599,148.82812 2.51354,0.59531" id="path13" />
                </g>

                {/* Left Eye - Sleeping */}
                <g id="lefteye" style={{ display: 'inline' }}>
                  <path
                    style={{ fill: 'none', stroke: '#6b6b8a', strokeWidth: '0.5', strokeLinecap: 'round' }}
                    d="m 129.5,115 c 1.5,-0.8 3,-0.5 3,-0.5"
                    id="lefteyelid"
                  />
                  <path
                    style={{ fill: 'none', stroke: '#6b6b8a', strokeWidth: '0.3', strokeLinecap: 'round' }}
                    d="m 131,114.8 l -0.3,-0.4"
                  />
                </g>

                {/* Right Eye - Sleeping */}
                <g id="righteye" style={{ display: 'inline' }}>
                  <path
                    style={{ fill: 'none', stroke: '#6b6b8a', strokeWidth: '0.5', strokeLinecap: 'round' }}
                    d="m 136.7,114 c 1.5,-0.9 3,-0.6 3,-0.6"
                    id="righteyelid"
                  />
                  <path
                    style={{ fill: 'none', stroke: '#6b6b8a', strokeWidth: '0.3', strokeLinecap: 'round' }}
                    d="m 138.2,113.8 l -0.3,-0.4"
                  />
                </g>

                {/* Nose */}
                <path
                  style={{ display: 'inline', fill: '#ff9999', stroke: 'none' }}
                  d="m 133.5,117.5 l 1,-0.8 l 1,0.8 z"
                  id="nose"
                />

                {/* Mouth */}
                <path
                  style={{ display: 'inline', fill: 'none', stroke: '#6b6b8a', strokeWidth: '0.3', strokeLinecap: 'round' }}
                  d="m 133,118.5 c 0.5,0.3 1,0.3 1.5,0"
                  id="mouth"
                />

                {/* Short Tail */}
                <path
                  id="tail"
                  style={{ display: 'inline', fill: '#1a1a2e', stroke: '#2d2d44', strokeWidth: '0.3' }}
                  d="m 163.77708,109.27292 c 4.36563,2.71198 4.26447,17.63497 3.70417,21.03437 -0.5603,3.3994 -1.86906,4.06275 -4.53099,4.49791 -5.87463,0.96037 -8.39724,-5.87134 -5.7547,-5.72161 2.64254,0.14973 3.15958,3.46446 5.95314,2.05052 2.79356,-1.41394 -1.42214,-13.46068 -1.42214,-13.46068 z"
                />

                {/* Long Tail */}
                <path
                  id="longtail"
                  style={{ display: 'inline', fill: '#1a1a2e', stroke: '#2d2d44', strokeWidth: '0.3' }}
                  d="m 164.24062,110.09354 -2.10788,6.5381 c 0,0 0.84017,12.88397 0.35269,20.95169 h 4.78291 c 0.83489,-8.63528 0.13334,-24.78453 -3.02772,-27.48979 z"
                />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommandSigil({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 220" role="img" aria-label="Command sigil" className={`command-sigil ${className}`}>
      <rect className="sigil-tile" x="22" y="22" width="176" height="176" rx="44" />
      <path className="sigil-ring" d="M110 44 176 110 110 176 44 110Z" />
      <path className="sigil-ring sigil-ring-inner" d="M110 72 148 110 110 148 72 110Z" />
      <path className="sigil-bolt" d="M118 63 83 117h30l-11 40 39-58h-31Z" />
      <circle className="sigil-node" cx="110" cy="44" r="8" />
      <circle className="sigil-node" cx="176" cy="110" r="8" />
      <circle className="sigil-node" cx="110" cy="176" r="8" />
      <circle className="sigil-node" cx="44" cy="110" r="8" />
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
        <section className="public-section aoi-grid-shell relative isolate overflow-visible px-4 pb-14 pt-8 text-foreground sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-7xl px-1 pb-10 pt-6 sm:px-0 lg:pt-8">
            <Reveal className="relative text-center">
              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Better-for-your-server Discord bot
              </div>
              <div className="relative mt-5 mx-auto">
                <h1 className="text-4xl leading-[1.02] tracking-normal sm:text-5xl lg:text-[3.9rem] xl:text-[4.45rem]">
                  Fuel your Discord
                  <span className="relative block text-primary">
                    community
                  </span>
                </h1>
              </div>
              <p className="mt-5 mx-auto max-w-lg text-sm leading-7 text-foreground/82 sm:text-base">
                Clean moderation, fast automations, slash commands, and server tools in one sharp AOI control stack.
              </p>

              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <MagneticButton href={dashboardUrl}>
                  Open Dashboard
                  <ArrowRight className="h-4 w-4" />
                </MagneticButton>
                <MagneticButton href="/#modules" variant="secondary">
                  Explore Bot Modules
                  <ChevronRight className="h-4 w-4" />
                </MagneticButton>
              </div>

              <div className="relative mt-7">
                <div className="grid gap-3 sm:grid-cols-3">
                  {heroStats.map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      className="lux-surface rounded-xl px-4 py-4 relative overflow-visible"
                      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
                      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.55, delay: 0.12 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{stat.label}</div>
                      <div className="mt-2 card-heading text-2xl text-foreground">{stat.value}</div>
                      {stat.label === "Command sync" && (
                        <div className="absolute -top-28 -right-4 sm:-top-32 sm:-right-8 w-36 sm:w-44 z-20 pointer-events-none">
                          <AoiCatMascot className="w-full" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </Reveal>
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
                      <div
                        key={index}
                        className="premium-bar flex-1"
                        style={{ height: `${height}%` }}
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
                <CommandSigil className="w-44 sm:w-56" />
                <div className="mt-8 rounded-lg border border-border bg-background px-5 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Command control stack
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