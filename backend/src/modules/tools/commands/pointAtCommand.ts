import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { cidPoint } from '../customIds.js';
import { R } from '../helpers.js';
import type { InteractionResult } from '../../../types/index.js';

export default {
  name: 'point',
  description: 'Point at someone',
  defer: false,
  ephemeral: false,
  options: [
    {
      name: 'at',
      type: 1,
      description: 'Point at a user with a message',
      options: [
        {
          name: 'user',
          type: 6,
          description: 'The user to point at',
          required: true
        }
      ]
    }
  ],
  async execute(interaction: any): Promise<InteractionResult> {
    if (interaction.options.getSubcommand(true) !== 'at') {
      return R.error('Unknown subcommand.');
    }

    const target = interaction.options.getUser('user');
    const userId = interaction.user.id;

    const modal = new ModalBuilder()
      .setTitle('Point At')
      .setCustomId(cidPoint('submit', userId, target.id))
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>()
          .addComponents(
            new TextInputBuilder()
              .setCustomId('message')
              .setLabel('What should point at this user?')
              .setStyle(TextInputStyle.Paragraph)
              .setMaxLength(200)
              .setRequired(true)
              .setPlaceholder('Enter your message here...')
          )
      );

    return R.modal(modal);
  }
};
