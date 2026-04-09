import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { BoneyardCard } from "@/components/ui/boneyard-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Command, Palette, Shield } from "lucide-react";

type ModuleRow = {
  name: string;
  display_name?: string;
  description?: string;
  category?: string;
  enabled?: boolean;
};

type GuildPayload = {
  guild: Record<string, any>;
  modules: ModuleRow[];
};

export default function SettingsPage() {
  const router = useRouter();
  const { guildId } = router.query;

  const [payload, setPayload] = useState<GuildPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const loadGuildData = useCallback(async () => {
    if (!guildId || typeof guildId !== "string") return;

    try {
      const response = await fetch(`/api/dashboard/guild/${guildId}/overview`);
      if (response.status === 401) {
        router.replace("/api/auth/discord");
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load guild data");
      }

      setPayload(data);
    } catch (err) {
      console.error("Failed to load guild data:", err);
    } finally {
      setLoading(false);
    }
  }, [guildId, router]);

  useEffect(() => {
    loadGuildData();
  }, [loadGuildData]);

  const guild = payload?.guild || null;
  const modules = payload?.modules || [];

  return (
    <DashboardLayout guildId={String(guildId || "")} guildName={guild?.name || "Guild"} heading="Settings" modules={modules}>
      {loading ? (
        <div className="space-y-4">
          <BoneyardCard lines={2} />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <BoneyardCard key={index} lines={3} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-muted-foreground">Current backend-backed settings surfaces for this guild.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Command className="h-5 w-5 text-blue-500" />
                  <div>
                    <CardTitle>Prefix and Commands</CardTitle>
                    <CardDescription>Prefix updates and command overrides are supported by the backend settings routes.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                This slice keeps the page aligned with the existing backend instead of advertising removed message-format options.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Palette className="h-5 w-5 text-pink-500" />
                  <div>
                    <CardTitle>Branding</CardTitle>
                    <CardDescription>Guild branding stays in the backend settings service.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Use this section as the entry point for lightweight appearance settings once the form pass is added.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-emerald-500" />
                  <div>
                    <CardTitle>Dashboard Roles</CardTitle>
                    <CardDescription>Role-based dashboard access remains a supported backend setting.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                The UI is intentionally thin here until the backend cleanup is fully settled.
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
