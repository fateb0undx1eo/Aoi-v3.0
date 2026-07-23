import type { ModalSubmitInteraction } from 'discord.js';
import type { BotContext, InteractionResult } from '../../../types/index.js';

export default {
  name: 'interactionCreate',
  async execute(interaction: ModalSubmitInteraction, context: BotContext): Promise<InteractionResult | void> {
    if (interaction.isCommand()) return;
    if (!interaction.memberPermissions?.has('Administrator' as any)) return;
    if (!interaction.isModalSubmit() || interaction.customId !== 'profile_modal') return;

    const { services } = context as any;

    try {
      const { fields } = interaction;
      const fontValues = fields.getStringSelectValues('profile:font');
      const fontValue = fontValues?.[0] ?? null;
      const effectValue = fields.getRadioGroup('profile:effect');
      const color1Raw = fields.getTextInputValue('profile:color1');
      const color2Raw = fields.getTextInputValue('profile:color2');
      const resetValue = fields.getCheckbox('profile:reset') as boolean | string;

      if (resetValue === true || resetValue === 'true') {
        await services.profileStyleService.clearGuildConfig(interaction.guildId);
        return { type: 'REPLY' as const, message: 'Profile style cleared!', ephemeral: true };
      }

      const fontId = fontValue ? Number(fontValue) : 11;
      const effectId = effectValue ? Number(effectValue) : 1;
      const parsedColor1 = color1Raw ? services.profileStyleService.parseColorInput(color1Raw) : null;
      const parsedColor2 = color2Raw ? services.profileStyleService.parseColorInput(color2Raw) : null;

      if (parsedColor1 === null && parsedColor2 === null) return { type: 'REPLY' as const, message: 'Please provide at least one color.', ephemeral: true };
      if (color2Raw && parsedColor2 === null) return { type: 'REPLY' as const, message: 'Invalid secondary color.', ephemeral: true };
      if (effectId === 2 && (parsedColor1 === null || parsedColor2 === null)) return { type: 'REPLY' as const, message: 'Gradient effect requires two colors.', ephemeral: true };

      const me = interaction.guild?.members?.me ?? await interaction.guild?.members?.fetchMe().catch(() => null);
      if (!me?.permissions.has('ChangeNickname' as any)) return { type: 'REPLY' as const, message: 'I need the "Change Nickname" permission in this server to apply a profile style.', ephemeral: true };

      const colors = [parsedColor1, parsedColor2].filter((v: any) => v !== null).slice(0, 2);
      await services.profileStyleService.updateGuildConfig(interaction.guildId, {
        enabled: true, font_id: fontId, effect_id: effectId, colors
      });

      return { type: 'REPLY' as const, message: 'Profile style updated!', ephemeral: true };
    } catch (error) {
      return { type: 'ERROR' as const, message: 'Error processing profile action.' };
    }
  }
};
