import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendApiUrl, getFrontendAppUrl } from "@/lib/backend";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const protocol = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = req.headers.host;
  const redirectUri =
    process.env.DISCORD_REDIRECT_URI ||
    `${getFrontendAppUrl(host ? `${protocol}://${host}` : undefined)}/api/auth/callback`;
  const state = Math.random().toString(36).slice(2);
  const backendUrl = getBackendApiUrl();

  res.setHeader(
    "Set-Cookie",
    `discord_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );

  res.redirect(
    `${backendUrl}/api/auth/discord?state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`
  );
}
