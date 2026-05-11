import {
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits
} from 'discord.js';

const POINTER = '<:Pointer:1502993771317694655>';
const AUTO_ARCHIVE_24H = 1440;

// Put the role IDs allowed to use ticket staff commands here.
// Server admins and the guild owner are always allowed.
const TICKET_STAFF_ROLE_IDS = ['1457403601512169724'];

// Put the ticket log channel ID here.
const TICKET_LOG_CHANNEL_ID = '1485668403132760243';

const CUSTOM_IDS = {
  ticketTagSelect: 'tickets:tag-select',
  resolvedPrefix: 'tickets:resolved'
};

const COMPONENT_TYPES = {
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
  TextDisplay: 10,
  Container: 17
};

const TICKET_TAGS = [
  {
    label: 'General Support',
    value: 'general_support',
    description: 'Help with server-related questions',
    emoji: { name: 'Wump', id: '1503037895382929580' },
    namePrefix: 'support',
    intro: 'You opened this ticket for general server support.'
  },
  {
    label: 'Report a User',
    value: 'report_user',
    description: 'Report rule-breaking members',
    emoji: { name: 'Exclamation', id: '1503038935645945876' },
    namePrefix: 'report',
    intro: 'You opened this ticket to report a member.'
  },
  {
    label: 'Partnership Requests',
    value: 'partnership_requests',
    description: 'Inquiries regarding collaborations',
    emoji: { name: 'Fistbump', id: '1503043689281355896' },
    namePrefix: 'partner',
    intro: 'You opened this ticket for partnership or collaboration inquiries.'
  },
  {
    label: 'Booster Perk Claims',
    value: 'booster_perk_claims',
    description: 'Claim your booster rewards',
    emoji: { name: 'Heart', id: '1503038224044527739' },
    namePrefix: 'perk',
    intro: 'You opened this ticket to claim your booster perks.'
  }
];

const TICKET_COMMAND_NAMES = new Set(['ticket', 'claim', 'unclaim', 'close', 'reopen']);

function isTicketStaffLike(member, guild, userId) {
  if (!member || !guild || !userId) return false;
  if (guild.ownerId === userId) return true;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  return TICKET_STAFF_ROLE_IDS.some((roleId) => member.roles?.cache?.has(roleId));
}

function isTicketStaffFromInteraction(interaction) {
  if (!interaction.inGuild()) return false;
  return isTicketStaffLike(interaction.member, interaction.guild, interaction.user?.id);
}

function buildResolvedCustomId(creatorId) {
  return `${CUSTOM_IDS.resolvedPrefix}:${creatorId}`;
}

function parseResolvedCreatorId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.resolvedPrefix}:`)) return null;
  const creatorId = customId.slice(`${CUSTOM_IDS.resolvedPrefix}:`.length);
  return /^\d{16,20}$/.test(creatorId) ? creatorId : null;
}

function buildThreadLink(guildId, threadId) {
  return `https://discord.com/channels/${guildId}/${threadId}`;
}

async function requireTicketStaff(interaction) {
  if (isTicketStaffFromInteraction(interaction)) return true;
  const payload = { content: 'You are not allowed to use ticket commands.' };
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
  } else {
    await interaction.reply({ ...payload, ephemeral: true });
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
            content:
              '# <:Empty:1503044372487471328><:Empty:1503044372487471328><:Empty:1503044372487471328><:Ticket1:1503003731887788072><:Ticket2:1503003714213118104>'
          },
          {
            type: COMPONENT_TYPES.TextDisplay,
            content:
              '**Need help with something?**\nCreate a support ticket by selecting a category below and our staff team will assist you as soon as possible.'
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
                options: TICKET_TAGS.map(({ label, value, description, emoji }) => ({
                  label,
                  value,
                  description,
                  emoji
                }))
              }
            ]
          }
        ]
      }
    ]
  };
}

function buildTicketWelcomePayload(tag, creatorId) {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [
      {
        type: COMPONENT_TYPES.Container,
        components: [
          {
            type: COMPONENT_TYPES.TextDisplay,
            content: `# ${tag.label}`
          },
          {
            type: COMPONENT_TYPES.TextDisplay,
            content:
              `${POINTER} Thank you for opening a support ticket.\n` +
              `${POINTER} ${tag.intro}\n` +
              `${POINTER} A staff member will respond as soon as possible.`
          },
          {
            type: COMPONENT_TYPES.TextDisplay,
            content:
              `## General Guidelines\n` +
              `${POINTER} Explain your issue clearly and include full details.\n` +
              `${POINTER} Share screenshots, user IDs, message links, and evidence where relevant.\n` +
              `${POINTER} Keep all context in this thread so staff can help quickly.\n` +
              `${POINTER} Avoid pings and wait for a response from staff.`
          },
          {
            type: COMPONENT_TYPES.ActionRow,
            components: [
              {
                type: COMPONENT_TYPES.Button,
                style: ButtonStyle.Secondary,
                custom_id: buildResolvedCustomId(creatorId),
                label: 'RESOLVED'
              }
            ]
          }
        ]
      }
    ]
  };
}

async function fetchAllThreadNames(parentChannel) {
  const names = new Set();
  const active = await parentChannel.threads.fetchActive().catch(() => null);
  for (const thread of active?.threads?.values?.() ?? []) names.add(thread.name);

  const archivedPrivate = await parentChannel.threads.fetchArchived({ type: 'private', limit: 100 }).catch(() => null);
  for (const thread of archivedPrivate?.threads?.values?.() ?? []) names.add(thread.name);

  const archivedPublic = await parentChannel.threads.fetchArchived({ type: 'public', limit: 100 }).catch(() => null);
  for (const thread of archivedPublic?.threads?.values?.() ?? []) names.add(thread.name);

  return names;
}

async function generateUniqueThreadName(parentChannel, prefix) {
  const existingNames = await fetchAllThreadNames(parentChannel);
  for (let tries = 0; tries < 50; tries += 1) {
    const id = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${prefix}-${id}`;
    if (!existingNames.has(candidate)) return candidate;
  }
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

async function addStaffMembersToThread(thread) {
  const guild = thread.guild;
  await guild.members.fetch().catch(() => null);
  const staffUserIds = new Set();
  for (const roleId of TICKET_STAFF_ROLE_IDS) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;
    for (const member of role.members.values()) staffUserIds.add(member.id);
  }

  for (const userId of staffUserIds) {
    await thread.members.add(userId).catch(() => null);
  }
}

async function getCreatorIdFromThread(thread) {
  const messages = await thread.messages.fetch({ limit: 30 }).catch(() => null);
  if (!messages) return null;
  for (const message of messages.values()) {
    for (const row of message.components ?? []) {
      for (const component of row.components ?? []) {
        const creatorId = parseResolvedCreatorId(component.customId);
        if (creatorId) return creatorId;
      }
    }
  }
  return null;
}

async function hasOpenTicketInChannel(parentChannel, userId, botUserId) {
  const active = await parentChannel.threads.fetchActive().catch(() => null);
  if (!active) return false;

  for (const thread of active.threads.values()) {
    if (thread.type !== ChannelType.PrivateThread) continue;
    if (thread.ownerId !== botUserId) continue;
    if (thread.locked || thread.archived) continue;

    const creatorId = await getCreatorIdFromThread(thread);
    if (creatorId !== userId) continue;

    const members = await thread.members.fetch().catch(() => null);
    if (members?.has(userId)) return true;
  }

  return false;
}

async function sendOpeningPing(thread, creatorId) {
  const roleMentions = TICKET_STAFF_ROLE_IDS.map((roleId) => `<@&${roleId}>`).join(' ');
  const pingMessage = await thread.send({
    content: `<@${creatorId}> ${roleMentions}`.trim(),
    allowedMentions: { users: [creatorId], roles: TICKET_STAFF_ROLE_IDS }
  }).catch(() => null);

  if (!pingMessage) return;
  setTimeout(() => {
    pingMessage.delete().catch(() => null);
  }, 4000);
}

async function getOrCreateLogWebhook(logChannel) {
  const hooks = await logChannel.fetchWebhooks().catch(() => null);
  const existing = hooks?.find((hook) => hook.owner?.id === logChannel.client.user.id && hook.name === 'Ticket Logs');
  if (existing) return existing;
  return logChannel.createWebhook({ name: 'Ticket Logs' });
}

async function sendTicketLog(thread, title, color, lines) {
  if (!TICKET_LOG_CHANNEL_ID) return;
  const logChannel = await thread.guild.channels.fetch(TICKET_LOG_CHANNEL_ID).catch(() => null);
  if (!logChannel?.isTextBased?.()) return;

  const webhook = await getOrCreateLogWebhook(logChannel).catch(() => null);
  if (!webhook) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(lines.join('\n'))
    .setTimestamp();

  await webhook.send({
    embeds: [embed],
    allowedMentions: { parse: [] }
  }).catch(() => null);
}

async function createTicketFromTag(interaction, tag) {
  const parentChannel = interaction.channel;
  if (!parentChannel?.threads?.create) {
    await interaction.reply({ content: 'Tickets can only be created from a text channel panel.', ephemeral: true });
    return;
  }

  if (await hasOpenTicketInChannel(parentChannel, interaction.user.id, interaction.client.user.id)) {
    await interaction.reply({
      content: 'You already have an active ticket in this channel. Resolve it first before opening another.',
      ephemeral: true
    });
    return;
  }

  const threadName = await generateUniqueThreadName(parentChannel, tag.namePrefix);
  const thread = await parentChannel.threads.create({
    name: threadName,
    type: ChannelType.PrivateThread,
    invitable: false,
    autoArchiveDuration: AUTO_ARCHIVE_24H,
    reason: `Ticket created by ${interaction.user.id} (${tag.value})`
  }).catch(() => null);

  if (!thread) {
    await interaction.reply({ content: 'Failed to create ticket thread. Check bot thread permissions.', ephemeral: true });
    return;
  }

  await thread.members.add(interaction.user.id).catch(() => null);
  await addStaffMembersToThread(thread);
  await sendOpeningPing(thread, interaction.user.id);
  await thread.send(buildTicketWelcomePayload(tag, interaction.user.id)).catch(() => null);

  const createdAtUnix = Math.floor(Date.now() / 1000);
  await sendTicketLog(thread, 'Ticket Created', 0x8b2b2b, [
    `${POINTER} Created By: <@${interaction.user.id}>`,
    `${POINTER} Created At: <t:${createdAtUnix}:F>`,
    `${POINTER} Ticket Tag: ${tag.label}`,
    `${POINTER} Thread Link: ${buildThreadLink(interaction.guildId, thread.id)}`
  ]);

  await interaction.reply({
    content: `Ticket created: <#${thread.id}>`,
    ephemeral: true
  });
}

async function toggleResolved(interaction, creatorId) {
  if (!interaction.inGuild() || !interaction.channel?.isThread?.()) {
    await interaction.reply({ content: 'This button only works inside ticket threads.', ephemeral: true });
    return;
  }

  if (!isTicketStaffFromInteraction(interaction)) {
    await interaction.reply({ content: 'Only support staff can use this button.', ephemeral: true });
    return;
  }

  const thread = interaction.channel;
  const memberMap = await thread.members.fetch().catch(() => null);
  const isOpen = Boolean(memberMap?.has(creatorId));

  if (isOpen) {
    await thread.members.remove(creatorId).catch(() => null);
    await sendTicketLog(thread, 'Ticket Resolved', 0x2fa44f, [
      `${POINTER} Ticket was resolved.`,
      `${POINTER} Thread Link: ${buildThreadLink(interaction.guildId, thread.id)}`
    ]);
    await interaction.reply({ content: 'Ticket marked as resolved (creator removed).', ephemeral: true });
    return;
  }

  await thread.members.add(creatorId).catch(() => null);
  await sendTicketLog(thread, 'Ticket Reopened', 0xdca12d, [
    `${POINTER} Ticket was reopened.`,
    `${POINTER} Thread Link: ${buildThreadLink(interaction.guildId, thread.id)}`
  ]);
  await interaction.reply({ content: 'Ticket reopened (creator re-added).', ephemeral: true });
}

async function executeTicketPanelCommand(interaction) {
  if (!(await requireTicketStaff(interaction))) return;
  await interaction.channel.send(buildTicketPanelPayload());
  await interaction.editReply('Ticket panel sent in this channel.');
}

async function executePendingTicketCommand(interaction) {
  if (!(await requireTicketStaff(interaction))) return;
  await interaction.editReply('This command is intentionally unused in the current ticket workflow.');
}

async function handleTicketTagSelect(interaction) {
  if (!interaction.isStringSelectMenu() || interaction.customId !== CUSTOM_IDS.ticketTagSelect) return;
  const [selectedValue] = interaction.values;
  const selectedTag = TICKET_TAGS.find((tag) => tag.value === selectedValue);
  if (!selectedTag) {
    await interaction.reply({ content: 'Unknown ticket category selected.', ephemeral: true });
    return;
  }
  await createTicketFromTag(interaction, selectedTag);
}

async function handleResolvedButton(interaction) {
  if (!interaction.isButton()) return;
  const creatorId = parseResolvedCreatorId(interaction.customId);
  if (!creatorId) return;
  await toggleResolved(interaction, creatorId);
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
        if (interaction.isChatInputCommand() && TICKET_COMMAND_NAMES.has(interaction.commandName)) return;
        await handleTicketTagSelect(interaction);
        await handleResolvedButton(interaction);
      }
    }
  ]
};
