import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendApiUrl } from "@/lib/backend";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const guildId = req.query.guildId;

  if (!guildId || typeof guildId !== "string") {
    res.status(400).json({ error: "invalid_guild_id" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const backendResponse = await fetch(`${getBackendApiUrl()}/api/guilds/${guildId}/dm-broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.cookie || "",
      },
      body: JSON.stringify(req.body || {}),
    });

    const payload = await backendResponse.text();
    res.status(backendResponse.status);

    try {
      res.json(payload ? JSON.parse(payload) : { ok: backendResponse.ok });
    } catch {
      res.send(payload);
    }
  } catch {
    res.status(500).json({ error: "backend_dm_broadcast_unreachable" });
  }
}
