import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { LayoutDashboard } from "lucide-react";
import { BoneyardCard } from "@/components/ui/boneyard-skeleton";

/**
 * Dashboard root entry. Shows welcome page and redirects authenticated users to server picker.
 */

export default function DashboardHome() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const error = typeof router.query.error === "string" ? router.query.error : "";

  const errorMessage =
    error === "invalid_client"
      ? "Discord OAuth credentials are invalid in the backend environment."
      : error === "invalid_oauth_state"
        ? "The login session expired or the OAuth state did not match. Try again."
        : error
          ? "Login failed. Check the backend auth configuration and try again."
          : "";

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/me");
        if (!active) return;

        if (response.ok) {
          router.replace("/dashboard/servers");
          return;
        }
      } catch (_error) {
        // Ignore and show login CTA.
      }

      if (active) {
        setChecking(false);
      }
    }

    checkSession();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="dashboard-canvas min-h-screen px-4 py-16 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="dashboard-panel overflow-hidden rounded-[32px] p-10 text-center sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary/12 text-primary">
            <LayoutDashboard className="h-7 w-7" />
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.28em] text-muted-foreground">Discord Bot Dashboard</p>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">Manage your servers from one premium control center.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-foreground/82 sm:text-base">
            Login with Discord, choose a guild, and move through modules without leaving the same polished workspace.
          </p>

          {errorMessage && (
            <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          <div className="mt-8">
            {checking ? (
              <div className="mx-auto max-w-xl">
                <BoneyardCard lines={2} />
              </div>
            ) : (
              <Link
                href="/api/auth/discord"
                className="theme-animate inline-flex items-center rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_24px_52px_-28px_hsl(var(--primary)/0.78)] hover:opacity-90"
              >
                Login with Discord
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
