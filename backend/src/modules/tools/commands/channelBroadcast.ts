import type { InteractionResult } from '../../../types/index.js';

export default {
  name: 'channel',
  description: 'Send a message to every sendable channel in the server',
  ephemeral: true,
  permissionOverrides: {
    discordPermissions: ['Administrator']
  },
  options: [
    {
      name: 'all',
      type: 1,
      description: 'Broadcast to all channels',
      options: [
        {
          name: 'message',
          type: 3,
          description: 'Message to send to all channels',
          required: true
        },
        {
          name: 'delete_after_seconds',
          type: 4,
          description: 'Optional override for auto-delete timing',
          required: false,
          min_value: 0,
          max_value: 3600
        }
      ] as any[]
    }
  ],
  async execute(interaction: any, { services }: any): Promise<InteractionResult> {
    const subcommand = interaction.options.getSubcommand(true);
    if (subcommand !== 'all') {
      await interaction.editReply('Unsupported channel action.');
      return { type: 'IGNORE' };
    }

    const content = interaction.options.getString('message', true).trim();
    if (!content) {
      await interaction.editReply('Provide a message to broadcast.');
      return { type: 'IGNORE' };
    }

    const config = await services.toolsService.getChannelActivityConfig(interaction.guildId);
    const overrideDeleteSeconds = interaction.options.getInteger('delete_after_seconds');
    const deleteAfterSeconds = overrideDeleteSeconds ?? (
      config.enabled ? config.default_delete_seconds : 0
    );

    const result = await services.toolsService.broadcastToGuildChannels(
      interaction.guild,
      content,
      deleteAfterSeconds
    );

    await interaction.editReply(
      [
        `Broadcast attempted in ${result.attempted} channel${result.attempted === 1 ? '' : 's'}.`,
        `Sent: ${result.sent}.`,
        `Failed: ${result.failed}.`,
        deleteAfterSeconds > 0
          ? `Messages will delete after ${deleteAfterSeconds} second${deleteAfterSeconds === 1 ? '' : 's'}.`
          : 'Messages will stay until removed manually.'
      ].join('\n')
    );

    return { type: 'IGNORE' };
  }
};
