import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { BoneyardCard } from "@/components/ui/boneyard-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Save, MessageSquare, Users, Sparkles } from "lucide-react";

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

type CommunityConfig = {
  dm_welcomer?: {
    enabled: boolean;
    title: string;
    message: string;
    image_url: string;
  };
};

export default function CommunityPage() {
  const router = useRouter();
  const { guildId } = router.query;
  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CommunityConfig>({
    dm_welcomer: {
      enabled: false,
      title: "Welcome!",
      message: "Welcome to {server_name}!",
      image_url: "",
    },
  });

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

      // Load community module config
      const moduleRes = await fetch(`/api/modules/${guildId}/community`);
      if (moduleRes.ok) {
        const moduleData = await moduleRes.json();
        if (moduleData.module?.config) {
          setForm((current) => ({
            ...current,
            ...moduleData.module.config,
          }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [guildId, router]);

  const handleSave = async () => {
    if (!guildId || typeof guildId !== "string") return;
    setSaving(true);
    try {
      const response = await fetch(`/api/modules/${guildId}/community`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          config: form,
        }),
      });
      if (!response.ok) throw new Error("Failed to save configuration");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardLayout guildId={String(guildId || "")} guildName={payload?.guild.name || "Guild"} heading="Community" modules={payload?.modules || []}>
      {loading && <BoneyardCard lines={6} />}
      {!loading && error && <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">{error}</div>}
      {!loading && !error && (
        <div className="space-y-6">
          {/* DM Welcomer */}
          <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
            <CardHeader>
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-rose-400" />
                <div>
                  <CardTitle>DM Welcomer</CardTitle>
                  <CardDescription className="text-zinc-400">Send personalized welcome messages to new members</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="dm-welcomer-enabled">Enable DM Welcome Messages</Label>
                <Switch
                  id="dm-welcomer-enabled"
                  checked={form.dm_welcomer?.enabled ?? false}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      dm_welcomer: { ...current.dm_welcomer, enabled: checked },
                    }))
                  }
                />
              </div>
              {form.dm_welcomer?.enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="dm-title">Welcome Title</Label>
                    <Input
                      id="dm-title"
                      placeholder="Welcome to {server_name}!"
                      value={form.dm_welcomer?.title ?? ""}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          dm_welcomer: { ...current.dm_welcomer, title: e.target.value },
                        }))
                      }
                      className="border-zinc-800 bg-black text-zinc-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dm-message">Welcome Message</Label>
                    <Textarea
                      id="dm-message"
                      placeholder="Welcome message text..."
                      value={form.dm_welcomer?.message ?? ""}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          dm_welcomer: { ...current.dm_welcomer, message: e.target.value },
                        }))
                      }
                      className="border-zinc-800 bg-black text-zinc-100"
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dm-image">Image URL</Label>
                    <Input
                      id="dm-image"
                      placeholder="https://..."
                      value={form.dm_welcomer?.image_url ?? ""}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          dm_welcomer: { ...current.dm_welcomer, image_url: e.target.value },
                        }))
                      }
                      className="border-zinc-800 bg-black text-zinc-100"
                    />
                  </div>
                  <p className="text-xs text-zinc-400">Available variables: {"{mention}"}, {"{username}"}, {"{server_name}"}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Staff Tools */}
          <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-amber-400" />
                <div>
                  <CardTitle>Staff Tools</CardTitle>
                  <CardDescription className="text-zinc-400">Staff rating system and engagement features</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-300">Configure staff rating, role color rotation, and other community features using the commands:</p>
              <ul className="mt-3 space-y-1 text-sm text-zinc-400">
                <li>• <code className="text-cyan-400">/staffrate</code> - Rate staff members</li>
                <li>• <code className="text-cyan-400">/staffleaderboard</code> - View ratings</li>
                <li>• <code className="text-cyan-400">/randomizedrolecolor</code> - Role color rotation</li>
                <li>• <code className="text-cyan-400">/profile</code> - Bot profile styling</li>
                <li>• <code className="text-cyan-400">/memes autopost</code> - Meme auto-posting</li>
              </ul>
            </CardContent>
          </Card>

          {/* Premium Features */}
          <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-fuchsia-400" />
                <div>
                  <CardTitle>Premium Features</CardTitle>
                  <CardDescription className="text-zinc-400">Advanced community engagement options</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-300">Domain Expansion and Free commands are available for authorized users.</p>
              <p className="mt-2 text-xs text-zinc-400">
                Use <code className="text-cyan-400">/domain-expansion</code> and <code className="text-cyan-400">/free</code> commands to manage user roles and moderation.
              </p>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
