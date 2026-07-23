import { MessageFlags } from 'discord.js';
import { isAdminOrOwner } from '../helpers.js';

export default {
  name: 'jail',
  description: 'Jail or unjail a user',
  options: [
    {
      name: 'user',
      type: 6,
      description: 'User to jail or unjail',
      required: true
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

    const target = interaction.options.getUser('user', true);
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: 'User not found.' }] }]
      });
      return;
    }

    const prisonerRole = interaction.guild.roles.cache.get(prisonerRoleId);
    if (!prisonerRole) {
      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: 'Jail system is not configured correctly.' }] }]
      });
      return;
    }

    const hasRole = member.roles.cache.has(prisonerRoleId);

    if (hasRole) {
      await member.roles.remove(prisonerRoleId, `Unjailed by ${interaction.user.tag}`);
      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: `**<@${target.id}> HAS BEEN RELEASED**` }] }]
      });
    } else {
      await member.roles.add(prisonerRoleId, `Jailed by ${interaction.user.tag}`);
      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: `**<@${target.id}> HAS BEEN IMPRISONED**` }, { type: 10, content: '-# TO RELEASE A PRISONER, RUN `/unjail` ON THEM AGAIN' }] }]
      });
    }
  }
};
