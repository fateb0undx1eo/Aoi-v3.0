import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendApiUrl } from "@/lib/backend";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const backendResponse = await fetch(`${getBackendApiUrl()}/api/auth/guilds`, {
      headers: {
        cookie: req.headers.cookie || "",
      },
    });

    const payload = await backendResponse.json().catch(() => ({ error: "failed_to_fetch_guilds" }));
    res.status(backendResponse.status).json(payload);
  } catch {
    res.status(500).json({ error: "backend_auth_unreachable" });
  }
}
