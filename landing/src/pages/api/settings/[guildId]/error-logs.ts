import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendApiUrl } from "@/lib/backend";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const guildId = req.query.guildId;

  if (!guildId || typeof guildId !== "string") {
    res.status(400).json({ error: "invalid_guild_id" });
    return;
  }

  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const backendResponse = await fetch(`${getBackendApiUrl()}/api/settings/${guildId}/error-logs`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.cookie || "",
      },
      body: JSON.stringify(req.body || {}),
    });

    const payload = await backendResponse.json().catch(() => ({ ok: backendResponse.ok }));
    res.status(backendResponse.status).json(payload);
  } catch {
    res.status(500).json({ error: "backend_settings_unreachable" });
  }
}
