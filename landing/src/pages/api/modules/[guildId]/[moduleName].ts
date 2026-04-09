import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendApiUrl } from "@/lib/backend";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { guildId, moduleName } = req.query;

  if (!guildId || typeof guildId !== "string" || !moduleName || typeof moduleName !== "string") {
    res.status(400).json({ error: "invalid_module_request" });
    return;
  }

  try {
    const backendResponse = await fetch(`${getBackendApiUrl()}/api/modules/${guildId}/${moduleName}`, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.cookie || "",
      },
      body: req.method === "PUT" ? JSON.stringify(req.body || {}) : undefined,
    });

    const payload = await backendResponse.text();
    res.status(backendResponse.status);

    try {
      res.json(payload ? JSON.parse(payload) : { ok: backendResponse.ok });
    } catch {
      res.send(payload);
    }
  } catch {
    res.status(500).json({ error: "backend_module_unreachable" });
  }
}
