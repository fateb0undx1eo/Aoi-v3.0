import { MessageFlags, PermissionFlagsBits } from 'discord.js';

// Put the role IDs allowed to use ticket staff commands here.
// Server admins and the guild owner are always allowed.
const TICKET_STAFF_ROLE_IDS = [
  // '123456789012345678'
];

const CUSTOM_IDS = {
  ticketTagSelect: 'tickets:tag-select'
};

const COMPONENT_TYPES = {
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
  TextDisplay: 10,
  Container: 17,
  Label: 18
};

const TICKET_TAGS = [
  {
    label: 'General Support',
    value: 'general_support',
    description: 'Help with server related questions',
    emoji: { name: 'Wump', id: '1503037895382929580' }
  },
  {
    label: 'Report a User',
    value: 'report_user',
    description: 'Report rule breaking members',
    emoji: { name: 'Exclamation', id: '1503038935645945876' }
  },
  {
    label: 'Claim Booster Perks',
    value: 'claim_booster_perks',
    description: 'Claim your booster rewards',
    emoji: { name: 'Heart', id: '1503038224044527739' }
  },
  {
    label: 'Partnership Requests',
    value: 'partnership_requests',
    description: 'Inquiries regarding collaborations',
    emoji: { name: 'Fistbump', id: '1503043689281355896' }
  }
];

const TICKET_COMMAND_NAMES = new Set(['ticket', 'claim', 'unclaim', 'close', 'reopen']);

function isTicketStaff(interaction) {
  if (!interaction.inGuild()) return false;
  if (interaction.guild?.ownerId === interaction.user?.id) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;

  const memberRoles = interaction.member?.roles?.cache;
  if (!memberRoles) return false;

  return TICKET_STAFF_ROLE_IDS.some((roleId) => memberRoles.has(roleId));
}

async function requireTicketStaff(interaction) {
  if (isTicketStaff(interaction)) return true;

  const response = {
    content: 'You are not allowed to use ticket commands.',
    ephemeral: true
  };

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content: response.content });
  } else {
    await interaction.reply(response);
  }

  return false;
}

function buildTicketPanelPayload() {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [
      {
        type: COMPONENT_TYPES.Container,
        components: [
          {
            type: COMPONENT_TYPES.TextDisplay,
            content: '# <:Empty:1503044372487471328><:Empty:1503044372487471328><:Empty:1503044372487471328><:Empty:1503044372487471328><:Ticket1:1503003731887788072><:Ticket2:1503003714213118104>'
          },
          {
            type: COMPONENT_TYPES.TextDisplay,
            content: '**Need help with something?**\nCreate a support ticket by selecting a category below and our staff team will assist you as soon as possible.'
          },
          {
            type: COMPONENT_TYPES.ActionRow,
            components: [
              {
                type: COMPONENT_TYPES.StringSelect,
                custom_id: CUSTOM_IDS.ticketTagSelect,
                placeholder: 'Select a ticket tag',
                min_values: 1,
                max_values: 1,
                options: TICKET_TAGS
              }
            ]
          }
        ]
      }
    ]
  };
}

async function executeTicketPanelCommand(interaction) {
  if (!(await requireTicketStaff(interaction))) return;

  await interaction.channel.send(buildTicketPanelPayload());
  await interaction.editReply('Ticket panel sent in this channel.');
}

async function executePendingTicketCommand(interaction) {
  if (!(await requireTicketStaff(interaction))) return;

  await interaction.editReply('This ticket command is registered, but its behavior is not wired yet.');
}

async function handleTicketTagSelect(interaction) {
  if (!interaction.isStringSelectMenu() || interaction.customId !== CUSTOM_IDS.ticketTagSelect) return;

  const [selectedValue] = interaction.values;
  const selectedTag = TICKET_TAGS.find((tag) => tag.value === selectedValue);

  await interaction.reply({
    content: `Selected ticket tag: ${selectedTag?.label ?? 'Unknown'}.`,
    ephemeral: true
  });
}

function buildTicketCommand(name, description, execute) {
  return {
    name,
    description,
    ephemeral: true,
    options: [],
    async execute(interaction) {
      await execute(interaction);
    }
  };
}

export default {
  name: 'tickets',
  configSchema: {
    type: 'object',
    properties: {}
  },
  commands: [
    buildTicketCommand('ticket', 'Send the ticket creation panel', executeTicketPanelCommand),
    buildTicketCommand('claim', 'Claim the current ticket', executePendingTicketCommand),
    buildTicketCommand('unclaim', 'Unclaim the current ticket', executePendingTicketCommand),
    buildTicketCommand('close', 'Close the current ticket', executePendingTicketCommand),
    buildTicketCommand('reopen', 'Reopen the current ticket', executePendingTicketCommand)
  ],
  events: [
    {
      name: 'interactionCreate',
      async execute(interaction) {
        if (interaction.isChatInputCommand() && TICKET_COMMAND_NAMES.has(interaction.commandName)) {
          return;
        }

        await handleTicketTagSelect(interaction);
      }
    }
  ]
};
