import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendApiUrl } from "@/lib/backend";

function toWebSocketUrl(httpUrl: string) {
  const parsed = new URL(httpUrl);
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = "/ws/dashboard-overview";
  parsed.search = "";
  return parsed.toString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const { guildId } = req.query;
  if (!guildId || typeof guildId !== "string") {
    res.status(400).json({ error: "missing_guild_id" });
    return;
  }

  const backendUrl = getBackendApiUrl();

  try {
    const backendResponse = await fetch(`${backendUrl}/api/dashboard/guild/${guildId}/socket-ticket`, {
      method: "POST",
      headers: {
        cookie: req.headers.cookie || "",
      },
    });

    const payload = await backendResponse.json().catch(() => ({ error: "failed_to_create_socket_ticket" }));
    if (!backendResponse.ok) {
      res.status(backendResponse.status).json(payload);
      return;
    }

    res.status(200).json({
      ...payload,
      wsUrl: toWebSocketUrl(backendUrl),
    });
  } catch {
    res.status(500).json({ error: "backend_socket_ticket_unreachable" });
  }
}
