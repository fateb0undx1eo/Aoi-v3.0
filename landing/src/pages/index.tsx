"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Bot,
  ChevronRight,
  Code,
  Gauge,
  GitBranch,
  Layers3,
  Megaphone,
  Quote,
  Shield,
  ShieldCheck,
  Sparkles,
  Ticket,
  TrendingUp,
  Wrench,
  Users,
  Zap,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { BrandMark } from "@/components/brand-mark";
import { SiteNavbar } from "@/components/site-navbar";

const heroStats = [
  { label: "Response stack", value: "24/7" },
  { label: "Modules online", value: "18+" },
  { label: "Command sync", value: "<120ms" },
];

const TITLE_COLORS = ['#06b6d4', '#f59e0b', '#a78bfa'];

const moduleCards = [
  { icon: Shield, title: "Moderation Core", description: "Anti-raid protection, warnings, timeouts, and case tracking that keeps your server safe and organized." },
  { icon: Wrench, title: "Utility Layer", description: "Auto-replies, reminders, and quick commands that handle the daily stuff without getting in the way." },
  { icon: GitBranch, title: "Workflow Automation", description: "Turn staff tasks into simple workflows that your team actually wants to use." },
  { icon: Megaphone, title: "Message Systems", description: "Announcements, engagement tools, and channels that feel like part of your server, not bolted on." },
  { icon: Code, title: "Command Hub", description: "Organized commands with clear permissions and settings your whole staff can understand." },
  { icon: TrendingUp, title: "Growth Control", description: "One dashboard that works whether you're managing 50 members or 50,000." },
  { icon: BarChart3, title: "Analytics & Insights", description: "Track member activity, engagement trends, and server health with real-time metrics." },
  { icon: Ticket, title: "Ticket System", description: "Member support tickets that staff can organize, track, and resolve from the dashboard." },
  { icon: Users, title: "Role Management", description: "Auto-assign roles, manage permissions, and set up role requirements based on member activity." },
];

const trustedReviews = [
  { name: "The Oasis", role: "", quote: "We migrated three servers over to AOI and the setup was seamless. Moderation workflows that used to take hours now run on autopilot." },
  { name: "nyanime", role: "", quote: "The ticketing system alone saved our staff team countless hours. AOI handles the repetitive work so we can focus on community." },
  { name: "Ember Hollow", role: "", quote: "We tried five different bots before AOI. The difference is the dashboard actually makes sense — no digging through commands." },
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

function useDarkMode() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setIsDark(media.matches || document.documentElement.classList.contains("dark"));
    update();
    media.addEventListener("change", update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      media.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);
  return isDark;
}

function Reveal({ children, className, delay = 0, amount = 0.22 }: { children: ReactNode; className?: string; delay?: number; amount?: number }) {
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

function MagneticButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={`premium-button premium-button-${variant} inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold`}>
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}

function InteractiveSurface({ children, className = "", delay = 0, style = {} }: { children: ReactNode; className?: string; delay?: number; style?: React.CSSProperties }) {
  const reducedMotion = useReducedMotionPreference();
  const cardRef = useRef<HTMLElement>(null);

  const resetTilt = () => {
    if (!cardRef.current) return;
    cardRef.current.style.setProperty("--pointer-x", "50%");
    cardRef.current.style.setProperty("--pointer-y", "50%");
    cardRef.current.style.setProperty("--rotate-x", "0deg");
    cardRef.current.style.setProperty("--rotate-y", "0deg");
  };

  const handleMove = (event: ReactMouseEvent<HTMLElement>) => {
    if (reducedMotion || !cardRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    cardRef.current.style.setProperty("--pointer-x", `${px * 100}%`);
    cardRef.current.style.setProperty("--pointer-y", `${py * 100}%`);
    cardRef.current.style.setProperty("--rotate-x", "0deg");
    cardRef.current.style.setProperty("--rotate-y", "0deg");
  };

  useEffect(() => { resetTilt(); }, []);

  return (
    <Reveal delay={delay}>
      <article ref={cardRef} onMouseMove={handleMove} onMouseLeave={resetTilt} className={`lux-surface interactive-card ${className}`} style={style}>
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

function ModulesCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pressedButton, setPressedButton] = useState<'prev' | 'next' | null>(null);
  const [cardsPerView, setCardsPerView] = useState(3);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 640) setCardsPerView(1);
      else if (window.innerWidth < 1024) setCardsPerView(2);
      else setCardsPerView(3);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => { setCurrentIndex(0); }, [cardsPerView]);

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  const totalCards = moduleCards.length;

  const handleNext = () => {
    setPressedButton('next');
    setCurrentIndex((prev) => (prev + cardsPerView) % totalCards);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setPressedButton(null), 150);
  };

  const handlePrev = () => {
    setPressedButton('prev');
    setCurrentIndex((prev) => (prev - cardsPerView + totalCards) % totalCards);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setPressedButton(null), 150);
  };

  const gridClass = cardsPerView === 1 ? 'grid-cols-1' : cardsPerView === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="relative mt-4">
      <div className="flex items-center justify-between gap-3 sm:gap-6 lg:gap-8">
        <motion.button
          onClick={handlePrev}
          className="flex-shrink-0 p-2.5 rounded-lg transition-colors hover:bg-foreground/5"
          aria-label="Previous cards"
          animate={{ scale: pressedButton === 'prev' ? 0.92 : 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" style={{ color: 'white' }}>
            <path d="m15 18-6-6 6-6" />
          </svg>
        </motion.button>
          <div className="flex-1 overflow-hidden min-w-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${currentIndex}-${cardsPerView}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className={`grid gap-4 ${gridClass}`}
                style={{ minHeight: '220px' }}
            >
              {Array.from(
                { length: cardsPerView },
                (_, i) => moduleCards[(currentIndex + i) % moduleCards.length]
              ).map((module, idx) => {
                const Icon = module.icon;
                const titleColor = TITLE_COLORS[idx % TITLE_COLORS.length];
                return (
                  <motion.div
                    key={module.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: idx * 0.12, ease: [0.16, 1, 0.3, 1] }}
                    className="p-6 sm:p-7 rounded-xl flex flex-col hover:bg-foreground/5 transition-colors"
                    style={{ backgroundColor: '#000000' }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="inline-flex rounded-lg p-2.5 flex-shrink-0" style={{ backgroundColor: titleColor + '20' }}>
                        <Icon className="h-5 w-5" style={{ color: titleColor }} />
                      </div>
                      <h3 className="card-heading text-[1.18rem] leading-tight" style={{ color: titleColor }}>{module.title}</h3>
                    </div>
                    <p className="relative z-10 mt-3 text-sm leading-relaxed flex-grow" style={{ color: '#8a8a8a' }}>{module.description}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
        <motion.button
          onClick={handleNext}
          className="flex-shrink-0 p-2.5 rounded-lg transition-colors hover:bg-foreground/5"
          aria-label="Next cards"
          animate={{ scale: pressedButton === 'next' ? 0.92 : 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" style={{ color: 'white' }}>
            <path d="m9 18 6-6-6-6" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}

function MergedReviewCard({ reviews }: { reviews: typeof trustedReviews }) {
  return (
    <div
      className="relative overflow-hidden w-full rounded-xl"
      style={{ 
        height: '260px',
        backgroundColor: '#000000',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '100px 100px',
        }}
      />
      <div className="absolute inset-0 z-10 flex">
        {reviews.map((review, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8 relative">
            {idx > 0 && (
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '1px',
                backgroundColor: 'rgba(255,255,255,0.3)',
              }} />
            )}
            {idx !== 1 && <div className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: '#888' }}>{review.name}</div>}
            <p className="text-sm leading-6" style={{ color: '#ccc' }}>&quot;{review.quote}&quot;</p>
            {idx === 1 && <div className="text-xs uppercase tracking-[0.2em] mt-3" style={{ color: '#888' }}>{review.name}</div>}
          </div>
        ))}
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
  const isDark = useDarkMode();
  const leftReviews = trustedReviews.slice(0, Math.ceil(trustedReviews.length / 2));
  const rightReviews = trustedReviews.slice(Math.ceil(trustedReviews.length / 2));

  const [graphData, setGraphData] = useState<number[]>([0, 0, 0, 0, 0, 0]);

  useEffect(() => {
    const updateGraph = () => {
      const bars = Array.from({ length: 6 }, () => Math.floor(Math.random() * 60) + 20);
      setGraphData(bars);
    };

    updateGraph();
    const interval = setInterval(updateGraph, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="theme-surface min-h-screen overflow-x-clip bg-background text-foreground">
      <SiteNavbar />

      <main id="top" className="relative z-10">

        {/* ── Hero ── */}
        <section className="public-section section-hero-dark aoi-grid-shell relative isolate overflow-visible px-4 pb-14 pt-8 text-foreground sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-3xl px-1 pb-10 pt-6 sm:px-0 lg:pt-8">
            <Reveal className="relative text-center">
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Discord Bot Dashboard</p>
              <h1 className="mt-4 text-3xl leading-[1.02] tracking-normal sm:text-4xl font-bold">
                Manage your servers from one <span className="text-primary">control center</span>
              </h1>
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link
                  href={dashboardUrl}
                  className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold bg-[#5865F2] !text-white hover:bg-[#4752C4] transition-colors min-h-[2.75rem]"
                >
                  DASHBOARD
                </Link>
                <Link
                  href="/#modules"
                  className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold bg-gray-500 !text-white hover:bg-gray-600 transition-colors min-h-[2.75rem]"
                >
                  DOCS
                </Link>
              </div>
              <div className="mt-16 flex flex-col items-center">
                <div className="relative inline-block">
                  {/* Stats Card */}
                  <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 p-6 rounded-lg" style={{ backgroundColor: '#000000' }}>
                    {heroStats.map((stat, idx) => (
                      <div key={idx} className="text-center">
                        <div className="text-2xl sm:text-3xl font-bold" style={{ color: 'white' }}>{stat.value}</div>
                        <div className="mt-1 text-xs sm:text-sm uppercase tracking-[0.1em] text-muted-foreground">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Modules ── */}
        <section id="modules" className="public-section section-highlight py-6 sm:py-8 text-foreground" style={{ backgroundColor: 'black' }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground mb-1">
              Module architecture
            </Reveal>
            <div className="mb-2">
              <h2 className="mt-1 text-3xl sm:text-4xl">
                <span style={{ color: 'white' }}>Every part of the platform feels</span>
                <span className="text-primary"> intentionally connected.</span>
              </h2>
            </div>
            <ModulesCarousel />
          </div>
        </section>

        <SectionDivider />

        {/* ── Workflow with Animated Fading Grid Background ── */}
        <section
          id="workflow"
          className="public-section section-neutral py-14 text-foreground sm:py-16 relative overflow-hidden"
        >
          <div
            className="absolute inset-0 z-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--foreground) / 0.18) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--foreground) / 0.18) 1px, transparent 1px)
              `,
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 60%, transparent 92%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 60%, transparent 92%)',
              animation: 'grid-drift 10s linear infinite',
            }}
          />
          <div
            className="absolute inset-0 z-[1] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.04'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '128px 128px',
            }}
          />
          <style jsx>{`
            @keyframes grid-drift {
              0% { background-position: 0 0; }
              100% { background-position: 48px -48px; }
            }
            @keyframes noise-shift {
              0% { background-position: 0 0; }
              25% { background-position: 50px 25px; }
              50% { background-position: 25px 50px; }
              75% { background-position: -25px 25px; }
              100% { background-position: 0 0; }
            }
            @keyframes hex-scroll-left {
              0% { transform: translate3d(0, 0, 0); }
              100% { transform: translate3d(-50%, 0, 0); }
            }
            @keyframes hex-scroll-right {
              0% { transform: translate3d(0, 0, 0); }
              100% { transform: translate3d(50%, 0, 0); }
            }
          `}</style>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 relative z-10">
            <Reveal className="text-center">
              <div className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Command-first workflow
              </div>
              <h2 className="mt-6 text-3xl sm:text-4xl">
                Setup is clean because the
                <span className="text-primary"> flow is frictionless.</span>
              </h2>
            </Reveal>
            <Reveal>
              <div className="lux-surface overflow-hidden rounded-xl p-6 sm:p-8 mt-10">
                <div className="relative h-52">
                  <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span>100</span>
                    <span>75</span>
                    <span>50</span>
                    <span>25</span>
                    <span>0</span>
                  </div>
                  <div className="ml-12 h-full relative">
                    {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((val) => (
                      <div
                        key={val}
                        className="absolute left-0 right-0"
                        style={{ 
                          bottom: `${val}%`,
                          borderTop: val % 25 === 0 ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(0,0,0,0.05)'
                        }}
                      />
                    ))}
                    <svg
                      className="absolute inset-0 w-full h-full overflow-visible"
                      viewBox="0 0 500 160"
                      preserveAspectRatio="none"
                    >
                      <motion.path
                        key={`area-${graphData.join("-")}`}
                        d={`M0,160 ${graphData.map((val, i) => `L${(i / 5) * 500},${160 - (val / 100) * 160}`).join(" ")} L500,160 Z`}
                        fill="rgba(0,0,0,0.04)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6 }}
                      />
                      <motion.polyline
                        key={`line-${graphData.join("-")}`}
                        points={graphData.map((val, i) => `${(i / 5) * 500},${160 - (val / 100) * 160}`).join(" ")}
                        fill="none"
                        stroke={isDark ? "#ffffff" : "#000000"}
                        strokeWidth={isDark ? "1" : "1.5"}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </svg>
                  </div>
                  <div className="ml-12 flex justify-between mt-3">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                      <span key={label} className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Smooth infinite SVG marquee */}
        <section className="relative overflow-hidden pt-4 pb-0">
          <div className="flex overflow-hidden">
            <div
              className="flex gap-6 animate-marquee-horizontal"
              style={{ width: '200%', willChange: 'transform' }}
            >
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={`a-${i}`} className="flex-shrink-0" style={{ width: '47px', height: '47px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1536" width="24" height="24" className="text-foreground" style={{display:'block'}}><path fill="currentColor" d="M 775.0 1238.5 L 680.0 1234.5 L 594.0 1222.5 L 503.0 1197.5 L 445.0 1172.5 L 380.0 1132.5 L 329.5 1086.0 L 308.5 1060.0 L 287.5 1027.0 L 264.5 976.0 L 247.5 910.0 L 243.5 880.0 L 242.5 824.0 L 250.5 739.0 L 266.5 647.0 L 304.5 512.0 L 352.5 392.0 L 390.5 326.0 L 401.0 313.5 L 418.0 300.5 L 427.0 297.5 L 448.0 300.5 L 472.0 314.5 L 502.0 339.5 L 546.5 388.0 L 618.0 483.5 L 626.0 484.5 L 701.0 471.5 L 752.0 470.5 L 825.0 471.5 L 916.0 483.5 L 977.5 401.0 L 1033.0 340.5 L 1083.0 302.5 L 1095.0 297.5 L 1116.0 300.5 L 1133.0 311.5 L 1153.0 338.5 L 1184.5 397.0 L 1233.5 522.0 L 1269.5 655.0 L 1285.5 748.0 L 1293.5 825.0 L 1292.5 881.0 L 1288.5 910.0 L 1270.5 980.0 L 1247.5 1029.0 L 1226.5 1062.0 L 1205.5 1088.0 L 1155.0 1134.5 L 1090.0 1174.5 L 1032.0 1199.5 L 941.0 1224.5 L 855.0 1236.5 L 776.0 1239.5 Z"/></svg>
                </div>
              ))}
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={`b-${i}`} className="flex-shrink-0" style={{ width: '47px', height: '47px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1536" width="24" height="24" className="text-foreground" style={{display:'block'}}><path fill="currentColor" d="M 775.0 1238.5 L 680.0 1234.5 L 594.0 1222.5 L 503.0 1197.5 L 445.0 1172.5 L 380.0 1132.5 L 329.5 1086.0 L 308.5 1060.0 L 287.5 1027.0 L 264.5 976.0 L 247.5 910.0 L 243.5 880.0 L 242.5 824.0 L 250.5 739.0 L 266.5 647.0 L 304.5 512.0 L 352.5 392.0 L 390.5 326.0 L 401.0 313.5 L 418.0 300.5 L 427.0 297.5 L 448.0 300.5 L 472.0 314.5 L 502.0 339.5 L 546.5 388.0 L 618.0 483.5 L 626.0 484.5 L 701.0 471.5 L 752.0 470.5 L 825.0 471.5 L 916.0 483.5 L 977.5 401.0 L 1033.0 340.5 L 1083.0 302.5 L 1095.0 297.5 L 1116.0 300.5 L 1133.0 311.5 L 1153.0 338.5 L 1184.5 397.0 L 1233.5 522.0 L 1269.5 655.0 L 1285.5 748.0 L 1293.5 825.0 L 1292.5 881.0 L 1288.5 910.0 L 1270.5 980.0 L 1247.5 1029.0 L 1226.5 1062.0 L 1205.5 1088.0 L 1155.0 1134.5 L 1090.0 1174.5 L 1032.0 1199.5 L 941.0 1224.5 L 855.0 1236.5 L 776.0 1239.5 Z"/></svg>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Reviews ── */}
        <section id="reviews" className="public-section section-highlight py-6 sm:py-8 overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center">
              <div className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Servers that trust AOI
              </div>
              <h2 className="mt-6 text-3xl sm:text-4xl">
                Servers trust what
                <span className="text-primary"> actually works.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-3xl text-sm leading-8 text-foreground/82 sm:text-base">
                When communities need reliability, they choose a system that delivers results consistently.
              </p>
            </Reveal>
          </div>

          <div className="relative mt-8 px-4 sm:px-0 mx-auto" style={{ maxWidth: '800px' }}>
            <MergedReviewCard reviews={trustedReviews} />
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="public-section section-neutral px-4 py-16 text-foreground sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <style jsx>{`
              @keyframes noise-shift {
                0% { background-position: 0 0; }
                25% { background-position: 50px 25px; }
                50% { background-position: 25px 50px; }
                75% { background-position: -25px 25px; }
                100% { background-position: 0 0; }
              }
              .cta-card {
                position: relative;
                background-color: #000000;
                overflow: hidden;
              }
              .cta-card::before {
                content: '';
                position: absolute;
                inset: 0;
                background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E");
                background-repeat: repeat;
                background-size: 100px 100px;
                animation: noise-shift 6s steps(10) infinite;
                pointer-events: none;
              }
              .cta-content {
                position: relative;
                z-index: 10;
              }
            `}</style>
            <div className="lux-surface cta-card overflow-hidden rounded-xl p-8 sm:p-10 text-center" style={{ border: 'none' }}>
              <div className="cta-content">
                <div className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Ready?
                </div>
                <h2 className="mt-5 text-3xl sm:text-4xl">
                  <span style={{ color: 'white' }}>Fast where it matters,</span>
                  <span className="block text-primary">Reliable when it counts.</span>
                </h2>
                <p className="mt-4 text-xs text-muted-foreground tracking-wide" style={{ opacity: 0 }}>
                  <span style={{ color: 'white', fontWeight: '600' }}>—AKIRA</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer Section with AOI V3 overlay */}
        <section className="w-full bg-black py-20 sm:py-24 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{
            fontSize: 'clamp(6rem, 20vw, 22rem)',
            fontWeight: '900',
            color: 'transparent',
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1.5px, transparent 1.5px)',
            backgroundSize: '5px 5px',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            opacity: 0.15,
          }}>
            AOI V3
          </div>
          <div className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-3 gap-6 sm:gap-8 mb-12">
              <div>
                <h3 className="text-sm font-semibold text-white mb-4">Product</h3>
                <ul className="space-y-3 text-sm">
                  <li><a href="#modules" className="text-white hover:text-primary transition">Modules</a></li>
                  <li><a href="#features" className="text-white hover:text-primary transition">Features</a></li>
                  <li><a href="#pricing" className="text-white hover:text-primary transition">Pricing</a></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-4">Docs</h3>
                <ul className="space-y-3 text-sm">
                  <li><a href="#docs" className="text-white hover:text-primary transition">Documentation</a></li>
                  <li><a href="#guides" className="text-white hover:text-primary transition">Guides</a></li>
                  <li><a href="#api" className="text-white hover:text-primary transition">API Reference</a></li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white mb-4">Legal</h3>
                <ul className="space-y-3 text-sm">
                  <li><a href="#privacy" className="text-white hover:text-primary transition">Privacy</a></li>
                  <li><a href="#terms" className="text-white hover:text-primary transition">Terms</a></li>
                  <li><a href="#contact" className="text-white hover:text-primary transition">Contact</a></li>
                </ul>
              </div>
            </div>
            <p className="text-sm text-white">
              © 2026 AOI. All rights reserved. Made by Akira
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}