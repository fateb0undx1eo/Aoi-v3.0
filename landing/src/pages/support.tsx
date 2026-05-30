import Link from "next/link";
import { motion } from "framer-motion";
import { MessageCircle, Mail, BookOpen, ChevronRight } from "lucide-react";
import { SiteNavbar } from "@/components/site-navbar";

const accentColor = '#06b6d4';

const faqItems = [
  { q: "How do I invite AOI to my server?", a: "Use the Dashboard button in the navbar and follow the OAuth flow. The bot will request the permissions it needs based on the modules you enable." },
  { q: "Can I use AOI on multiple servers?", a: "Yes. Free tier supports up to 3 servers. Pro and Enterprise tiers support 15 and unlimited servers respectively." },
  { q: "How do I report a bug?", a: "Open a ticket in our Discord server or use the support contact form below. Include the command you used and what you expected to happen." },
  { q: "Can I request a feature?", a: "Feature requests are tracked on our GitHub. Vote on existing requests or open a new one. Pro and Enterprise users get priority consideration." },
  { q: "How do I reset my dashboard password?", a: "Use the forgot password link on the login page. If you don't receive the reset email, check your spam folder or contact support." },
  { q: "Is my data secure?", a: "All data is encrypted in transit and at rest. We follow Discord's privacy guidelines and never share server data with third parties." },
];

const channels = [
  { icon: MessageCircle, label: "Discord Server", description: "Live chat with the team and community.", href: "https://discord.gg/aoi", color: '#5865F2' },
  { icon: Mail, label: "Email Support", description: "Response within 24 hours.", href: "mailto:support@aoibot.com", color: '#f59e0b' },
  { icon: BookOpen, label: "Documentation", description: "Self-serve guides and references.", href: "/docs", color: accentColor },
];

export default function SupportPage() {
  return (
    <div className="public-page min-h-screen text-foreground">
      <SiteNavbar showAnchors={false} />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p className="subtext text-xs uppercase tracking-[0.24em] text-muted-foreground">Support</p>
          <h1 className="subpage-heading mt-4 text-5xl sm:text-6xl lg:text-7xl leading-[1.05]">We&apos;re here when you need us.</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-foreground/85">
            Reach the team through your preferred channel or browse common questions below.
          </p>
        </motion.section>

        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {channels.map((channel, index) => {
            const Icon = channel.icon;
            return (
              <motion.a
                key={channel.label}
                href={channel.href}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                className="group flex items-start gap-4 rounded-xl p-5 transition-colors hover:bg-white/5"
                style={{ backgroundColor: '#000000' }}
              >
                <div className="inline-flex rounded-lg p-2.5 flex-shrink-0" style={{ backgroundColor: channel.color + '20' }}>
                  <Icon className="h-5 w-5" style={{ color: channel.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="card-heading text-[1.18rem] leading-tight" style={{ color: channel.color }}>{channel.label}</h2>
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: '#8a8a8a' }}>{channel.description}</p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: '#8a8a8a' }} />
              </motion.a>
            );
          })}
        </section>

        <section className="mt-16">
          <h2 className="subpage-heading text-4xl sm:text-5xl leading-[1.05]">Frequently asked questions</h2>
          <div className="mt-6 space-y-3">
            {faqItems.map((item, index) => (
              <motion.details
                key={item.q}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.4, delay: index * 0.04 }}
                className="group rounded-xl p-5"
                style={{ backgroundColor: '#000000' }}
              >
                <summary className="card-heading flex cursor-pointer list-none items-center justify-between text-[1.18rem] leading-tight" style={{ color: '#e0e0e0' }}>
                  {item.q}
                  <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-300 group-open:rotate-90" style={{ color: '#8a8a8a' }} />
                </summary>
                <p className="mt-3 text-sm leading-7" style={{ color: '#8a8a8a' }}>{item.a}</p>
              </motion.details>
            ))}
          </div>
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
