import type { Message } from 'discord.js';
import type { BotContext } from '../../../types/index.js';
import {
  isUwuMessage, normalizePremiumFeatureConfig, getPremiumFeatureCooldownKey,
  premiumFeatureCooldowns, sendPremiumFeatureResponse
} from '../helpers.js';

export default {
  name: 'messageCreate',
  async execute(message: Message, context: BotContext): Promise<void> {
    const { services } = context as any;
    if (!message.guild || message.author.bot) return;

    const lock: any | null = await services.communityService.getUwuLock(message.guild.id, message.author.id);
    if (lock && !isUwuMessage(message.content)) {
      if (lock.settings?.delete_non_uwu) {
        await message.delete().catch(() => null);
      }
      if (lock.settings?.notify) {
        const warning = await (message.channel as any).send({
          content: `${message.author}, UwU lock is active. Please use uwu/owo/uvu-style wording.`
        });
        setTimeout(() => warning.delete().catch(() => null), 5000);
      }
      return;
    }

    const config = await services.configService.getModuleConfig(message.guild.id, 'community').catch(() => null);
    const premiumFeatureConfig = normalizePremiumFeatureConfig(config?.config?.premium_feature_1);
    if (!premiumFeatureConfig.enabled || premiumFeatureConfig.role_ids.length === 0 || premiumFeatureConfig.triggers.length === 0) return;

    const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
    if (!member) return;

    const normalizedMessage = String(message.content ?? '').trim().toLowerCase();
    if (!normalizedMessage) return;

    const matchedTrigger = premiumFeatureConfig.triggers.find((entry) => entry.trigger.toLowerCase() === normalizedMessage);
    if (!matchedTrigger) return;

    const allowedRoleIds = matchedTrigger.use_main_roles ? premiumFeatureConfig.role_ids : matchedTrigger.role_ids;
    const canUseFeature = allowedRoleIds.some((roleId) => member.roles.cache.has(roleId));
    if (!canUseFeature) return;

    const cooldownKey = getPremiumFeatureCooldownKey(message.guild.id, message.author.id);
    const now = Date.now();
    const cooldownEndsAt = premiumFeatureCooldowns.get(cooldownKey) ?? 0;
    if (cooldownEndsAt > now) return;

    if (premiumFeatureConfig.cooldown_seconds > 0) {
      premiumFeatureCooldowns.set(cooldownKey, now + (premiumFeatureConfig.cooldown_seconds * 1000));
    }

    if (matchedTrigger.delete_trigger_message) {
      await message.delete().catch(() => null);
    }

    await sendPremiumFeatureResponse({ message, config: premiumFeatureConfig, triggerConfig: matchedTrigger });
  }
};
