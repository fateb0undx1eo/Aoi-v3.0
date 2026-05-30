import Link from "next/link";
import { motion } from "framer-motion";
import { SiteNavbar } from "@/components/site-navbar";

const accentColor = '#06b6d4';

const logs = [
  {
    version: "v3.8.0",
    date: "April 2026",
    notes: [
      "Improved ticket panel performance for larger servers.",
      "Added workflow presets for role onboarding automation.",
      "Refined logging clarity for role and nickname updates.",
    ],
  },
  {
    version: "v3.7.2",
    date: "March 2026",
    notes: [
      "Updated moderation guard rules and reduced false positives.",
      "Enhanced slash command latency for multi-module servers.",
      "Added richer event metadata in action history feed.",
    ],
  },
  {
    version: "v3.7.0",
    date: "February 2026",
    notes: [
      "Introduced module-level feature toggles in dashboard.",
      "Improved automation sequence handling for reminder jobs.",
      "Expanded permission checks for staff utility commands.",
    ],
  },
];

export default function ChangelogsPage() {
  return (
    <div className="public-page min-h-screen text-foreground">
      <SiteNavbar showAnchors={false} />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p className="subtext text-xs uppercase tracking-[0.24em] text-muted-foreground">Changelog</p>
          <h1 className="subpage-heading mt-4 text-5xl sm:text-6xl lg:text-7xl leading-[1.05]">What&apos;s new.</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-foreground/85">
            Latest improvements, fixes, and features shipped to the multipurpose bot platform.
          </p>
        </motion.section>

        <section className="mt-12 space-y-4">
          {logs.map((entry, index) => (
            <motion.article
              key={entry.version}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45, delay: index * 0.05 }}
              className="rounded-xl p-6"
              style={{ backgroundColor: '#000000' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="card-heading text-3xl" style={{ color: accentColor }}>{entry.version}</h2>
                <span className="subtext text-xs uppercase tracking-[0.24em]" style={{ color: '#8a8a8a' }}>{entry.date}</span>
              </div>
              <ul className="mt-5 space-y-3 text-sm" style={{ color: '#8a8a8a' }}>
                {entry.notes.map((note) => (
                  <li key={note} className="flex items-start gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </section>

        <div className="mt-12">
          <Link href="/" className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: '#000000', color: '#8a8a8a' }}>
            Back to Landing
          </Link>
        </div>
      </main>
    </div>
  );
}
