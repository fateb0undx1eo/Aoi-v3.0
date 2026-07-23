import type { GuildMember } from 'discord.js';
import type { BotContext } from '../../../types/index.js';
import { buildEmbed } from '../helpers.js';

export default {
  name: 'guildMemberAdd',
  async execute(member: GuildMember, context: BotContext): Promise<void> {
    const { services, placeholderEngine } = context as any;
    const config = await services.configService.getModuleConfig(member.guild.id, 'community').catch(() => null);
    const dmWelcomerConfig = config?.config?.dm_welcomer;
    if (!dmWelcomerConfig?.enabled || !dmWelcomerConfig?.message) return;

    const description = placeholderEngine.render(dmWelcomerConfig.message, {
      mention: `<@${member.id}>`, username: member.user.username, server_name: member.guild.name,
      user: { id: member.id, username: member.user.username }
    });
    const title = placeholderEngine.render(
      dmWelcomerConfig.title || `Welcome to ${member.guild.name}`,
      { mention: `<@${member.id}>`, username: member.user.username, server_name: member.guild.name }
    );
    const imageUrl = String(dmWelcomerConfig.image_url ?? '').trim();

    const embed = buildEmbed(title, description, 0x57f287);
    const iconUrl = member.guild.iconURL({ extension: 'png', size: 128 }) ?? member.user.displayAvatarURL({ extension: 'png', size: 128 });
    embed.setThumbnail(iconUrl);
    if (imageUrl) embed.setImage(imageUrl);

    await member.send({ embeds: [embed] }).catch(() => null);
  }
};
