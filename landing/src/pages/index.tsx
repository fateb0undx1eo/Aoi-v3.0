import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  Crown,
  MessageSquareMore,
  Play,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Wand2,
  Zap,
} from "lucide-react";
import { SiteNavbar } from "@/components/site-navbar";
import { BrandMark } from "@/components/brand-mark";

const heroWords = ["Moderation", "Automation", "Commands", "Embeds", "Utilities", "Analytics"];

const moduleCards = [
  {
    icon: ShieldCheck,
    title: "Moderation Core",
    description: "Anti-raid controls, warnings, timed actions, and policy-safe filters in one control layer.",
  },
  {
    icon: Sparkles,
    title: "Response Utilities",
    description: "Autoresponders, sticky prompts, and embed tools that keep server routines clean without heavy runtime cost.",
  },
  {
    icon: Wand2,
    title: "Workflow Automation",
    description: "Automate repetitive staff actions and onboarding routines with predictable rule chains.",
  },
  {
    icon: MessageSquareMore,
    title: "Message & Voice Logs",
    description: "Track edits, deletes, joins, leaves, role changes, and voice transitions without noise.",
  },
  {
    icon: TerminalSquare,
    title: "Command Hub",
    description: "Permission-aware slash commands grouped by moderation, utility, onboarding, and support.",
  },
  {
    icon: Crown,
    title: "Scale Confidence",
    description: "Built for growing communities where consistency and auditability matter every day.",
  },
];

const commandHighlights = [
  { title: "/warn", summary: "Warn with context and enforce structured moderation records." },
  { title: "/autoresponder", summary: "Trigger lightweight text flows without building a large automation pipeline." },
  { title: "/sticky", summary: "Pin channel guidance in place with low-maintenance sticky prompts." },
  { title: "/afk", summary: "Set lightweight personal status without noisy presence infrastructure." },
];

const showcaseCards = [
  { icon: Bot, title: "Multipurpose command routing" },
  { icon: Zap, title: "Fast automation triggers" },
  { icon: ShieldCheck, title: "Moderation confidence checks" },
];

const incomeBars = [30, 48, 40, 56, 52, 38, 62, 78, 70, 82, 66, 55, 44, 58, 36, 28, 46, 54];

const trustedReviews = [
  {
    name: "karma",
    role: "owner",
    quote:
      "We moved from a stack of separate bots to one system. Moderation and utility now feel consistent.",
  },
  {
    name: "chineseguy",
    role: "admin",
    quote:
      "Action history is clearer and command flow is faster. Staff onboarding became much easier.",
  },
  {
    name: "inferno",
    role: "mod lead",
    quote:
      "Anti-raid + ticketing in one dashboard reduced mistakes during high traffic windows.",
  },
  {
    name: "rei fanta",
    role: "community manager",
    quote:
      "Everything connects properly. Moderation, support, and utility no longer feel stitched together.",
  },
  {
    name: "akira",
    role: "operations",
    quote:
      "Clean module boundaries and stable defaults. We only enabled what we needed and it stayed reliable.",
  },
  {
    name: "pixxie",
    role: "server owner",
    quote:
      "The premium UI is not just visual; it reflects structured controls that our whole staff trusts.",
  },
  {
    name: "misal pav",
    role: "manager",
    quote:
      "Consistent command behavior plus clear logs made this our single source of truth for actions.",
  },
  {
    name: "sora",
    role: "moderator",
    quote:
      "First multipurpose bot we used where features feel intentionally designed as one platform.",
  },
  {
    name: "marcos",
    role: "co-owner",
    quote:
      "The system scales well. We kept adding modules without the interface becoming chaotic.",
  },
  {
    name: "nova",
    role: "admin",
    quote:
      "Good defaults plus depth when needed. It works for both daily moderation and growth operations.",
  },
];

function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      {
        threshold: 0.18,
        rootMargin: "-12% 0px -12% 0px",
      }
    );

    if (nodeRef.current) {
      observer.observe(nodeRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      ref={nodeRef}
      className={className}
      initial={false}
      animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
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
      morphTimer = setTimeout(() => setIsMorphing(false), 560);
    }, 5600);
    return () => {
      clearInterval(timer);
      if (morphTimer) {
        clearTimeout(morphTimer);
      }
    };
  }, []);

  const word = heroWords[index];

  return (
    <span className="relative inline-flex min-w-[10ch] justify-center">
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
            initial={{ opacity: 0, y: 7, scale: 0.99, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -7, scale: 1.01, filter: "blur(3px)" }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="inline-block text-primary"
          >
            {word}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}

function UnifiedCard({
  icon: Icon,
  title,
  description,
  delay = 0,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <FadeIn delay={delay}>
      <article className="lux-card theme-animate h-full">
        <div className="mb-5 inline-flex rounded-xl border border-border/70 bg-background/70 p-2.5 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <h3 className="card-heading text-[1.34rem]">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-foreground/90">{description}</p>
      </article>
    </FadeIn>
  );
}

export default function LandingPage() {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || "/dashboard";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[4%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,hsl(var(--hero-blue)/0.24),transparent_65%)] blur-3xl" />
        <div className="absolute right-[-8%] top-[8%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,hsl(var(--hero-pink)/0.2),transparent_68%)] blur-3xl" />
        <div className="absolute left-[20%] top-[38%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,hsl(var(--hero-red)/0.14),transparent_70%)] blur-3xl" />
      </div>

      <SiteNavbar />

      <main id="top" className="relative z-10">
        <section className="section-shell relative mx-auto flex min-h-[calc(100svh-4.75rem)] max-w-6xl items-center overflow-hidden bg-[linear-gradient(180deg,hsl(var(--section-a)/0.74),transparent)] px-4 py-8 text-center sm:px-6 sm:py-10 lg:px-8">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_18%,hsl(var(--hero-blue)/0.22),transparent_44%)]" />
          <FadeIn className="mx-auto w-full max-w-5xl">
            <p className="subtext text-sm uppercase tracking-[0.22em] text-muted-foreground">
              Built for communities that demand command and clarity
            </p>
            <h1 className="mx-auto mt-3 max-w-5xl text-4xl leading-[1] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
              The control center for
              <span className="mt-3 block sm:mt-5">
                <MorphWord />
              </span>
              <span className="mt-3 block text-foreground/55">across moderation, utility, and growth.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-foreground/88 sm:text-lg">
              Operate your Discord community from one premium multipurpose stack with reliable moderation, automation, and daily-use utilities.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href={dashboardUrl}
                className="theme-animate inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_20px_45px_-20px_hsl(var(--primary)/0.88)] hover:bg-primary/90"
              >
                Open Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/#modules"
                className="theme-animate inline-flex items-center gap-2 rounded-2xl border border-border px-6 py-3 text-sm font-semibold text-foreground hover:border-primary/50"
              >
                Explore Modules
              </Link>
            </div>
          </FadeIn>
        </section>

        <section id="modules" className="section-shell relative overflow-hidden bg-[linear-gradient(180deg,hsl(var(--section-b)/0.5),hsl(var(--section-c)/0.36))] py-16 sm:py-20">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_22%,hsl(var(--hero-pink)/0.15),transparent_40%)]" />
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <FadeIn className="text-center">
              <h2 className="text-3xl sm:text-5xl">
                Every module you need.
                <span className="block text-foreground/55">Nothing that feels bolted on.</span>
              </h2>
            </FadeIn>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {moduleCards.map((module, index) => (
                <UnifiedCard
                  key={module.title}
                  icon={module.icon}
                  title={module.title}
                  description={module.description}
                  delay={index * 0.05}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="section-shell relative overflow-hidden mx-auto max-w-6xl bg-[linear-gradient(180deg,hsl(var(--section-c)/0.42),hsl(var(--section-d)/0.3))] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_24%_12%,hsl(var(--hero-blue)/0.12),transparent_48%)]" />
          <FadeIn className="text-center">
            <h2 className="text-3xl sm:text-5xl">
              Setup is
              <span className="text-primary"> effortless.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-foreground/85 sm:text-base">
              Smooth section reveals, one card system, and command-first workflows tuned for real moderation teams.
            </p>
          </FadeIn>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {commandHighlights.map((item, index) => (
              <FadeIn key={item.title} delay={index * 0.07}>
                <article className="lux-card theme-animate h-full">
                  <div className="mb-3 inline-flex rounded-xl border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold text-primary">
                    {item.title}
                  </div>
                  <h3 className="card-heading text-xl">Command Detail</h3>
                  <p className="mt-2 text-sm leading-7 text-foreground/86">{item.summary}</p>
                </article>
              </FadeIn>
            ))}
          </div>

          <div id="showcase">
            <FadeIn className="mt-16 text-center sm:mt-24">
              <h2 className="text-3xl sm:text-5xl">
                Real-time dashboard
                <span className="text-foreground/55"> signal card.</span>
              </h2>
            </FadeIn>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-[1fr_0.95fr]">
            <FadeIn>
              <article className="lux-card theme-animate relative overflow-hidden bg-[#08080a] p-6 text-white sm:p-8">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(194,0,0,0.36),transparent_62%)]" />
                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[linear-gradient(90deg,transparent,rgba(255,0,0,0.26),transparent)]" />
                <div className="relative">
                  <p className="subtext text-sm text-white/90">Income</p>
                  <div className="mt-2 flex items-end gap-3">
                    <h3 className="card-heading text-5xl text-white sm:text-6xl">$32,134</h3>
                    <span className="card-heading pb-1 text-2xl text-emerald-400">+2.5%</span>
                  </div>
                  <p className="mt-2 text-sm text-white/70">Compared to $21,340 last month</p>
                </div>

                <div className="relative mt-8 h-56 sm:h-64">
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2">
                    {incomeBars.map((height, index) => (
                      <motion.div
                        key={index}
                        className="relative w-2.5 rounded-full sm:w-3"
                        style={{
                          height: `${Math.max(height - 8, 18)}%`,
                          background: "linear-gradient(180deg,#ff2e2e 0%, #a30000 74%, #5f0000 100%)",
                          boxShadow: "0 0 22px rgba(255,20,20,0.58)",
                        }}
                        initial={{ opacity: 0.42, scaleY: 0.86 }}
                        whileInView={{ opacity: 1, scaleY: 1 }}
                        viewport={{ once: false, amount: 0.45 }}
                        transition={{ duration: 0.42, delay: index * 0.015 }}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 mt-4 flex justify-between px-1 text-xs tracking-[0.2em] text-white/70 sm:text-sm">
                    {["01", "02", "03", "04", "05", "06", "07", "08", "09"].map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                </div>
              </article>
            </FadeIn>

            <div className="grid gap-4">
              {showcaseCards.map((card, index) => {
                const Icon = card.icon;
                return (
                  <FadeIn key={card.title} delay={index * 0.06}>
                    <article className="lux-card theme-animate h-full">
                      <div className="mb-4 inline-flex rounded-xl border border-border/70 bg-background/65 p-2.5 text-primary">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <h3 className="card-heading text-xl">{card.title}</h3>
                    </article>
                  </FadeIn>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section-shell border-y border-border/70 bg-[linear-gradient(90deg,transparent,hsl(var(--section-d)/0.72),transparent)] py-4">
          <div className="overflow-hidden whitespace-nowrap">
            <div className="animate-marquee-horizontal flex w-[200%] items-center gap-5">
              {Array.from({ length: 24 }).map((_, index) => (
                <span key={index} className="inline-flex items-center gap-5 text-[11px] uppercase tracking-[0.34em] text-muted-foreground">
                  <span>Protect communities</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="section-shell relative overflow-hidden mx-auto max-w-6xl bg-[linear-gradient(180deg,hsl(var(--section-d)/0.48),transparent)] px-4 py-16 sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_76%_24%,hsl(var(--hero-red)/0.13),transparent_44%)]" />
          <FadeIn className="text-center">
            <h2 className="text-3xl sm:text-5xl">
              Dashboard preview
              <span className="block text-foreground/55">for GIF or video embed.</span>
            </h2>
          </FadeIn>
          <FadeIn className="mt-10">
            <div className="lux-card theme-animate p-4 sm:p-5">
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-dashed border-border/75 bg-[linear-gradient(135deg,hsl(var(--section-c)/0.66),hsl(var(--section-d)/0.55))]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,hsl(var(--hero-blue)/0.22),transparent_58%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,hsl(var(--hero-red)/0.2),transparent_60%)]" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background/70 text-primary">
                    <Play className="h-5 w-5" />
                  </span>
                  <p className="card-heading text-xl">Drop dashboard GIF/video here</p>
                  <p className="text-sm text-foreground/82">Use this slot for a recorded dashboard walkthrough.</p>
                </div>
              </div>
            </div>
          </FadeIn>
        </section>

        <section id="reviews" className="section-shell relative overflow-hidden mx-auto max-w-6xl bg-[linear-gradient(180deg,hsl(var(--section-d)/0.2),transparent)] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_14%_22%,hsl(var(--hero-blue)/0.12),transparent_40%)]" />
          <FadeIn className="text-center">
            <h2 className="text-3xl sm:text-5xl">
              Trusted by communities
              <span className="block text-foreground/55">worldwide.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-foreground/85 sm:text-base">
              Structured testimonials with subtle reveal motion that keeps the page clean and serious.
            </p>
          </FadeIn>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trustedReviews.map((review, index) => (
              <motion.article
                key={review.name}
                initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.44, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }}
                className="theme-animate h-full rounded-[1.35rem] border border-border/70 bg-[linear-gradient(145deg,hsl(var(--card-solid)/0.92),hsl(var(--card)/0.68))] p-5 shadow-[0_8px_24px_-16px_hsl(var(--primary)/0.2)] backdrop-blur-xl"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="card-heading text-sm capitalize">{review.name}</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{review.role}</div>
                  </div>
                  <span className="rounded-full border border-primary/35 bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-primary">
                    Trusted
                  </span>
                </div>
                <p className="text-sm leading-6 text-foreground/88">&quot;{review.quote}&quot;</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
          <FadeIn>
            <article className="lux-card theme-animate grid overflow-hidden p-0 lg:grid-cols-[1fr_0.8fr]">
              <div className="p-8 sm:p-10">
                <h2 className="text-4xl sm:text-5xl">
                  Keep your server
                  <span className="text-primary"> controlled.</span>
                  <span className="block text-foreground/55">Keep your community moving.</span>
                </h2>
                <p className="mt-6 max-w-xl text-sm leading-8 text-foreground/86 sm:text-base">
                  One multipurpose core for moderation, support, commands, and automation without UI fragmentation.
                </p>
                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <Link
                    href={dashboardUrl}
                    className="theme-animate inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Open Dashboard
                  </Link>
                  <Link
                    href="/features"
                    className="theme-animate inline-flex items-center justify-center gap-2 rounded-2xl border border-border px-6 py-3 text-sm font-semibold hover:border-primary/55"
                  >
                    Explore Full Feature Page
                  </Link>
                </div>
              </div>
              <div className="relative flex min-h-[18rem] items-center justify-center p-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--hero-red)/0.2),transparent_60%)]" />
                <BrandMark large />
              </div>
            </article>
          </FadeIn>
        </section>
      </main>
    </div>
  );
}
