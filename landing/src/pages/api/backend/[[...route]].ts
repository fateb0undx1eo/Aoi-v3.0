import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendApiUrl } from "@/lib/backend";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { route, ...queryParams } = req.query;
  const path = Array.isArray(route) ? route.join("/") : route || "";

  const query = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
    } else if (typeof value === "string") {
      query.set(key, value);
    }
  });
  const queryString = query.toString();

  const backendUrl = getBackendApiUrl();
  const url = `${backendUrl}/api/${path}${queryString ? `?${queryString}` : ""}`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (req.headers.cookie) {
      headers.cookie = req.headers.cookie as string;
    }

    if (req.headers.authorization) {
      headers.authorization = req.headers.authorization as string;
    }

    const fetchOptions: RequestInit = {
      method: req.method || "GET",
      headers,
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      fetchOptions.body = JSON.stringify(req.body || {});
    }

    const response = await fetch(url, fetchOptions);
    const payload = await response.text();
    res.status(response.status);

    try {
      res.json(payload ? JSON.parse(payload) : { ok: response.ok });
    } catch {
      res.send(payload);
    }
  } catch (error) {
    console.error(`Backend proxy error: ${url}`, error);
    res.status(502).json({ error: "Backend unavailable" });
  }
}
