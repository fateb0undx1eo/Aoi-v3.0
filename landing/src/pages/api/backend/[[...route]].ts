import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendApiUrl } from "@/lib/backend";

export const config = { api: { bodyParser: false } };

const MAX_BODY_SIZE = 200 * 1024 * 1024;

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
    const headers: Record<string, string> = {};

    if (req.headers.cookie) {
      headers.cookie = req.headers.cookie as string;
    }
    if (req.headers.authorization) {
      headers.authorization = req.headers.authorization as string;
    }
    if (req.headers["content-type"]) {
      headers["content-type"] = req.headers["content-type"] as string;
    }

    let body: BodyInit | undefined;

    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      for await (const chunk of req) {
        const buf = chunk as Buffer;
        totalSize += buf.length;
        if (totalSize > MAX_BODY_SIZE) {
          res.status(413).json({ error: "Request body too large" });
          return;
        }
        chunks.push(buf);
      }
      if (chunks.length > 0) {
        body = Buffer.concat(chunks);
      }
    }

    const response = await fetch(url, {
      method: req.method || "GET",
      headers,
      body,
    });

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
