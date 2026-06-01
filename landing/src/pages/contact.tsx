import Link from "next/link";
import { SiteNavbar } from "@/components/site-navbar";

export default function ContactPage() {
  return (
    <div className="public-page min-h-screen text-foreground">
      <SiteNavbar showAnchors={false} />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <p className="subtext text-xs uppercase tracking-[0.24em] text-muted-foreground">Support</p>
        <h1 className="subpage-heading mt-4 text-5xl sm:text-6xl lg:text-7xl leading-[1.05]">Contact Us</h1>

        <section className="mt-12 space-y-8 text-sm leading-7 text-foreground/85">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Get in Touch</h2>
            <p>Have a question, need support, or want to report an issue? We're here to help. The best way to reach us is through our Discord support server.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Discord Support</h2>
            <p>Join our official Discord server for real-time support, feature requests, and community discussions. Our team and community members are active and ready to help.</p>
            <a
              href="https://discord.gg/aoi"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4752C4] transition-colors"
            >
              Join Discord
            </a>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Report a Bug</h2>
            <p>Found something not working right? Let us know through our support server or open an issue on our GitHub repository. We appreciate detailed reports that help us improve.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Feature Requests</h2>
            <p>We're always looking for ideas to make AOI better. Share your suggestions in our Discord server's feature request channel.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Business Inquiries</h2>
            <p>For partnership or business-related inquiries, please reach out through our Discord server and open a ticket.</p>
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
