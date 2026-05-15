import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { BoneyardCard } from "@/components/ui/boneyard-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Heart, MessageSquare, TrendingUp } from "lucide-react";

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
  const [isLoading, setIsLoading] = useState(true);
  const [guildName, setGuildName] = useState("");

  const fetchData = useCallback(async () => {
    if (!guildId) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/guilds/${guildId}/overview`);
      if (!response.ok) throw new Error("Failed to fetch guild data");
      
      const data: OverviewPayload = await response.json();
      setGuildName(data.guild.name);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <DashboardLayout title="Community" icon={Users}>
      <div className="space-y-6">
        {isLoading ? (
          <>
            <BoneyardCard />
            <BoneyardCard />
            <BoneyardCard />
          </>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Community Overview</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Coming Soon</div>
                <p className="text-xs text-muted-foreground">Community features under development</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
