import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Shield, Zap, Trophy } from "lucide-react";
import { SiteNavbar } from "@/components/site-navbar";

const accentColor = '#06b6d4';

const tiers = [
  {
    name: "Free",
    price: "$0",
    description: "Core moderation and utility for small communities.",
    features: ["Up to 3 servers", "Basic moderation commands", "Utility commands", "Standard support"],
    icon: Shield,
    color: '#8a8a8a',
  },
  {
    name: "Pro",
    price: "$9/mo",
    description: "Advanced tools for growing servers that need more control.",
    features: ["Up to 15 servers", "Priority ticket queues", "Workflow automation", "Custom presets", "Dashboard analytics"],
    icon: Zap,
    color: accentColor,
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$29/mo",
    description: "Full automation and dedicated infrastructure for large communities.",
    features: ["Unlimited servers", "Dedicated support channel", "Custom integrations", "SLA guarantee", "Early feature access", "White-label options"],
    icon: Trophy,
    color: '#a78bfa',
  },
];

const comparisons = [
  { feature: "Servers", free: "3", pro: "15", enterprise: "Unlimited" },
  { feature: "Moderation commands", free: "yes", pro: "yes", enterprise: "yes" },
  { feature: "Utility commands", free: "yes", pro: "yes", enterprise: "yes" },
  { feature: "Ticket system", free: null, pro: "yes", enterprise: "yes" },
  { feature: "Workflow automation", free: null, pro: "yes", enterprise: "yes" },
  { feature: "Dashboard analytics", free: null, pro: "yes", enterprise: "yes" },
  { feature: "Custom presets", free: null, pro: "yes", enterprise: "yes" },
  { feature: "Dedicated support", free: null, pro: null, enterprise: "yes" },
  { feature: "Custom integrations", free: null, pro: null, enterprise: "yes" },
  { feature: "SLA guarantee", free: null, pro: null, enterprise: "yes" },
];

export default function PremiumPage() {
  return (
    <div className="public-page min-h-screen text-foreground">
      <SiteNavbar showAnchors={false} />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p className="subtext text-xs uppercase tracking-[0.24em] text-muted-foreground">Pricing</p>
          <h1 className="subpage-heading mt-4 text-5xl sm:text-6xl lg:text-7xl leading-[1.05]">Choose your plan.</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-foreground/85">
            Scale from a single community server to a full multi-server operation without switching bots.
          </p>
        </motion.section>

        <section className="mt-12 grid gap-6 sm:grid-cols-3">
          {tiers.map((tier, index) => {
            const Icon = tier.icon;
            return (
              <motion.article
                key={tier.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                className="relative rounded-xl p-6 flex flex-col"
                style={{ backgroundColor: '#000000' }}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-semibold text-white" style={{ backgroundColor: accentColor }}>
                    Most Popular
                  </div>
                )}
                <div className="inline-flex rounded-lg p-2.5 flex-shrink-0 self-start" style={{ backgroundColor: tier.color + '20' }}>
                  <Icon className="h-5 w-5" style={{ color: tier.color }} />
                </div>
                <h2 className="card-heading text-[1.18rem] leading-tight mt-4" style={{ color: tier.color }}>{tier.name}</h2>
                <div className="mt-2 text-3xl font-bold text-white">{tier.price}</div>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: '#8a8a8a' }}>{tier.description}</p>
                <ul className="mt-6 space-y-3 text-sm flex-grow" style={{ color: '#8a8a8a' }}>
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: tier.color }} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.article>
            );
          })}
        </section>

        <section className="mt-16">
          <h2 className="subpage-heading text-4xl sm:text-5xl leading-[1.05]">Full comparison</h2>
          <div className="mt-6 overflow-x-auto rounded-xl" style={{ backgroundColor: '#000000' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  <th className="p-4 text-left font-semibold text-white">Feature</th>
                  <th className="p-4 text-center font-semibold" style={{ color: '#8a8a8a' }}>Free</th>
                  <th className="p-4 text-center font-semibold" style={{ color: accentColor }}>Pro</th>
                  <th className="p-4 text-center font-semibold" style={{ color: '#a78bfa' }}>Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row) => (
                  <tr key={row.feature} className="border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <td className="p-4" style={{ color: '#8a8a8a' }}>{row.feature}</td>
                    <td className="p-4 text-center" style={{ color: '#8a8a8a' }}>{row.free || <span style={{ color: 'rgba(255,255,255,0.2)' }}>&mdash;</span>}</td>
                    <td className="p-4 text-center" style={{ color: '#8a8a8a' }}>{row.pro || <span style={{ color: 'rgba(255,255,255,0.2)' }}>&mdash;</span>}</td>
                    <td className="p-4 text-center" style={{ color: '#8a8a8a' }}>{row.enterprise || <span style={{ color: 'rgba(255,255,255,0.2)' }}>&mdash;</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
