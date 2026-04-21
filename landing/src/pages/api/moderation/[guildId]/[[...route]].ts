import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendApiUrl } from "@/lib/backend";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { guildId, route = [] } = req.query;

  if (!guildId || typeof guildId !== "string") {
    res.status(400).json({ error: "invalid_guild_id" });
    return;
  }

  const routeParts = Array.isArray(route) ? route : [route];
  const filteredRouteParts = routeParts.filter((part): part is string => typeof part === "string" && part.length > 0);
  const moderationPath = filteredRouteParts.length > 0 ? `/${filteredRouteParts.join("/")}` : "";

  const query = new URLSearchParams();
  Object.entries(req.query).forEach(([key, value]) => {
    if (key === "guildId" || key === "route") return;

    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
      return;
    }

    if (typeof value === "string") {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  const targetUrl = `${getBackendApiUrl()}/api/moderation/${guildId}${moderationPath}${queryString ? `?${queryString}` : ""}`;

  try {
    const backendResponse = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.cookie || "",
      },
      body: req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body || {}),
    });

    const payload = await backendResponse.text();
    res.status(backendResponse.status);

    try {
      res.json(payload ? JSON.parse(payload) : { ok: backendResponse.ok });
    } catch {
      res.send(payload);
    }
  } catch {
    res.status(500).json({ error: "backend_moderation_unreachable" });
  }
}
