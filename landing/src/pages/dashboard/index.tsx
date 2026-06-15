import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

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
    <div className="dashboard-canvas min-h-screen px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-sm sm:max-w-2xl">
        <div className="dashboard-panel overflow-hidden rounded-2xl p-5 text-center text-white sm:rounded-[32px] sm:p-8" style={{ backgroundColor: "#000" }}>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 sm:text-xs sm:tracking-[0.28em]">Discord Bot Dashboard</p>
          <h1 className="mt-3 text-lg font-bold leading-snug text-white sm:text-3xl">Manage your servers from one control center.</h1>

          {errorMessage && (
            <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          <div className="mt-6 sm:mt-8">
            {!checking && (
              <Link
                href="/api/auth/discord"
              >
                LOGIN
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
