import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { BoneyardCard } from "@/components/ui/boneyard-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ModuleRow = {
  name: string;
  display_name?: string;
  description?: string;
  category?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

type OverviewPayload = {
  guild: { name: string };
  modules: ModuleRow[];
};

export default function CommunityPage() {
  const router = useRouter();
  const { guildId } = router.query;
  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!guildId || typeof guildId !== "string") return;
    try {
      const response = await fetch(`/api/dashboard/guild/${guildId}/overview`);
      if (response.status === 401) {
        router.push("/");
        return;
      }
      if (!response.ok) throw new Error("Failed to fetch guild data");
      
      const data: OverviewPayload = await response.json();
      setPayload(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [guildId, router]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardLayout guildId={String(guildId || "")} guildName={payload?.guild.name || "Guild"} heading="Community" modules={payload?.modules || []}>
      {loading && <BoneyardCard lines={6} />}
      {!loading && error && <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">{error}</div>}
      {!loading && !error && (
        <div className="space-y-6">
          <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
            <CardHeader>
              <CardTitle>Community Overview</CardTitle>
              <CardDescription className="text-zinc-400">Manage community features and engagement tools.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-zinc-300">Community module features coming soon.</div>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
