import { MessageFlags, type Client } from 'discord.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../observability/metrics.js';
import type { InteractionResult, BotContext, ModuleRegistry } from '../types/index.js';

function extraFields(result: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  if (result.allowedMentions !== undefined) out.allowedMentions = result.allowedMentions;
  if (result.flags !== undefined) out.flags = result.flags;
  if (result.embeds !== undefined) out.embeds = result.embeds;
  return out;
}

async function processResult(interaction: any, result: InteractionResult): Promise<void> {
  if (!result || result.type === 'IGNORE') return;

  switch (result.type) {
    case 'ASYNC_RESULT': {
      if (!interaction.deferred && !interaction.replied) {
        if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isAnySelectMenu()) {
          await interaction.deferUpdate();
        } else {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
      }
      const final = await result.execute();
      await processResult(interaction, final);
      break;
    }
    case 'REPLY':
    case 'ERROR': {
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: result.message,
            ...(result.components ? { components: result.components } : {}),
            ...(result.files ? { files: result.files } : {}),
            ...extraFields(result)
          } as any);
        } else {
          await interaction.reply({
            content: result.message,
            flags: result.ephemeral !== false ? MessageFlags.Ephemeral : undefined,
            ...(result.components ? { components: result.components } : {}),
            ...(result.files ? { files: result.files } : {}),
            ...extraFields(result)
          } as any);
        }
      } catch (err: any) {
        logger.warn('Failed to send reply/error', {
          type: result.type,
          code: err.code,
          message: err.message
        });
      }
      break;
    }
    case 'EDIT_REPLY': {
      try {
        await interaction.editReply({
          content: result.content,
          ...(result.components ? { components: result.components } : {}),
          ...(result.files ? { files: result.files } : {}),
          ...extraFields(result)
        } as any);
      } catch (editError: any) {
        logger.warn('EDIT_REPLY failed — interaction likely dead', {
          id: interaction.id,
          code: editError.code,
          message: editError.message
        });
      }
      break;
    }
    case 'UPDATE': {
      const updateOpts: Record<string, any> = {
        ...(result.content ? { content: result.content } : {}),
        ...(result.components ? { components: result.components } : {}),
        ...(result.files ? { files: result.files } : {}),
        ...extraFields(result)
      };
      try {
        await interaction.update(updateOpts as any);
      } catch (updateError: any) {
        logger.warn('UPDATE failed', {
          id: interaction.id,
          type: (interaction as any).type,
          customId: (interaction as any).customId,
          code: updateError.code,
          status: updateError.status,
          message: updateError.message,
          errors: updateError.errors
        });
      }
      break;
    }
    case 'MODAL':
      try {
        await interaction.showModal(result.modal);
      } catch (modalError: any) {
        logger.warn('MODAL failed — interaction likely dead', {
          id: interaction.id,
          code: modalError.code,
          message: modalError.message
        });
      }
      break;
    case 'FOLLOW_UP': {
      try {
        const followUpMsg = await interaction.followUp({
          content: result.content,
          components: result.components,
          flags: result.ephemeral ? MessageFlags.Ephemeral : undefined,
          ...extraFields(result)
        } as any);
        if (result.after) {
          try { await result.after(followUpMsg as any); } catch {}
        }
      } catch (followUpError: any) {
        logger.warn('FOLLOW_UP failed — interaction likely dead', {
          id: interaction.id,
          code: followUpError.code,
          message: followUpError.message
        });
      }
      break;
    }
    case 'DEFER_UPDATE':
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
      }
      break;
    case 'MULTI':
      for (const sub of result.results) {
        await processResult(interaction, sub);
      }
      break;
    default:
      logger.warn('Unknown result type', { type: (result as any).type });
  }
}

export function registerInteractionRouter(client: Client, registry: ModuleRegistry, context: BotContext): void {
  const ackedInteractions = new Set<string>();

  client.on('interactionCreate', async (interaction: any) => {
    if (ackedInteractions.has(interaction.id)) {
      console.warn('DOUBLE INTERACTION BLOCKED', { id: interaction.id });
      return;
    }
    ackedInteractions.add(interaction.id);

    try {
      if (
        !interaction.isChatInputCommand() &&
        !interaction.isMessageContextMenuCommand()
      ) {
        if (interaction.isModalSubmit() && !interaction.deferred && !interaction.replied) {
          try {
            await interaction.deferReply();
          } catch (deferErr: any) {
            console.error('MODAL DEFER FAILED', { id: interaction.id, code: deferErr.code, message: deferErr.message });
          }
        }

        const handlers = registry.getEventHandlers('interactionCreate');
        for (const handler of handlers) {
          let result: InteractionResult | void;
          try {
            result = await handler.execute(interaction, context);
          } catch (error: any) {
            logger.error(`Event handler ${handler.moduleName}/interactionCreate failed:`, error);
            await processResult(interaction, { type: 'ERROR', message: 'An internal error occurred.' });
            return;
          }
          if (result && result.type !== 'IGNORE') {
            try {
              await processResult(interaction, result);
            } catch (procError) {
              logger.error('Failed to process handler result:', procError);
            }
            return;
          }
        }
        return;
      }

      const command = registry.getCommand(interaction.commandName);

      if (!command) {
        logger.warn(`Command not found: ${interaction.commandName}`);
        return;
      }

      logger.info(`Executing command: ${interaction.commandName}`);

      if (interaction.deferred || interaction.replied) {
        console.warn('CMD DOUBLE ACK BLOCKED', { id: interaction.id, command: interaction.commandName });
        return;
      }

      const startedAt = Date.now();

      if (command.defer !== false) {
        try {
          await interaction.deferReply({
            flags: command.ephemeral !== false ? MessageFlags.Ephemeral : undefined
          });
        } catch (deferError: any) {
          logger.error('CMD DEFER FAILED', {
            code: deferError.code,
            message: deferError.message,
            command: interaction.commandName,
            interactionId: interaction.id
          });
          return;
        }
      }

      const cmdConfig = context.configCache.getCommandConfig(interaction.guildId, command.name);
      if (cmdConfig && cmdConfig.enabled === false) {
        await interaction.editReply('This command is disabled for this guild.');
        return;
      }

      const permOverrides: Record<string, any> = {
        ...(command.permissionOverrides ?? {}),
        ...((cmdConfig?.overrides ?? {}).permissions ?? {})
      };

      if (!context.permissionService.isAllowed(interaction, permOverrides)) {
        await interaction.editReply('You are not allowed to use this command.');
        return;
      }

      const rateResult = context.rateLimiter.check(interaction, command.name);
      if (!rateResult.allowed) {
        await interaction.editReply(`Rate limit exceeded. Retry in ${rateResult.retryAfter}s.`);
        return;
      }

      try {
        const result: InteractionResult | void = await command.execute(interaction, context);
        if (result && result.type !== 'IGNORE') {
          try {
            await processResult(interaction, result);
          } catch (procError) {
            logger.error('Failed to process command result:', procError);
          }
        }

        metrics.observe('discord_interaction_latency_ms', Date.now() - startedAt, {
          command: interaction.commandName,
          guild: interaction.guildId ?? 'dm'
        });
        metrics.increment('discord_interactions_total', {
          command: interaction.commandName,
          status: 'ok'
        });
        logger.info(`Command completed: ${interaction.commandName}`);
      } catch (error: any) {
        metrics.increment('discord_interactions_total', {
          command: interaction.commandName,
          status: 'error'
        });
        logger.error(`Command execution failed: ${interaction.commandName}`, error);
        try {
          await interaction.editReply('An internal error occurred.');
        } catch (replyError) {
          logger.error('Failed to send error reply', replyError);
        }
      }
    } catch (error: any) {
      logger.error('Interaction router error:', error);
    } finally {
      ackedInteractions.delete(interaction.id);
    }
  });
}
