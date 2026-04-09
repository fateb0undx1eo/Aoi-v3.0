const TOOLS_SCHEMA = {
  type: 'object',
  properties: {
    autoresponder_enabled: { type: 'boolean' },
    embed_creator_enabled: { type: 'boolean' },
    sticky_enabled: { type: 'boolean' },
    staff_list: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        channel_id: { type: 'string' },
        update_mode: { type: 'string' },
        existing_message_link: { type: 'string' },
        intro_text: { type: 'string' },
        auto_update_on_role_change: { type: 'boolean' },
        show_join_date: { type: 'boolean' },
        interval_value: { type: 'number' },
        interval_unit: { type: 'string' },
        staff_role_ids: { type: 'array', items: { type: 'string' } },
        rank_tier_role_ids: { type: 'array', items: { type: 'string' } }
      }
    }
  }
};

export default {
  name: 'tools',
  configSchema: TOOLS_SCHEMA,
  commands: [
    {
      name: 'autoresponder',
      description: 'Create or update an autoresponder',
      options: [],
      async execute(interaction, { services }) {
        await services.toolsService.upsertAutoresponder({
          guild_id: interaction.guildId,
          trigger_pattern: 'hello',
          response_template: 'Hi {user.username}',
          match_type: 'contains',
          enabled: true
        });
        await interaction.editReply('Autoresponder updated.');
      }
    },
    {
      name: 'embed',
      description: 'Save live embed template',
      options: [],
      async execute(interaction, { services }) {
        await services.toolsService.upsertEmbedTemplate({
          guild_id: interaction.guildId,
          name: 'default',
          payload: {
            title: 'Template Title',
            description: 'Template body'
          }
        });
        await interaction.editReply('Embed template saved.');
      }
    },
    {
      name: 'sticky',
      description: 'Set sticky message for current channel',
      options: [],
      async execute(interaction, { services }) {
        await services.toolsService.upsertSticky({
          guild_id: interaction.guildId,
          channel_id: interaction.channelId,
          message_template: 'Please read the rules.',
          enabled: true
        });
        await interaction.editReply('Sticky message configured.');
      }
    }
  ],
  events: [
    {
      name: 'messageCreate',
      async execute(message, { services, placeholderEngine }) {
        if (!message.guild || message.author.bot) return;

        const autoresponders = await services.toolsService.listAutoresponders(message.guild.id);
        for (const row of autoresponders) {
          if (!row.enabled) continue;
          const content = message.content.toLowerCase();
          const trigger = String(row.trigger_pattern).toLowerCase();
          const matched = row.match_type === 'exact' ? content === trigger : content.includes(trigger);
          if (!matched) continue;

          const rendered = placeholderEngine.render(row.response_template, {
            user: {
              id: message.author.id,
              username: message.author.username
            }
          });
          await message.channel.send({ content: rendered });
        }
      }
    },
    {
      name: 'guildMemberUpdate',
      async execute(oldMember, newMember, { services }) {
        await services.staffListService.handleRoleChange(oldMember, newMember);
      }
    }
  ]
};
