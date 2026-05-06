const SETTINGS_SCHEMA = {
  type: 'object',
  properties: {
    dashboard_roles: { type: 'array', items: { type: 'string' } },
    branding: { type: 'object' },
    command_manager: { type: 'object' },
    error_logs: { type: 'object' }
  }
};

export default {
  name: 'settings',
  configSchema: SETTINGS_SCHEMA,
  commands: [
    {
      name: 'prefix',
      description: 'Update prefix',
      options: [],
      async execute(interaction, { services }) {
        await services.settingsService.setPrefix(interaction.guildId, '!');
        await interaction.editReply('Prefix updated.');
      }
    },
    {
      name: 'errorlogs',
      description: 'Configure error log channel',
      options: [],
      async execute(interaction, { services, configCache }) {
        await services.configService.upsertLogsConfig({
          guild_id: interaction.guildId,
          event_name: 'error',
          channel_id: interaction.channelId,
          enabled: true
        });
        await configCache.refreshGuild(interaction.guildId);
        await interaction.editReply('Error logs enabled for this channel.');
      }
    }
  ],
  events: []
};
