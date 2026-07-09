import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { nanoid } from "nanoid";
import type { GuildChannel, GuildEmoji, QueryData } from "../types";

interface GuildData {
  guild: Record<string, any> | null;
  modules: { name: string; display_name?: string; enabled?: boolean }[];
  channels: GuildChannel[];
  serverEmojis: GuildEmoji[];
  presets: { id: string; name: string; kind: "draft" | "template"; data: QueryData }[];
}

export function useGuildData(guildId: string | string[] | undefined) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GuildData>({ guild: null, modules: [], channels: [], serverEmojis: [], presets: [] });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const gid = typeof guildId === "string" ? guildId : undefined;
    if (process.env.NODE_ENV === "development") {
      setData({
        guild: { id: gid || "dev", name: "Dev Server", icon: null, owner_id: "1", roles: [] },
        modules: [{ name: "announcements", display_name: "Announcements", enabled: true }],
        channels: [{ id: "111", name: "general", type: 0 } as GuildChannel],
        serverEmojis: [],
        presets: [],
      });
      setLoading(false);
      return;
    }
    if (!gid) return;
    (async () => {
      try {
        const [ovRes, chRes, emRes] = await Promise.all([
          fetch(`/api/backend/dashboard/guild/${gid}/overview`),
          fetch(`/api/backend/guilds/${gid}/channels`),
          fetch(`/api/backend/guilds/${gid}/emojis`),
        ]);
        if ([ovRes.status, chRes.status, emRes.status].some((s) => s === 401)) {
          router.replace("/api/auth/discord"); return;
        }
        const ov = await ovRes.json();
        const ch = await chRes.json().catch(() => ({ channels: [] }));
        const em = await emRes.json().catch(() => ({ emojis: [] }));
        const announcementsModule = (ov.modules || []).find((m: any) => m.name === "announcements");
        const savedPresets = announcementsModule?.config?.presets;
        setData({
          guild: ov.guild,
          modules: ov.modules || [],
          channels: Array.isArray(ch.channels) ? ch.channels.filter((c: GuildChannel) => c.type === 0) : [],
          serverEmojis: Array.isArray(em.emojis) ? em.emojis : [],
          presets: Array.isArray(savedPresets) ? savedPresets.map((p: any) => ({
            id:   p.id   || `preset-${nanoid()}`,
            name: String(p.name || "").slice(0, 80),
            kind: p.kind === "template" ? "template" as const : "draft" as const,
            data: p.data || { version: "d2", messages: [{ _id: nanoid(), data: {} }], targets: [] },
          })) : [],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load guild data";
        setError(msg);
        console.error("Data loading error:", err);
      } finally { setLoading(false); }
    })();
  }, [guildId, router]);

  return { ...data, loading, error, setData };
}
