import Link from "next/link";
import { motion } from "motion/react";
import { Boxes, ShieldCheck, Sparkles, Ticket, Wand2, Zap } from "lucide-react";
import { SiteNavbar } from "@/components/site-navbar";

const groups = [
  {
    title: "Moderation",
    items: ["Anti-raid rules", "Warn/mute/ban flow", "Action history timeline", "Channel and role protection"],
    icon: ShieldCheck,
  },
  {
    title: "Utility",
    items: ["Sticky messages", "Quick embeds", "Recurring reminders", "Role request workflows"],
    icon: Boxes,
  },
  {
    title: "Support",
    items: ["Ticket creation panels", "Assignee controls", "Close/export flow", "Priority queues"],
    icon: Ticket,
  },
  {
    title: "Automation",
    items: ["Auto role logic", "Join/leave routines", "Reaction triggers", "Scheduled command runners"],
    icon: Zap,
  },
  {
    title: "Customization",
    items: ["Module toggles", "Permission-aware commands", "Server presets", "Brand color tuning"],
    icon: Wand2,
  },
  {
    title: "Reliability",
    items: ["Health stats", "Latency tracking", "Error visibility", "Multi-module consistency"],
    icon: Sparkles,
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNavbar showAnchors={false} />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p className="subtext text-sm uppercase tracking-[0.24em] text-muted-foreground">Feature Index</p>
          <h1 className="subpage-heading mt-4 text-4xl sm:text-5xl">Everything the multipurpose bot can do.</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-foreground/85">
            Organized by real team workflows so you can enable only what your community needs.
          </p>
        </motion.section>

        <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group, index) => {
            const Icon = group.icon;

            return (
              <motion.article
                key={group.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.25 }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
                className="rounded-2xl border border-white/15 bg-white/[0.04] p-5 backdrop-blur-xl"
              >
                <div className="mb-5 inline-flex rounded-xl border border-white/15 bg-black/25 p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <h2 className="card-heading text-2xl">{group.title}</h2>
                <ul className="mt-4 space-y-3 text-sm text-foreground/86">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.article>
            );
          })}
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
