import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendApiUrl } from "@/lib/backend";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const guildId = req.query.guildId;

  if (!guildId || typeof guildId !== "string") {
    res.status(400).json({ error: "invalid_guild_id" });
    return;
  }

  const search = typeof req.query.q === "string" ? `?q=${encodeURIComponent(req.query.q)}&limit=${encodeURIComponent(String(req.query.limit ?? 25))}` : "";

  try {
    const backendResponse = await fetch(`${getBackendApiUrl()}/api/guilds/${guildId}/members${search}`, {
      headers: {
        cookie: req.headers.cookie || "",
      },
    });

    const payload = await backendResponse.json().catch(() => ({ error: "failed_to_fetch_members" }));
    res.status(backendResponse.status).json(payload);
  } catch {
    res.status(500).json({ error: "backend_members_unreachable" });
  }
}
