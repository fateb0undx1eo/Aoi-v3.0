import type { APIEmbed, APITopLevelComponent, QueryDataMessageData } from "../types";

export const DISCORD_API = "https://discord.com/api";
export const DISCORD_API_V = "10";
export const WEBHOOK_URL_RE = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/(\d+)\/([\w-]+)\/?$/;

/**
 * Build Discord API payload from message data, filtering empty embeds
 * and normalizing component data.
 */
export function buildDiscordPayload(data: QueryDataMessageData) {
  const payload: Record<string, any> = {};

  if (data.content) payload.content = data.content;
  if (data.flags) payload.flags = data.flags;
  if (data.thread_name) payload.thread_name = data.thread_name;
  if (data.allowed_mentions) payload.allowed_mentions = data.allowed_mentions;
  if (data.username) payload.username = data.username;
  if (data.avatar_url) payload.avatar_url = data.avatar_url;

  const embeds = (data.embeds ?? []).filter(
    (e) => e.title || e.description || (e.fields && e.fields.length > 0) || e.image?.url || e.thumbnail?.url || e.footer?.text || e.author?.name,
  );
  if (embeds.length > 0) payload.embeds = embeds;

  if (data.components && data.components.length > 0) {
    payload.components = cleanComponents(data.components);
  }

  return payload;
}

/**
 * Strip internal _flows, custom_id from link/premium buttons, etc.
 */
function cleanComponents(components: APITopLevelComponent[]): any[] {
  return components.map((row) => {
    if (row.type === 1) {
      return {
        type: 1,
        components: row.components.map((comp: any) => {
          const { _flows, ...clean } = comp;
          if (clean.style === 5) delete clean.custom_id;
          if (clean.style === 6) delete clean.custom_id;
          return clean;
        }),
      };
    }
    if (row.type === 17) {
      const children = (row as any).components?.map((child: any) => {
        const { _flows, ...clean } = child;
        return clean;
      }) ?? [];
      return { ...row, components: children };
    }
    return row;
  });
}

function hasV2Components(payload: Record<string, any>): boolean {
  const comps = payload.components as any[] | undefined;
  if (!comps) return false;
  return comps.some((c: any) => c.type === 17 || c.type === 9 || c.type === 10 || c.type === 11 || c.type === 12 || c.type === 13 || c.type === 14);
}

/**
 * Execute a Discord webhook (POST new message).
 */
export async function executeWebhook(
  id: string,
  token: string,
  payload: Record<string, any>,
  files?: File[],
  threadId?: string,
): Promise<Response> {
  const url = new URL(`${DISCORD_API}/v${DISCORD_API_V}/webhooks/${id}/${token}`);
  url.searchParams.set("wait", "true");
  if (threadId) url.searchParams.set("thread_id", threadId);
  if (hasV2Components(payload)) url.searchParams.set("with_components", "true");

  if (files && files.length > 0) {
    const formData = new FormData();
    formData.append("payload_json", JSON.stringify(payload));
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f) formData.append(`files[${i}]`, f);
    }
    return fetch(url.toString(), { method: "POST", body: formData });
  }

  return fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Edit an existing webhook message (PATCH).
 */
export async function updateWebhookMessage(
  id: string,
  token: string,
  messageId: string,
  payload: Record<string, any>,
  files?: File[],
  threadId?: string,
): Promise<Response> {
  const url = new URL(
    `${DISCORD_API}/v${DISCORD_API_V}/webhooks/${id}/${token}/messages/${messageId}`,
  );
  if (threadId) url.searchParams.set("thread_id", threadId);
  if (hasV2Components(payload)) url.searchParams.set("with_components", "true");

  if (files && files.length > 0) {
    const formData = new FormData();
    formData.append("payload_json", JSON.stringify(payload));
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f) formData.append(`files[${i}]`, f);
    }
    return fetch(url.toString(), { method: "PATCH", body: formData });
  }

  return fetch(url.toString(), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch webhook info to validate.
 */
export async function getWebhook(id: string, token: string): Promise<Record<string, any>> {
  const res = await fetch(
    `${DISCORD_API}/v${DISCORD_API_V}/webhooks/${id}/${token}`,
  );
  return res.json();
}

/**
 * Fetch an existing webhook message.
 */
export async function getWebhookMessage(
  id: string,
  token: string,
  messageId: string,
  threadId?: string,
): Promise<Record<string, any>> {
  const url = new URL(
    `${DISCORD_API}/v${DISCORD_API_V}/webhooks/${id}/${token}/messages/${messageId}`,
  );
  if (threadId) url.searchParams.set("thread_id", threadId);
  const res = await fetch(url.toString());
  return res.json();
}

/**
 * Check if message uses components v2 (container-based layout).
 */
export function isComponentsV2(flags?: number): boolean {
  return !!(flags && (flags & (1 << 15)));
}

/**
 * Extract interactive components (buttons, selects) from a component list.
 */
export function extractInteractiveComponents(
  components: any[],
): any[] {
  const result: any[] = [];
  for (const row of components) {
    if (row.type === 1 && Array.isArray(row.components)) {
      for (const comp of row.components) {
        if (comp.type === 2 || comp.type === 3 || comp.type === 5 ||
            comp.type === 6 || comp.type === 7 || comp.type === 8) {
          result.push(comp);
        }
      }
    }
    if (row.type === 17 && Array.isArray(row.components)) {
      for (const child of row.components) {
        if (child.type === 9 && child.accessory) {
          result.push(child.accessory);
        }
      }
    }
  }
  return result;
}

/**
 * Extract message ID from a Discord message link.
 */
export function parseMessageLink(link: string): {
  guildId?: string;
  channelId?: string;
  messageId?: string;
} {
  const pattern =
    /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/channels\/(\d+|@me)\/(\d+)\/(\d+)$/;
  const match = link.match(pattern);
  if (!match) return {};
  return {
    guildId: match[1] === "@me" ? undefined : match[1],
    channelId: match[2],
    messageId: match[3],
  };
}
