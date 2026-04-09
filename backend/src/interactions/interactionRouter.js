import { logger } from '../utils/logger.js';

export function registerInteractionRouter(client, registry, context) {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = registry.getCommand(interaction.commandName);
    if (!command) return;

    try {
      await interaction.deferReply({ ephemeral: command.ephemeral ?? false });

      const commandConfig = context.configCache.getCommandConfig(
        interaction.guildId,
        command.name
      );
      if (commandConfig && commandConfig.enabled === false) {
        await interaction.editReply('This command is disabled for this guild.');
        return;
      }

      const permissionOverrides = {
        ...(command.permissionOverrides ?? {}),
        ...((commandConfig?.overrides ?? {}).permissions ?? {})
      };

      const permissionResult = context.permissionService.isAllowed(
        interaction,
        permissionOverrides
      );
      if (!permissionResult) {
        await interaction.editReply('You are not allowed to use this command.');
        return;
      }

      const rateResult = context.rateLimiter.check(interaction, command.name);
      if (!rateResult.allowed) {
        await interaction.editReply(`Rate limit exceeded. Retry in ${rateResult.retryAfter}s.`);
        return;
      }

      await command.execute(interaction, context);
    } catch (error) {
      logger.error(`Command failed: ${interaction.commandName}`, error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('An internal error occurred.');
      } else {
        await interaction.reply({ content: 'An internal error occurred.', ephemeral: true });
      }
    }
  });
}
