import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendApiUrl } from "@/lib/backend";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const { guildId, ...params } = req.query;
  if (!guildId || typeof guildId !== "string") {
    res.status(400).json({ error: "missing_guild_id" });
    return;
  }

  const backendUrl = getBackendApiUrl();
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
  }

  try {
    const backendResponse = await fetch(
      `${backendUrl}/api/dashboard/guild/${guildId}/logs-history?${qs.toString()}`,
      {
        method: "GET",
        headers: {
          cookie: req.headers.cookie || "",
        },
      },
    );

    const payload = await backendResponse.json().catch(() => ({ error: "failed_to_fetch_logs" }));
    if (!backendResponse.ok) {
      res.status(backendResponse.status).json(payload);
      return;
    }

    res.status(200).json(payload);
  } catch {
    res.status(500).json({ error: "backend_logs_unreachable" });
  }
}
