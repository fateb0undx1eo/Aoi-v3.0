import { MessageFlags } from 'discord.js';
import { isAdminOrOwner } from '../helpers.js';

export default {
  name: 'jailed',
  description: 'Jail system',
  options: [
    {
      name: 'list',
      type: 1,
      description: 'List all prisoners'
    }
  ],
  async execute(interaction: any): Promise<void> {
    const staffRoleId = process.env.STAFF;
    const prisonerRoleId = process.env.PRISONER;
    if (!staffRoleId || !prisonerRoleId) {
      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: 'Jail system is not configured correctly.' }] }]
      });
      return;
    }

    if (!isAdminOrOwner(interaction.member, interaction.guild) && !interaction.member.roles.cache.has(staffRoleId)) {
      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: 'You do not have permission to use this command.' }] }]
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand(true);

    if (subcommand === 'list') {
      const members = await interaction.guild.members.fetch().catch(() => null);
      if (!members) {
        await interaction.editReply({
          flags: MessageFlags.IsComponentsV2,
          components: [{ type: 17, components: [{ type: 10, content: 'Failed to fetch members.' }] }]
        });
        return;
      }

      const prisoners = members.filter((m: any) => m.roles.cache.has(prisonerRoleId));

      if (prisoners.size === 0) {
        await interaction.editReply({
          flags: MessageFlags.IsComponentsV2,
          components: [{ type: 17, components: [{ type: 10, content: '**LIST OF PRISONERS**' }, { type: 10, content: '-# TO RELEASE A PRISONER, RUN `/unjail` ON THEM AGAIN' }] }]
        });
        return;
      }

      const lines = [...prisoners.values()].map((m: any, i: number) => `${i + 1}. <@${m.id}>`);
      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: '**LIST OF PRISONERS**' }, { type: 10, content: lines.join('\n') }, { type: 10, content: '-# TO RELEASE A PRISONER, RUN `/unjail` ON THEM AGAIN' }] }]
      });
    }
  }
};
