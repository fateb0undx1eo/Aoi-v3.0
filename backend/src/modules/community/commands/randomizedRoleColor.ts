import type { ChatInputCommandInteraction } from 'discord.js';
import type { BotContext } from '../../../types/index.js';
import { buildEmbed } from '../helpers.js';

export default {
  name: 'randomizedrolecolor',
  description: 'Enable or disable randomized role color rotation',
  options: [
    { name: 'enabled', type: 5, description: 'Whether randomized role color rotation should run', required: true }
  ],
  async execute(interaction: ChatInputCommandInteraction, context: BotContext): Promise<void> {
    const { services, configCache } = context as any;
    const enabled = interaction.options.getBoolean('enabled', true);
    const config = await services.roleColorRotationService.updateGuildConfig(interaction.guildId, { enabled });
    await configCache.refreshGuild(interaction.guildId);

    const suffix = config.role_ids.length
      ? `Configured roles: ${config.role_ids.length}\nInterval: every ${config.interval_value} ${config.interval_unit}.`
      : 'No roles are configured yet. Use the community dashboard to choose roles and interval.';

    await interaction.editReply({
      embeds: [buildEmbed(
        enabled ? 'Randomized Role Color Enabled' : 'Randomized Role Color Disabled',
        suffix, enabled ? 0x57f287 : 0xed4245
      )]
    });
  }
};
