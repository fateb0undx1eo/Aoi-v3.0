import { logger } from '../utils/logger.js';

async function replyOrEdit(interaction, content, ephemeral = true) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(content);
    return;
  }

  await interaction.reply({ content, ephemeral });
}

export function registerInteractionRouter(client, registry, context) {
  client.on('interactionCreate', async (interaction) => {
    try {
      logger.debug(`Interaction received: type=${interaction.type}, commandName=${interaction.commandName}, customId=${interaction.customId}`);
      
      if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) {
        logger.debug(`Skipping non-command interaction: ${interaction.type}`);
        return;
      }

      const command = registry.getCommand(interaction.commandName);
      if (!command) {
        logger.warn(`Command not found: ${interaction.commandName}`);
        return;
      }

      logger.info(`Executing command: ${interaction.commandName}`);

      try {
        if (command.defer !== false) {
          await interaction.deferReply({ ephemeral: command.ephemeral ?? false });
        }

        const commandConfig = context.configCache.getCommandConfig(
          interaction.guildId,
          command.name
        );
        if (commandConfig && commandConfig.enabled === false) {
          await replyOrEdit(interaction, 'This command is disabled for this guild.');
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
          await replyOrEdit(interaction, 'You are not allowed to use this command.');
          return;
        }

        const rateResult = context.rateLimiter.check(interaction, command.name);
        if (!rateResult.allowed) {
          await replyOrEdit(interaction, `Rate limit exceeded. Retry in ${rateResult.retryAfter}s.`);
          return;
        }

        await command.execute(interaction, context);
        logger.info(`Command completed: ${interaction.commandName}`);
      } catch (error) {
        logger.error(`Command execution failed: ${interaction.commandName}`, error);
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply('An internal error occurred.');
        } else {
          await interaction.reply({ content: 'An internal error occurred.', ephemeral: true });
        }
      }
    } catch (error) {
      logger.error('Interaction router error:', error);
    }
  });
}
