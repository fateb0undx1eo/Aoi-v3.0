import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendApiUrl } from "@/lib/backend";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const guildId = req.query.guildId;

  if (!guildId || typeof guildId !== "string") {
    res.status(400).json({ error: "invalid_guild_id" });
    return;
  }

  try {
    const backendResponse = await fetch(`${getBackendApiUrl()}/api/guilds/${guildId}/emojis`, {
      headers: {
        cookie: req.headers.cookie || "",
      },
    });

    const payload = await backendResponse.json().catch(() => ({ error: "failed_to_fetch_emojis" }));
    res.status(backendResponse.status).json(payload);
  } catch {
    res.status(500).json({ error: "backend_emojis_unreachable" });
  }
}
