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
      name: 'commandmanager',
      description: 'Command manager entrypoint',
      options: [],
      async execute(interaction) {
        await interaction.editReply('Use dashboard command manager to set per-command overrides.');
      }
    },
    {
      name: 'branding',
      description: 'Update guild branding',
      options: [],
      async execute(interaction, { services }) {
        await services.settingsService.setBranding(interaction.guildId, {
          color: '#5865F2',
          accent: 'default'
        });
        await interaction.editReply('Branding updated.');
      }
    },
    {
      name: 'dashboardroles',
      description: 'Set dashboard manager roles',
      options: [],
      async execute(interaction, { services }) {
        const roleIds = interaction.member?.roles?.cache?.map((role) => role.id).slice(0, 3) ?? [];
        await services.settingsService.setDashboardRoles(interaction.guildId, roleIds);
        await interaction.editReply('Dashboard roles updated.');
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
