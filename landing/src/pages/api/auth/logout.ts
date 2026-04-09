import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendApiUrl } from "@/lib/backend";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const response = await fetch(`${getBackendApiUrl()}/api/auth/logout`, {
      method: "POST",
      headers: {
        cookie: req.headers.cookie || "",
      },
    });

    const logoutCookie = response.headers.get("set-cookie");
    res.setHeader("Set-Cookie", [logoutCookie, "discord_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"].filter(Boolean));
  } catch {
    res.setHeader("Set-Cookie", "discord_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  }

  res.redirect("/");
}
