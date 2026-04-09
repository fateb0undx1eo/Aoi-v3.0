import Link from "next/link";
import { motion } from "motion/react";
import { SiteNavbar } from "@/components/site-navbar";

const commandGroups = [
  {
    category: "Moderation Commands",
    commands: ["/warn", "/mute", "/ban", "/slowmode", "/purge"],
  },
  {
    category: "Utility Commands",
    commands: ["/remind", "/poll", "/embed", "/announce", "/sticky"],
  },
  {
    category: "Ticket Commands",
    commands: ["/ticket create", "/ticket assign", "/ticket priority", "/ticket close"],
  },
  {
    category: "Automation Commands",
    commands: ["/autorole", "/autoresponse", "/welcome setup", "/module toggle"],
  },
];

export default function CommandsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNavbar showAnchors={false} />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p className="subtext text-sm uppercase tracking-[0.24em] text-muted-foreground">Command Center</p>
          <h1 className="subpage-heading mt-4 text-4xl sm:text-5xl">Command map for your whole staff team.</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-foreground/85">
            Slash commands grouped by use case so onboarding new moderators and helpers is straightforward.
          </p>
        </motion.section>

        <section className="mt-12 space-y-4">
          {commandGroups.map((group, index) => (
            <motion.article
              key={group.category}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.25 }}
              transition={{ duration: 0.45, delay: index * 0.05 }}
              className="rounded-2xl border border-white/15 bg-white/[0.04] p-5 backdrop-blur-xl"
            >
              <h2 className="card-heading text-2xl">{group.category}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.commands.map((command) => (
                  <span key={command} className="rounded-xl border border-white/15 bg-black/25 px-3 py-1 text-sm text-primary">
                    {command}
                  </span>
                ))}
              </div>
            </motion.article>
          ))}
        </section>

        <div className="mt-12">
          <Link href="/" className="inline-flex items-center rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold">
            Back to Landing
          </Link>
        </div>
      </main>
    </div>
  );
}
