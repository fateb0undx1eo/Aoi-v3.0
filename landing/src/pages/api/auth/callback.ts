import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendApiUrl, getFrontendAppUrl } from "@/lib/backend";
import { parseCookies } from "@/lib/cookies";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state } = req.query;
  const cookies = parseCookies(req.headers.cookie || "");
  const storedState = cookies.discord_oauth_state || "";
  const clearStateCookie = "discord_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";

  function redirectWithError(error: string) {
    res.setHeader("Set-Cookie", clearStateCookie);
    res.redirect(`/dashboard?error=${encodeURIComponent(error)}`);
  }

  if (!code || typeof code !== "string") {
    redirectWithError("no_code_provided");
    return;
  }

  if (!state || typeof state !== "string" || state !== storedState) {
    redirectWithError("invalid_oauth_state");
    return;
  }

  const protocol = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = req.headers.host;
  const redirectUri =
    process.env.DISCORD_REDIRECT_URI ||
    `${getFrontendAppUrl(host ? `${protocol}://${host}` : undefined)}/api/auth/callback`;
  const backendUrl = getBackendApiUrl();

  try {
    const callbackResponse = await fetch(
      `${backendUrl}/api/auth/callback?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`
    );

    if (!callbackResponse.ok) {
      const error = await callbackResponse.json().catch(() => ({ error: "oauth_token_exchange_failed" }));
      redirectWithError(error?.details?.error || error?.error || "oauth_token_exchange_failed");
      return;
    }

    const { sessionToken } = await callbackResponse.json();

    const sessionResponse = await fetch(`${backendUrl}/api/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionToken,
      }),
    });

    if (!sessionResponse.ok) {
      redirectWithError("session_initialization_failed");
      return;
    }

    const sessionCookie = sessionResponse.headers.get("set-cookie");
    res.setHeader(
      "Set-Cookie",
      [sessionCookie, clearStateCookie].filter(Boolean)
    );

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Auth callback error:", err);
    redirectWithError("authentication_failed");
  }
}
