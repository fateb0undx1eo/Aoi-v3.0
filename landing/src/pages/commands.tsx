import Link from "next/link";
import { motion } from "framer-motion";
import { SiteNavbar } from "@/components/site-navbar";

const accentColors = ['#06b6d4', '#f59e0b', '#a78bfa', '#10b981'];

const commandGroups = [
  {
    category: "Moderation Commands",
    color: accentColors[0],
    commands: ["/warn", "/mute", "/ban", "/slowmode", "/purge"],
  },
  {
    category: "Utility Commands",
    color: accentColors[1],
    commands: ["/remind", "/poll", "/embed", "/announce", "/sticky"],
  },
  {
    category: "Ticket Commands",
    color: accentColors[2],
    commands: ["/ticket create", "/ticket assign", "/ticket priority", "/ticket close"],
  },
  {
    category: "Automation Commands",
    color: accentColors[3],
    commands: ["/autorole", "/autoresponse", "/welcome setup", "/module toggle"],
  },
];

export default function CommandsPage() {
  return (
    <div className="public-page min-h-screen text-foreground">
      <SiteNavbar showAnchors={false} />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p className="subtext text-xs uppercase tracking-[0.24em] text-muted-foreground">Commands</p>
          <h1 className="subpage-heading mt-4 text-5xl sm:text-6xl lg:text-7xl leading-[1.05]">Command map for your team.</h1>
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
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45, delay: index * 0.05 }}
              className="rounded-xl p-5"
              style={{ backgroundColor: '#000000' }}
            >
              <h2 className="card-heading text-[1.18rem] leading-tight" style={{ color: group.color }}>{group.category}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.commands.map((command) => (
                  <span
                    key={command}
                    className="rounded-lg px-3 py-1 text-sm"
                    style={{ backgroundColor: group.color + '15', color: group.color }}
                  >
                    {command}
                  </span>
                ))}
              </div>
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
