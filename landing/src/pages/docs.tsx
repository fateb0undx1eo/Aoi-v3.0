import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Command, Settings, HelpCircle, Code, Shield } from "lucide-react";
import { SiteNavbar } from "@/components/site-navbar";

const accentColor = '#06b6d4';

const docSections = [
  {
    title: "Getting Started",
    icon: BookOpen,
    color: accentColor,
    items: [
      { label: "Invite the bot", href: "#" },
      { label: "Dashboard overview", href: "#" },
      { label: "First command setup", href: "#" },
      { label: "Module management", href: "#" },
    ],
  },
  {
    title: "Commands",
    icon: Command,
    color: '#f59e0b',
    items: [
      { label: "Moderation commands", href: "#" },
      { label: "Utility commands", href: "#" },
      { label: "Ticket commands", href: "#" },
      { label: "Automation commands", href: "#" },
    ],
  },
  {
    title: "Configuration",
    icon: Settings,
    color: '#a78bfa',
    items: [
      { label: "Server settings", href: "#" },
      { label: "Permission system", href: "#" },
      { label: "Custom presets", href: "#" },
      { label: "Webhook integration", href: "#" },
    ],
  },
  {
    title: "API Reference",
    icon: Code,
    color: '#10b981',
    items: [
      { label: "REST endpoints", href: "#" },
      { label: "WebSocket events", href: "#" },
      { label: "Rate limits", href: "#" },
      { label: "SDK & libraries", href: "#" },
    ],
  },
  {
    title: "Security",
    icon: Shield,
    color: '#ef4444',
    items: [
      { label: "Data handling", href: "#" },
      { label: "Permission scopes", href: "#" },
      { label: "Audit logs", href: "#" },
      { label: "Incident response", href: "#" },
    ],
  },
  {
    title: "FAQ",
    icon: HelpCircle,
    color: '#f59e0b',
    items: [
      { label: "Common issues", href: "#" },
      { label: "Troubleshooting", href: "#" },
      { label: "Bot permissions", href: "#" },
      { label: "Contact support", href: "#" },
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="public-page min-h-screen text-foreground">
      <SiteNavbar showAnchors={false} />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p className="subtext text-xs uppercase tracking-[0.24em] text-muted-foreground">Documentation</p>
          <h1 className="subpage-heading mt-4 text-5xl sm:text-6xl lg:text-7xl leading-[1.05]">Everything you need.</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-foreground/85">
            Browse setup guides, command references, configuration tips, and API docs in one place.
          </p>
        </motion.section>

        <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docSections.map((section, index) => {
            const Icon = section.icon;
            return (
              <motion.article
                key={section.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
                className="rounded-xl p-5 flex flex-col"
                style={{ backgroundColor: '#000000' }}
              >
                <div className="inline-flex rounded-lg p-2.5 flex-shrink-0 self-start" style={{ backgroundColor: section.color + '20' }}>
                  <Icon className="h-5 w-5" style={{ color: section.color }} />
                </div>
                <h2 className="card-heading text-[1.18rem] leading-tight mt-4" style={{ color: section.color }}>{section.title}</h2>
                <ul className="mt-4 space-y-1 text-sm flex-grow">
                  {section.items.map((item) => (
                    <li key={item.label}>
                      <Link href={item.href} className="block rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5" style={{ color: '#8a8a8a' }}>
                        {item.label}
                      </Link>
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
