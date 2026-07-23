import { ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags } from 'discord.js';
import { parsePointCid } from '../customIds.js';
import { generatePointatImage } from '../canvas.js';
import { R } from '../helpers.js';
import type { InteractionResult } from '../../../types/index.js';

export default {
  name: 'interactionCreate',
  async execute(interaction: any): Promise<InteractionResult | undefined> {
    if (interaction.isChatInputCommand()) return undefined;
    if (!interaction.customId) return R.ignore();
    const parsed = parsePointCid(interaction.customId);
    if (!parsed) return R.ignore();

    const { action, userId, data } = parsed;

    if (action === 'submit' && interaction.isModalSubmit()) {
      if (interaction.user.id !== userId) {
        return R.error('This modal is not for you.');
      }

      const targetId = data[0];
      const message = interaction.fields.getTextInputValue('message').trim();
      if (!message) return R.error('Message cannot be empty.');

      const targetUser = targetId
        ? await interaction.client.users.fetch(targetId).catch(() => null)
        : null;

      if (!targetUser) return R.error('Target user not found.');

      return {
        type: 'ASYNC_RESULT',
        execute: async (): Promise<InteractionResult> => {
          let buffer: Buffer;
          try {
            buffer = await generatePointatImage(
              targetUser.displayAvatarURL({ extension: 'png', size: 4096 }),
              message
            );
          } catch (err) {
            console.error('Image generation failed:', err);
            return { type: 'ERROR', message: 'Failed to generate image.' };
          }

          const container = new ContainerBuilder()
            .addMediaGalleryComponents(
              new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL('attachment://pointat.png')
              )
            );

          try {
            await interaction.editReply({
              flags: MessageFlags.IsComponentsV2,
              components: [container],
              files: [{ attachment: buffer, name: 'pointat.png' }]
            });
          } catch (err) {
            console.error('Failed to send reply:', err);
            return { type: 'ERROR', message: 'Failed to send response.' };
          }

          return { type: 'IGNORE' };
        }
      };
    }

    return R.ignore();
  }
};
