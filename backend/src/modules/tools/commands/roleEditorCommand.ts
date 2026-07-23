import { PermissionsBitField, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { cidRole } from '../customIds.js';
import { buildRoleSelect, buildInitialContainer } from '../roleEditorUI.js';
import { R } from '../helpers.js';
import type { InteractionResult } from '../../../types/index.js';

export default {
  name: 'role',
  defer: false,
  description: 'Role management commands',
  ephemeral: false,
  options: [
    {
      name: 'editor',
      type: 1,
      description: "Edit a role's color with a live preview"
    }
  ],
  async execute(interaction: any): Promise<InteractionResult> {
    if (interaction.options.getSubcommand(true) !== 'editor') {
      return R.error('Unknown subcommand.');
    }

    const member = interaction.member;
    if (!member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return R.error('You need the Manage Roles permission.');
    }

    const guild = interaction.guild;
    const roles = guild.roles.cache
      .filter((r: any) => r.id !== guild.id && r.editable)
      .sort((a: any, b: any) => b.position - a.position);

    if (roles.size === 0) {
      return R.error('No editable roles found.');
    }

    const userId = interaction.user.id;

    const container = buildInitialContainer()
      .addActionRowComponents((row: any) =>
        row.setComponents(buildRoleSelect(userId))
      )
      .addActionRowComponents((row: any) =>
        row.setComponents(
          new ButtonBuilder()
            .setCustomId(cidRole('confirm', userId))
            .setStyle(ButtonStyle.Secondary)
            .setLabel('CONFIRM')
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(cidRole('cancel', userId))
            .setStyle(ButtonStyle.Secondary)
            .setLabel('CANCEL')
        )
      );

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });

    return { type: 'IGNORE' };
  }
};
