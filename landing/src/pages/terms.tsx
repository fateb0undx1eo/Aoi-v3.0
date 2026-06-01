import Link from "next/link";
import { SiteNavbar } from "@/components/site-navbar";

export default function TermsPage() {
  return (
    <div className="public-page min-h-screen text-foreground">
      <SiteNavbar showAnchors={false} />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <p className="subtext text-xs uppercase tracking-[0.24em] text-muted-foreground">Legal</p>
        <h1 className="subpage-heading mt-4 text-5xl sm:text-6xl lg:text-7xl leading-[1.05]">Terms & Conditions</h1>

        <section className="mt-12 space-y-8 text-sm leading-7 text-foreground/85">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using AOI ("the Bot"), you agree to be bound by these Terms & Conditions. If you do not agree, do not use the Bot.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Service Description</h2>
            <p>AOI is a Discord bot that provides moderation, utility, automation, and community engagement features. The Bot is provided "as is" without any warranties, express or implied.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. User Responsibilities</h2>
            <p>You agree to use the Bot in compliance with Discord's Terms of Service and all applicable laws. You must not misuse the Bot for spam, harassment, or any illegal activity.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Data & Privacy</h2>
            <p>We collect and store minimal data necessary for the Bot to function, including server IDs, user IDs, and configuration settings. We do not sell your data. See our Privacy Policy for details.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Limitation of Liability</h2>
            <p>We are not liable for any damages arising from the use or inability to use the Bot. The Bot's availability is not guaranteed, and we reserve the right to modify or discontinue the service at any time.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use of the Bot after changes constitutes acceptance of the new terms.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Contact</h2>
            <p>For questions about these terms, reach out via our support server or the Contact section on the homepage.</p>
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
