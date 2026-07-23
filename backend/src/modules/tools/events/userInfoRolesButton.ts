import type { InteractionResult } from '../../../types/index.js';

export default {
  name: 'interactionCreate',
  async execute(interaction: any): Promise<InteractionResult | undefined> {
    if (interaction.isCommand()) return;
    if (!interaction.isButton() || !interaction.customId.startsWith('roles_')) {
      return;
    }

    const userId = interaction.customId.split('_')[1] as string;

    const member = interaction.guild?.members.cache.get(userId);
    if (!member) {
      return { type: 'REPLY', message: 'User not found in this server.', ephemeral: true };
    }

    const roles = member.roles.cache
      .filter((r: any) => r.name !== '@everyone')
      .sort((a: any, b: any) => b.position - a.position);

    if (roles.size === 0) {
      return { type: 'REPLY', message: 'This user has no roles.', ephemeral: true };
    }

    const rolesText = roles.map((r: any) => r.toString()).join(' ');

    return { type: 'REPLY', message: rolesText, ephemeral: true, allowedMentions: { parse: [] } };
  }
};
