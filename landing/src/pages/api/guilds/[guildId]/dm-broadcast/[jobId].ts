import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendApiUrl } from "@/lib/backend";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const guildId = req.query.guildId;
  const jobId = req.query.jobId;

  if (!guildId || typeof guildId !== "string" || !jobId || typeof jobId !== "string") {
    res.status(400).json({ error: "invalid_dm_broadcast_job" });
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const backendResponse = await fetch(`${getBackendApiUrl()}/api/guilds/${guildId}/dm-broadcast/${jobId}`, {
      method: "GET",
      headers: {
        cookie: req.headers.cookie || "",
      },
    });

    const payload = await backendResponse.text();
    res.status(backendResponse.status);

    try {
      res.json(payload ? JSON.parse(payload) : { ok: backendResponse.ok });
    } catch {
      res.send(payload);
    }
  } catch {
    res.status(500).json({ error: "backend_dm_broadcast_status_unreachable" });
  }
}
