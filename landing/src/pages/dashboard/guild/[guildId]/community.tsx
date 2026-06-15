import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useQueryClient } from "@tanstack/react-query";
import { useGuildOverview, useGuildRoles, useGuildChannels, useGuildEmojis, useSaveModule } from "@/lib/api";
import { DashboardLayout } from "@/components/dashboard-layout";
import { FeatureCard } from "@/components/feature-card";
import { Bot, LogIn, LogOut, Zap, Lock, Users, Palette, ImageIcon, Star, Megaphone } from "lucide-react";
import RoleColorRotation from "@/components/community/role-color-rotation";
import MemeAutopost from "@/components/community/meme-autopost";
import BotLooks from "@/components/community/bot-looks";
import DmWelcomer from "@/components/community/dm-welcomer";
import PremiumFeature from "@/components/community/premium-feature";
import DmBroadcast from "@/components/community/dm-broadcast";
import {
  DEFAULT_BOT_LOOKS_CONFIG,
  DEFAULT_PROFILE_STYLE_CONFIG,
  PROFILE_STYLE_FONTS,
  PROFILE_STYLE_EFFECTS,
  normalizeRoleColorConfig,
  normalizeMemeAutopostConfig,
  normalizeBotLooksConfig,
  normalizeProfileStyleConfig,
  normalizeDmWelcomerConfig,
  normalizePremiumFeatureConfig,
  decimalToHexColor,
} from "@/components/community/utils";

export default function CommunityPage() {
  const router = useRouter();
  const { guildId } = router.query;

  const queryClient = useQueryClient();
  const saveModule = useSaveModule(guildId as string);

  const { data: overviewData, isLoading: overviewLoading } = useGuildOverview(guildId as string);
  const { data: rolesData, error: rolesError } = useGuildRoles(guildId as string);
  const { data: channelsData, error: channelsError } = useGuildChannels(guildId as string);
  const { data: emojisData, error: emojisError } = useGuildEmojis(guildId as string);

  const roles = rolesData?.roles ?? [];
  const channels = channelsData?.channels ?? [];
  const emojis = emojisData?.emojis ?? [];

  const [dmAllOpen, setDmAllOpen] = useState(false);
  const [botProfileOpen, setBotProfileOpen] = useState(false);
  const [memeOpen, setMemeOpen] = useState(false);
  const [roleColorOpen, setRoleColorOpen] = useState(false);
  const [dmWelcomerOpen, setDmWelcomerOpen] = useState(false);
  const [premiumFeatureOpen, setPremiumFeatureOpen] = useState(false);

  const guild = overviewData?.guild ?? null;
  const modules = overviewData?.modules ?? [];
  const communityModule = useMemo(
    () => modules.find((module) => module.name === "community"),
    [modules]
  );
  const moduleConfig = communityModule?.config as Record<string, any> | null | undefined;

  const selectedRoleColors = useMemo(() => {
    const cfg = normalizeRoleColorConfig((moduleConfig as any)?.role_color_rotation);
    const selected = new Set(cfg.role_ids);
    return roles.filter((role) => selected.has(role.id));
  }, [moduleConfig, roles]);

  const memeSubredditPreview = useMemo(() => {
    const cfg = normalizeMemeAutopostConfig((moduleConfig as any)?.meme_autopost);
    return cfg.subreddits;
  }, [moduleConfig]);

  const roleColorForm = useMemo(() => normalizeRoleColorConfig((moduleConfig as any)?.role_color_rotation), [moduleConfig]);
  const memeForm = useMemo(() => normalizeMemeAutopostConfig((moduleConfig as any)?.meme_autopost), [moduleConfig]);
  const dmWelcomerForm = useMemo(() => normalizeDmWelcomerConfig((moduleConfig as any)?.dm_welcomer), [moduleConfig]);
  const botLooksForm = useMemo(() => normalizeBotLooksConfig((moduleConfig as any)?.bot_looks), [moduleConfig]);
  const profileStyleForm = useMemo(() => normalizeProfileStyleConfig((moduleConfig as any)?.profile_style), [moduleConfig]);

  const botLooksSummary = useMemo(() => {
    const cfg = normalizeBotLooksConfig((moduleConfig as any)?.bot_looks);
    if (!cfg.enabled) {
      return "Presence is currently off. Save to keep the bot on its default Discord look.";
    }
    if (cfg.activity_type === "custom") {
      return cfg.custom_status
        ? `${cfg.status} with custom status "${cfg.custom_status}".`
        : `${cfg.status} with no custom status text yet.`;
    }
    return cfg.activity_text
      ? `${cfg.status} while ${cfg.activity_type} "${cfg.activity_text}".`
      : `${cfg.status} with ${cfg.activity_type} selected but no activity text yet.`;
  }, [moduleConfig]);

  const profileStyleSummary = useMemo(() => {
    const cfg = normalizeProfileStyleConfig((moduleConfig as any)?.profile_style);
    if (!cfg.enabled) {
      return "Bot profile style is off. Save to keep the bot on default display styling.";
    }
    const font = PROFILE_STYLE_FONTS.find((entry) => entry.id === cfg.font_id)?.label ?? `Font ${cfg.font_id}`;
    const effect = PROFILE_STYLE_EFFECTS.find((entry) => entry.id === cfg.effect_id)?.label ?? `Effect ${cfg.effect_id}`;
    const colorText = cfg.colors.length
      ? cfg.colors.map(decimalToHexColor).join(", ")
      : "no custom colors";
    return `${font} with ${effect} using ${colorText}. Slash sync: /profile style`;
  }, [moduleConfig]);

  const premiumFeatureSummary = useMemo(() => {
    const cfg = normalizePremiumFeatureConfig((moduleConfig as any)?.premium_feature_1);
    if (!cfg.enabled) {
      return "Create role-gated trigger replies with container images, footer text, and a shared cooldown.";
    }
    const selectedRoleCount = roles.filter((role) => cfg.role_ids.includes(role.id)).length;
    return `${cfg.triggers.length} trigger${cfg.triggers.length === 1 ? "" : "s"} live for ${selectedRoleCount} selected role${selectedRoleCount === 1 ? "" : "s"} with a ${cfg.cooldown_seconds}s shared cooldown${cfg.webhook_enabled ? " via webhook delivery" : ""}.`;
  }, [moduleConfig, roles]);

  const hasPersistedBotLooksConfig = useMemo(() => {
    const persisted = normalizeBotLooksConfig((moduleConfig as any)?.bot_looks);
    return (
      persisted.enabled ||
      persisted.status !== DEFAULT_BOT_LOOKS_CONFIG.status ||
      persisted.activity_type !== DEFAULT_BOT_LOOKS_CONFIG.activity_type ||
      persisted.activity_text !== "" ||
      persisted.custom_status !== "" ||
      persisted.streaming_url !== ""
    );
  }, [moduleConfig]);

  const hasPersistedProfileStyleConfig = useMemo(() => {
    const persisted = normalizeProfileStyleConfig((moduleConfig as any)?.profile_style);
    return (
      persisted.enabled ||
      persisted.font_id !== DEFAULT_PROFILE_STYLE_CONFIG.font_id ||
      persisted.effect_id !== DEFAULT_PROFILE_STYLE_CONFIG.effect_id ||
      persisted.colors.length > 0
    );
  }, [moduleConfig]);

  const roleColorEnabled = useMemo(() => normalizeRoleColorConfig((moduleConfig as any)?.role_color_rotation).enabled, [moduleConfig]);
  const memeEnabled = useMemo(() => normalizeMemeAutopostConfig((moduleConfig as any)?.meme_autopost).enabled, [moduleConfig]);
  const dmWelcomerEnabled = useMemo(() => normalizeDmWelcomerConfig((moduleConfig as any)?.dm_welcomer).enabled, [moduleConfig]);
  const premiumFeatureEnabled = useMemo(() => normalizePremiumFeatureConfig((moduleConfig as any)?.premium_feature_1).enabled, [moduleConfig]);

  async function saveCommunityConfig(config: Record<string, unknown>): Promise<void> {
    await saveModule.mutateAsync({
      moduleName: "community",
      body: {
        enabled: communityModule?.enabled ?? true,
        config,
      },
    });
  }

  async function reloadForms() {
    if (!guildId || typeof guildId !== "string") return;
    await queryClient.invalidateQueries({ queryKey: ["guild-overview", guildId] });
  }

  return (
    <DashboardLayout guildId={String(guildId || "")} guildName={guild?.name || "Guild"} heading="Community" modules={modules}>
      <div className="space-y-8">
        <section>
          <h2 className="card-heading mb-4 text-sm uppercase tracking-wider text-muted-foreground">Feature Cards</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Bot className="h-6 w-6" />}
              title="Bot Profile"
              description={`${botLooksForm.enabled || profileStyleForm.enabled ? "Active" : "Default"} \u2022 ${botLooksForm.status} \u2022 ${botLooksForm.activity_type}${profileStyleForm.enabled ? " \u2022 Styled" : ""}`}
              badge={hasPersistedBotLooksConfig || hasPersistedProfileStyleConfig ? "Active" : "Default"}
              iconColor="text-cyan-400"
              onClick={() => setBotProfileOpen(true)}
            />
            <FeatureCard
              icon={<LogIn className="h-6 w-6" />}
              title="DM All"
              description="Send a one-off DM to one member or the whole server with editable text and container blocks."
              iconColor="text-green-500"
              onClick={() => setDmAllOpen(true)}
            />
            <FeatureCard
              icon={<Megaphone className="h-6 w-6" />}
              title="Announcements"
              description="Compose one-off announcements as normal messages, embeds, or containers and send them to one or many channels."
              iconColor="text-orange-400"
              onClick={() => router.push(`/dashboard/guild/${guildId}/announcements`)}
            />
            <FeatureCard
              icon={<Palette className="h-6 w-6" />}
              title="Randomized Role Color"
              description={`Rotate ${selectedRoleColors.length} selected roles every ${roleColorForm.interval_value} ${roleColorForm.interval_unit}.`}
              badge={roleColorEnabled ? "Live" : "Off"}
              iconColor="text-pink-500"
              onClick={() => setRoleColorOpen(true)}
            />
            <FeatureCard
              icon={<ImageIcon className="h-6 w-6" />}
              title="Meme Autopost"
              description={
                memeSubredditPreview.length
                  ? `Post from ${memeSubredditPreview.length} subreddit${memeSubredditPreview.length === 1 ? "" : "s"} every ${memeForm.interval_value} ${memeForm.interval_unit}.`
                  : "Choose subreddits, a target channel, and an optional ping role."
              }
              badge={memeEnabled ? "Live" : "Off"}
              iconColor="text-blue-500"
              onClick={() => setMemeOpen(true)}
            />
            <FeatureCard
              icon={<Star className="h-6 w-6" />}
              title="Premium Feature #1"
              description={premiumFeatureSummary}
              badge={premiumFeatureEnabled ? "Live" : "Off"}
              iconColor="text-amber-400"
              onClick={() => setPremiumFeatureOpen(true)}
            />
          </div>
        </section>

        <section>
          <h2 className="card-heading mb-4 text-sm uppercase tracking-wider text-muted-foreground">Messaging</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<LogIn className="h-6 w-6" />}
              title="DM Welcomer"
              description={dmWelcomerEnabled ? "Send a configured DM welcome whenever someone joins the server." : "Configure the direct-message welcome the bot sends to new members."}
              iconColor="text-green-500"
              badge={dmWelcomerEnabled ? "Live" : "Off"}
              onClick={() => setDmWelcomerOpen(true)}
            />
            <FeatureCard
              icon={<LogOut className="h-6 w-6" />}
              title="Goodbye System"
              description="Send a leave message when members exit the server."
              iconColor="text-red-500"
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Booster Rewards"
              description="Thank members when they start boosting the server."
              iconColor="text-pink-500"
            />
          </div>
        </section>

        <section>
          <h2 className="card-heading mb-4 text-sm uppercase tracking-wider text-muted-foreground">Channel Controls</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FeatureCard
              icon={<Lock className="h-6 w-6" />}
              title="UwU Lock"
              description="Apply a novelty channel lock without adding a heavy moderation subsystem."
              iconColor="text-pink-500"
            />
            <FeatureCard
              icon={<Users className="h-6 w-6" />}
              title="Low-Write Runtime"
              description="Community features are intentionally kept scheduler-light and inexpensive to run."
              iconColor="text-blue-500"
            />
          </div>
        </section>

        <DmBroadcast
          guildId={String(guildId || "")}
          open={dmAllOpen}
          onOpenChange={setDmAllOpen}
          guild={guild}
          emojis={emojis}
        />

        <PremiumFeature
          guildId={String(guildId || "")}
          open={premiumFeatureOpen}
          onOpenChange={setPremiumFeatureOpen}
          moduleConfig={moduleConfig}
          roles={roles}
          rolesError={rolesError}
          emojis={emojis}
          onSaveConfig={saveCommunityConfig}
          onReloadForms={reloadForms}
        />

        <DmWelcomer
          guildId={String(guildId || "")}
          open={dmWelcomerOpen}
          onOpenChange={setDmWelcomerOpen}
          moduleConfig={moduleConfig}
          onSaveConfig={saveCommunityConfig}
          onReloadForms={reloadForms}
        />

        <BotLooks
          guildId={String(guildId || "")}
          open={botProfileOpen}
          onOpenChange={setBotProfileOpen}
          moduleConfig={moduleConfig}
          onSaveConfig={saveCommunityConfig}
          onReloadForms={reloadForms}
        />

        <RoleColorRotation
          guildId={String(guildId || "")}
          open={roleColorOpen}
          onOpenChange={setRoleColorOpen}
          moduleConfig={moduleConfig}
          roles={roles}
          rolesError={rolesError}
          onSaveConfig={saveCommunityConfig}
          onReloadForms={reloadForms}
        />

        <MemeAutopost
          guildId={String(guildId || "")}
          open={memeOpen}
          onOpenChange={setMemeOpen}
          moduleConfig={moduleConfig}
          roles={roles}
          channels={channels}
          channelsError={channelsError}
          onSaveConfig={saveCommunityConfig}
          onReloadForms={reloadForms}
        />
      </div>
    </DashboardLayout>
  );
}
