import type { GuildMember, PartialGuildMember } from 'discord.js';
import type { BotContext } from '../../../types/index.js';
import { buildEmbed } from '../helpers.js';

export default {
  name: 'guildMemberRemove',
  async execute(member: GuildMember | PartialGuildMember, context: BotContext): Promise<void> {
    const { services, placeholderEngine } = context as any;
    const config = await services.configService.getModuleConfig(member.guild.id, 'community').catch(() => null);
    const messageConfig = config?.config?.messages?.leave;
    if (!messageConfig?.enabled || !messageConfig?.channel_id) return;

    const channel = member.guild.channels.cache.get(messageConfig.channel_id);
    if (!channel || !channel.isTextBased()) return;

    const description = placeholderEngine.render(messageConfig.text, {
      mention: `<@${member.id}>`, username: member.user.username, server_name: member.guild.name
    });

    await (channel as any).send({ embeds: [buildEmbed('Member Left', description, 0x808080)] });
  }
};
