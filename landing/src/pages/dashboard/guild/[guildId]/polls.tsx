import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useGuildOverview, useGuildChannels } from "@/lib/api";
import { DashboardLayout } from "@/components/dashboard-layout";
import PollStudio from "@/components/polls/PollStudio";

export default function GuildPollsPage() {
  const router = useRouter();
  const { guildId } = router.query;
  const gid = typeof guildId === "string" ? guildId : undefined;

  const isDev = useMemo(() => process.env.NODE_ENV === "development", []);

  const [devReady, setDevReady] = useState(!isDev);
  const [devGuild, setDevGuild] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (!isDev) return;
    setDevGuild({ id: gid || "dev", name: "Dev Server", icon: null, owner_id: "1" });
    const timer = setTimeout(() => setDevReady(true), 50);
    return () => clearTimeout(timer);
  }, [isDev, gid]);

  const { data: overviewData, isLoading: overviewLoading } = useGuildOverview(isDev ? undefined : gid);
  const { data: channelsData } = useGuildChannels(isDev ? undefined : gid);

  const guild = isDev ? devGuild : (overviewData?.guild ?? null);
  const modules = isDev ? [] : (overviewData?.modules ?? []);
  const channels = isDev
    ? [
        { id: "111", name: "general", type: 0 },
        { id: "222", name: "polls", type: 0 },
        { id: "333", name: "announcements", type: 0 },
      ]
    : ((channelsData?.channels ?? []) as { id: string; name: string; type: number }[]);

  return (
    <DashboardLayout
      guildId={gid ?? ""}
      guildName={guild?.name ?? "Guild"}
      heading="Poll Studio"
      modules={modules}
    >
      {!devReady || (overviewLoading && !isDev) ? (
        <div className="flex items-center justify-center py-24 text-zinc-500">
          Loading…
        </div>
      ) : guild ? (
        <PollStudio guildId={gid ?? ""} guild={guild} channels={channels} />
      ) : (
        <div className="flex items-center justify-center py-24 text-zinc-500">
          Guild not found.
        </div>
      )}
    </DashboardLayout>
  );
}