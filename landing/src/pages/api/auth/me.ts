import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendApiUrl } from "@/lib/backend";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const backendResponse = await fetch(`${getBackendApiUrl()}/api/auth/me`, {
      headers: {
        cookie: req.headers.cookie || "",
      },
    });

    const payload = await backendResponse.json().catch(() => ({ error: "backend_auth_failed" }));
    res.status(backendResponse.status).json(payload);
  } catch {
    res.status(500).json({ error: "backend_auth_unreachable" });
  }
}
