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
      // ONLY process slash/context commands here
      if (
        !interaction.isChatInputCommand() &&
        !interaction.isMessageContextMenuCommand()
      ) {
        return; // Let module handlers process component interactions
      }

      const command = registry.getCommand(interaction.commandName);

      if (!command) {
        logger.warn(`Command not found: ${interaction.commandName}`);
        return;
      }

      logger.info(`Executing command: ${interaction.commandName}`);

      try {
        // Only defer if not already deferred/replied
        if (
          command.defer !== false &&
          !interaction.deferred &&
          !interaction.replied
        ) {
          logger.debug(`Deferring interaction: ${interaction.commandName}`);

          try {
            await interaction.deferReply({
              ephemeral: command.ephemeral ?? true
            });
          } catch (deferError) {
            if (deferError.code === 40060) {
              logger.debug(
                'Interaction already acknowledged (40060), continuing without deferring'
              );
            } else {
              throw deferError;
            }
          }
        } else if (interaction.deferred || interaction.replied) {
          logger.debug(
            `Interaction already ${
              interaction.deferred ? 'deferred' : 'replied'
            }`
          );
        }

        const commandConfig = context.configCache.getCommandConfig(
          interaction.guildId,
          command.name
        );

        if (commandConfig && commandConfig.enabled === false) {
          await replyOrEdit(
            interaction,
            'This command is disabled for this guild.'
          );
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
          await replyOrEdit(
            interaction,
            'You are not allowed to use this command.'
          );
          return;
        }

        const rateResult = context.rateLimiter.check(
          interaction,
          command.name
        );

        if (!rateResult.allowed) {
          await replyOrEdit(
            interaction,
            `Rate limit exceeded. Retry in ${rateResult.retryAfter}s.`
          );
          return;
        }

        await command.execute(interaction, context);

        logger.info(`Command completed: ${interaction.commandName}`);
      } catch (error) {
        logger.error(
          `Command execution failed: ${interaction.commandName}`,
          error
        );

        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply('An internal error occurred.');
          } else {
            await interaction.reply({
              content: 'An internal error occurred.',
              ephemeral: true
            });
          }
        } catch (replyError) {
          logger.error('Failed to send error reply', replyError);
        }
      }
    } catch (error) {
      logger.error('Interaction router error:', error);
    }
  });
}