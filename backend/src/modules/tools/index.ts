import type { BotContext, InteractionResult, ModuleDefinition } from '../../types/index.js';

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
    },
    channels_activity: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        default_delete_seconds: { type: 'number' }
      }
    }
  }
} as const;

export default {
  name: 'tools',
  configSchema: TOOLS_SCHEMA,
  commands: [
    {
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
      async execute(interaction: any, { services }: BotContext): Promise<InteractionResult> {
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
    }
  ],
  events: [
    {
      name: 'messageCreate',
      async execute(message: any, { services, placeholderEngine }: BotContext): Promise<void> {
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
      async execute(oldMember: any, newMember: any, { services }: BotContext): Promise<void> {
        await services.staffListService.handleRoleChange(oldMember, newMember);
      }
    }
  ]
} satisfies ModuleDefinition;
