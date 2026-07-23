import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import type { BotContext, InteractionResult } from '../../../types/index.js';
import {
  CASE_ACTION_PREFIX, CASE_WARN_MODAL_PREFIX, CASE_TIMEOUT_MODAL_PREFIX, CASE_KICK_MODAL_PREFIX,
  textInputRow, truncate, applyModerationAction
} from '../helpers.js';

export default {
  name: 'interactionCreate',
  async execute(interaction: any, context: BotContext): Promise<InteractionResult | undefined> {
    if (interaction.isCommand()) return undefined;
    try {
      if (interaction.isButton() && interaction.customId?.startsWith(`${CASE_ACTION_PREFIX}:`)) {
        return await handleCaseAction(interaction);
      }
      if (interaction.isModalSubmit() && interaction.customId?.startsWith(`${CASE_WARN_MODAL_PREFIX}:`)) {
        return await handleCaseWarnModal(interaction, context);
      }
      if (interaction.isModalSubmit() && interaction.customId?.startsWith(`${CASE_TIMEOUT_MODAL_PREFIX}:`)) {
        return await handleCaseTimeoutModal(interaction, context);
      }
      if (interaction.isModalSubmit() && interaction.customId?.startsWith(`${CASE_KICK_MODAL_PREFIX}:`)) {
        return await handleCaseKickModal(interaction, context);
      }
    } catch (error: any) {
      return { type: 'ERROR', message: `Case action failed: ${error?.message ?? 'unknown error'}` };
    }
  }
};

async function handleCaseAction(interaction: any): Promise<InteractionResult | undefined> {
  const parts = interaction.customId.split(':');
  const prefix = `${parts[0]}:${parts[1]}`;
  if (prefix !== CASE_ACTION_PREFIX) return undefined;

  const actionKey = parts[2];
  const token = parts.slice(3).join(':');

  if (actionKey === 'warn') {
    const modal = new ModalBuilder()
      .setCustomId(`${CASE_WARN_MODAL_PREFIX}:${token}`)
      .setTitle('Warn User');
    modal.addComponents(
      textInputRow(new TextInputBuilder().setCustomId('custom_reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500))
    );
    return { type: 'MODAL', modal };
  }

  if (actionKey === 'timeout') {
    const modal = new ModalBuilder()
      .setCustomId(`${CASE_TIMEOUT_MODAL_PREFIX}:${token}`)
      .setTitle('Timeout User');
    modal.addComponents(
      textInputRow(new TextInputBuilder().setCustomId('reason').setLabel('Reason for timeout').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)),
      textInputRow(new TextInputBuilder().setCustomId('custom_duration').setLabel('Duration in minutes').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. 30 (1-10080)'))
    );
    return { type: 'MODAL', modal };
  }

  if (actionKey === 'kick') {
    const modal = new ModalBuilder()
      .setCustomId(`${CASE_KICK_MODAL_PREFIX}:${token}`)
      .setTitle('Kick User');
    modal.addComponents(
      textInputRow(new TextInputBuilder().setCustomId('reason').setLabel('Reason for kick').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500))
    );
    return { type: 'MODAL', modal };
  }
}

async function handleCaseWarnModal(interaction: any, context: BotContext): Promise<InteractionResult> {
  const reason = truncate(interaction.fields.getTextInputValue('custom_reason'), 500);
  const token = interaction.customId.slice(`${CASE_WARN_MODAL_PREFIX}:`.length);
  return await applyModerationAction(interaction, context, 'WARN', reason, token);
}

async function handleCaseTimeoutModal(interaction: any, context: BotContext): Promise<InteractionResult> {
  const reason = truncate(interaction.fields.getTextInputValue('reason'), 500);
  const token = interaction.customId.slice(`${CASE_TIMEOUT_MODAL_PREFIX}:`.length);

  if (!token) {
    return { type: 'REPLY', message: 'Invalid timeout payload.', ephemeral: true };
  }

  const customMinutesText = interaction.fields.getTextInputValue('custom_duration');
  const durationMinutes = Number.parseInt(customMinutesText, 10);

  if (!durationMinutes || durationMinutes < 1 || durationMinutes > 10080) {
    return { type: 'REPLY', message: 'Duration must be between 1 and 10080 minutes.', ephemeral: true };
  }

  return await applyModerationAction(interaction, context, 'TIMEOUT', reason, token, durationMinutes * 60);
}

async function handleCaseKickModal(interaction: any, context: BotContext): Promise<InteractionResult> {
  const reason = truncate(interaction.fields.getTextInputValue('reason'), 500);
  const token = interaction.customId.slice(`${CASE_KICK_MODAL_PREFIX}:`.length);
  return await applyModerationAction(interaction, context, 'KICK', reason, token);
}
