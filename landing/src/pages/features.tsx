import Link from "next/link";
import { motion } from "framer-motion";
import { Boxes, ShieldCheck, Sparkles, Ticket, Wand2, Zap } from "lucide-react";
import { SiteNavbar } from "@/components/site-navbar";

const accentColors = ['#06b6d4', '#f59e0b', '#a78bfa', '#10b981', '#ef4444', '#06b6d4'];

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
    <div className="public-page min-h-screen text-foreground">
      <SiteNavbar showAnchors={false} />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p className="subtext text-xs uppercase tracking-[0.24em] text-muted-foreground">Features</p>
          <h1 className="subpage-heading mt-4 text-5xl sm:text-6xl lg:text-7xl leading-[1.05]">Everything AOI can do.</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-foreground/85">
            Organized by real team workflows so you can enable only what your community needs.
          </p>
        </motion.section>

        <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group, index) => {
            const Icon = group.icon;
            const color = accentColors[index % accentColors.length];

            return (
              <motion.article
                key={group.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
                className="rounded-xl p-5 flex flex-col"
                style={{ backgroundColor: '#000000' }}
              >
                <div className="inline-flex rounded-lg p-2.5 flex-shrink-0 self-start" style={{ backgroundColor: color + '20' }}>
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <h2 className="card-heading text-[1.18rem] leading-tight mt-4" style={{ color }}>{group.title}</h2>
                <ul className="mt-4 space-y-2 text-sm flex-grow" style={{ color: '#8a8a8a' }}>
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.article>
            );
          })}
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
