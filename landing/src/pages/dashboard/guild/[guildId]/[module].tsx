import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Settings2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { BoneyardCard } from "@/components/ui/boneyard-skeleton";

type ModuleRow = {
  name: string;
  display_name?: string;
  description?: string;
  category?: string;
  enabled?: boolean;
  is_premium?: boolean;
};

type OverviewPayload = {
  guild: Record<string, any>;
  modules: ModuleRow[];
};

function slugify(name = "") {
  return String(name).trim().toLowerCase().replace(/\s+/g, "-");
}

export default function GuildModulePage() {
  const router = useRouter();
  const { guildId, module: moduleSlug } = router.query;

  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    if (!guildId || typeof guildId !== "string") return;

    try {
      const response = await fetch(`/api/dashboard/guild/${guildId}/overview`);
      if (response.status === 401) {
        router.replace("/api/auth/discord");
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load module");
      }
      setPayload(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load module");
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const modules = payload?.modules || [];
  const guild = payload?.guild || null;

  const currentModule = useMemo(
    () =>
      modules.find(
        (item) => slugify(item.name) === String(moduleSlug || "").trim().toLowerCase()
      ),
    [moduleSlug, modules]
  );

  const heading = currentModule?.display_name || currentModule?.name || "Module";

  return (
    <DashboardLayout guildId={String(guildId || "")} guildName={guild?.name || "Guild"} heading={heading} modules={modules}>
      {loading && <BoneyardCard lines={3} />}

      {!loading && error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">{error}</div>
      )}

      {!loading && !error && !currentModule && (
        <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-6 text-sm text-yellow-200">
          Module not found for this guild.
        </div>
      )}

      {!loading && !error && currentModule && (
        <section className="rounded-3xl border border-border/70 bg-card/70 p-6 shadow-[0_20px_46px_-32px_hsl(var(--foreground)/0.45)]">
          <div className="mb-3 inline-flex rounded-xl border border-border/70 bg-background/60 p-2">
            <Settings2 className="h-4 w-4" />
          </div>
          <h1 className="text-3xl">{currentModule.display_name || currentModule.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-foreground/85">
            {currentModule.description || "Module configuration screen. This page is auto-routed from the enabled backend module registry."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1">
              Category: {currentModule.category || "general"}
            </span>
            <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1">
              Status: {currentModule.enabled === false ? "Disabled" : "Enabled"}
            </span>
            <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1">
              Plan: {currentModule.is_premium ? "Premium" : "Free"}
            </span>
          </div>
        </section>
      )}
    </DashboardLayout>
  );
}
