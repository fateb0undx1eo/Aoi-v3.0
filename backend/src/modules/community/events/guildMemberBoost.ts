import type { GuildMember, PartialGuildMember } from 'discord.js';
import type { BotContext } from '../../../types/index.js';
import { buildEmbed } from '../helpers.js';

export default {
  name: 'guildMemberUpdate',
  async execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember, context: BotContext): Promise<void> {
    const { services } = context as any;
    if (!oldMember.premiumSince && newMember.premiumSince) {
      const config = await services.configService.getModuleConfig(newMember.guild.id, 'community').catch(() => null);
      const boostConfig = config?.config?.messages?.boost;
      if (!boostConfig?.enabled || !boostConfig?.channel_id) return;

      const channel = newMember.guild.channels.cache.get(boostConfig.channel_id);
      if (!channel || !channel.isTextBased()) return;

      const embed = buildEmbed(
        'New Server Boost',
        `Thank you <@${newMember.id}> for boosting ${newMember.guild.name}!\nThe server now has ${newMember.guild.premiumSubscriptionCount || 0} boosts.`,
        0xf47fff
      );
      const avatarUrl = newMember.user.displayAvatarURL({ extension: 'png', size: 128 });
      embed.setThumbnail(avatarUrl);

      await (channel as any).send({ embeds: [embed] });
    }
  }
};
