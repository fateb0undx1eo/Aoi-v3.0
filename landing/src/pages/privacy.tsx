import Link from "next/link";
import { SiteNavbar } from "@/components/site-navbar";

export default function PrivacyPage() {
  return (
    <div className="public-page min-h-screen text-foreground">
      <SiteNavbar showAnchors={false} />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <p className="subtext text-xs uppercase tracking-[0.24em] text-muted-foreground">Legal</p>
        <h1 className="subpage-heading mt-4 text-5xl sm:text-6xl lg:text-7xl leading-[1.05]">Privacy Policy</h1>

        <section className="mt-12 space-y-8 text-sm leading-7 text-foreground/85">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Information We Collect</h2>
            <p>We collect only the data necessary for AOI to function: server IDs, channel IDs, user IDs, and configuration settings you provide. We do not collect messages, personal conversations, or any sensitive personal information.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. How We Use Your Data</h2>
            <p>Your data is used solely to operate and improve the Bot. This includes storing module configurations, moderation logs, and user preferences. Data is never sold, shared, or used for advertising.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Data Retention</h2>
            <p>We retain your data as long as the Bot is in your server. Upon removal, data is deleted within 30 days. You may request earlier deletion by contacting us.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Third-Party Access</h2>
            <p>We do not share your data with third parties. The Bot operates on Discord's platform and complies with Discord's Developer Terms of Service.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Security</h2>
            <p>We implement reasonable security measures to protect your data. However, no online service is completely secure, and we cannot guarantee absolute protection.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Changes to This Policy</h2>
            <p>We may update this policy from time to time. Changes will be posted here. Continued use after changes constitutes acceptance of the updated policy.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Contact</h2>
            <p>For privacy-related inquiries, visit our Contact page or reach out via our support server.</p>
          </div>
        </section>

        <div className="mt-12">
          <Link href="/" className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-foreground/70 hover:text-foreground transition-colors">
            &larr; Back to Landing
          </Link>
        </div>
      </main>
    </div>
  );
}
