import {
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ActionRowBuilder,
  ModalBuilder,
  UserSelectMenuBuilder
} from 'discord.js';

const POINTER = '<:Pointer:1502993771317694655>';
const AUTO_ARCHIVE_24H = 1440;
const TICKET_COOLDOWN_MS = 10 * 60 * 1000;

const TICKET_STAFF_ROLE_IDS = [
  '1457403601512169724'
];

const TICKET_LOG_CHANNEL_ID = '1485668403132760243';
const ADD_STAFF_MEMBERS_TO_THREAD = false;

const THREAD_PREFIX_CLOSED = '[CLOSED] ';

const CUSTOM_IDS = {
  ticketTagSelect: 'tickets:tag-select',

  resolvedPrefix: 'tickets:resolved',

  manageUsersPrefix: 'tickets:manage-users',

  manageUsersModal: 'tickets:manage-users-modal',

  addUserSelect: 'tickets:add-user-select',
  removeUserSelect: 'tickets:remove-user-select'
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

const TICKET_COMMAND_NAMES = new Set([
  'ticket',
  'claim',
  'unclaim',
  'close',
  'reopen'
]);

// ───────────────── Cooldown ─────────────────

const cooldownMap = new Map();

function setCooldown(userId) {
  cooldownMap.set(userId, Date.now());
}

function getRemainingCooldown(userId) {
  const closedAt = cooldownMap.get(userId);

  if (!closedAt) return 0;

  const elapsed = Date.now() - closedAt;

  if (elapsed >= TICKET_COOLDOWN_MS) {
    cooldownMap.delete(userId);
    return 0;
  }

  return TICKET_COOLDOWN_MS - elapsed;
}

// ───────────────── Webhook Cache ─────────────────

let cachedLogWebhook = null;

async function getOrCreateLogWebhook(logChannel) {
  if (cachedLogWebhook) return cachedLogWebhook;

  const hooks = await logChannel.fetchWebhooks().catch(() => null);

  const existing = hooks?.find(
    (hook) =>
      hook.owner?.id === logChannel.client.user.id &&
      hook.name === 'Ticket Logs'
  );

  cachedLogWebhook =
    existing ??
    (await logChannel
      .createWebhook({
        name: 'Ticket Logs'
      })
      .catch(() => null));

  return cachedLogWebhook;
}

// ───────────────── Permissions ─────────────────

function isTicketStaffLike(member, guild, userId) {
  if (!member || !guild || !userId) return false;

  if (guild.ownerId === userId) return true;

  if (member.permissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  return TICKET_STAFF_ROLE_IDS.some((roleId) =>
    member.roles?.cache?.has(roleId)
  );
}

function isTicketStaffFromInteraction(interaction) {
  if (!interaction.inGuild()) return false;

  return isTicketStaffLike(
    interaction.member,
    interaction.guild,
    interaction.user?.id
  );
}

async function requireTicketStaff(interaction) {
  if (isTicketStaffFromInteraction(interaction)) return true;

  const payload = {
    content: 'You are not allowed to use ticket commands.'
  };

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
  } else {
    await interaction.reply({
      ...payload,
      ephemeral: true
    });
  }

  return false;
}

// ───────────────── Custom IDs ─────────────────

function buildResolvedCustomId(creatorId) {
  return `${CUSTOM_IDS.resolvedPrefix}:${creatorId}`;
}

function parseResolvedCreatorId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.resolvedPrefix}:`)) {
    return null;
  }

  const creatorId =
    customId.slice(`${CUSTOM_IDS.resolvedPrefix}:`.length);

  return /^\d{16,20}$/.test(creatorId)
    ? creatorId
    : null;
}

function buildManageUsersCustomId(creatorId) {
  return `${CUSTOM_IDS.manageUsersPrefix}:${creatorId}`;
}

function parseManageUsersCreatorId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.manageUsersPrefix}:`)) {
    return null;
  }

  const creatorId =
    customId.slice(`${CUSTOM_IDS.manageUsersPrefix}:`.length);

  return /^\d{16,20}$/.test(creatorId)
    ? creatorId
    : null;
}

function buildManageUsersModalCustomId(creatorId) {
  return `${CUSTOM_IDS.manageUsersModal}:${creatorId}`;
}

function parseManageUsersModalCreatorId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.manageUsersModal}:`)) {
    return null;
  }

  const creatorId =
    customId.slice(`${CUSTOM_IDS.manageUsersModal}:`.length);

  return /^\d{16,20}$/.test(creatorId)
    ? creatorId
    : null;
}

function buildThreadLink(guildId, threadId) {
  return `https://discord.com/channels/${guildId}/${threadId}`;
}

// ───────────────── Thread State ─────────────────

function markThreadNameClosed(name) {
  if (name.startsWith(THREAD_PREFIX_CLOSED)) return name;
  return `${THREAD_PREFIX_CLOSED}${name}`;
}

function markThreadNameOpen(name) {
  if (!name.startsWith(THREAD_PREFIX_CLOSED)) return name;
  return name.slice(THREAD_PREFIX_CLOSED.length);
}

function isThreadNameClosed(name) {
  return name.startsWith(THREAD_PREFIX_CLOSED);
}

// ───────────────── Payload Builders ─────────────────

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
              '# <:Empty:1503044372487471328><:Empty:1503044372487471328><:Empty:1503044372487471328><a:Sparkle2:1503090874417152020><:Ticket1:1503003731887788072><:Ticket2:1503003714213118104><a:Sparkle2:1503090874417152020>'
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

                placeholder: 'Select a ticket category',

                min_values: 1,
                max_values: 1,

                options: TICKET_TAGS.map(
                  ({ label, value, description, emoji }) => ({
                    label,
                    value,
                    description,
                    emoji
                  })
                )
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
              `Thank you for opening a support ticket.\n` +
              `${tag.intro}\n` +
              `A staff member will respond as soon as possible.`
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
              },

              {
                type: COMPONENT_TYPES.Button,

                style: ButtonStyle.Secondary,

                custom_id: buildManageUsersCustomId(creatorId),

                label: 'ADD/REMOVE'
              }
            ]
          }
        ]
      }
    ]
  };
}

// ───────────────── Thread Utilities ─────────────────

function generateThreadName(prefix) {
  const suffix = Math.random()
    .toString(16)
    .slice(2, 6)
    .toUpperCase();

  return `${prefix}-${suffix}`;
}

async function addStaffMembersToThread(thread) {
  const guild = thread.guild;

  await guild.members.fetch().catch(() => null);

  const staffUserIds = new Set();

  for (const roleId of TICKET_STAFF_ROLE_IDS) {
    const role = guild.roles.cache.get(roleId);

    if (!role) continue;

    for (const member of role.members.values()) {
      staffUserIds.add(member.id);
    }
  }

  for (const userId of staffUserIds) {
    await thread.members.add(userId).catch(() => null);
  }
}

async function getCreatorIdFromThread(thread) {
  const messages = await thread.messages
    .fetch({ limit: 30 })
    .catch(() => null);

  if (!messages) return null;

  for (const message of messages.values()) {
    for (const row of message.components ?? []) {
      for (const component of row.components ?? []) {
        const id =
          component.customId ??
          component.custom_id ??
          null;

        const creatorId = parseResolvedCreatorId(id);

        if (creatorId) return creatorId;
      }
    }
  }

  return null;
}

async function hasOpenTicketInChannel(
  parentChannel,
  userId,
  botUserId
) {
  const active = await parentChannel.threads
    .fetchActive()
    .catch(() => null);

  if (!active) return false;

  for (const thread of active.threads.values()) {
    if (thread.type !== ChannelType.PrivateThread) continue;

    if (thread.ownerId !== botUserId) continue;

    if (isThreadNameClosed(thread.name)) continue;

    if (thread.locked || thread.archived) continue;

    const creatorId = await getCreatorIdFromThread(thread);

    if (creatorId === userId) return true;
  }

  return false;
}

async function sendOpeningPing(thread, creatorId) {
  const roleMentions = TICKET_STAFF_ROLE_IDS
    .map((roleId) => `<@&${roleId}>`)
    .join(' ');

  await thread
    .send({
      content: `<@${creatorId}> ${roleMentions}`.trim(),

      allowedMentions: {
        users: [creatorId],
        roles: TICKET_STAFF_ROLE_IDS
      }
    })
    .catch(() => null);
}

// ───────────────── Logging ─────────────────

async function sendTicketLog(
  thread,
  title,
  color,
  lines
) {
  if (!TICKET_LOG_CHANNEL_ID) return;

  const logChannel = await thread.guild.channels
    .fetch(TICKET_LOG_CHANNEL_ID)
    .catch(() => null);

  if (!logChannel?.isTextBased?.()) return;

  const webhook = await getOrCreateLogWebhook(
    logChannel
  ).catch(() => null);

  if (!webhook) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(lines.join('\n'))
    .setTimestamp();

  await webhook
    .send({
      embeds: [embed],
      allowedMentions: { parse: [] }
    })
    .catch(() => null);
}

// ───────────────── Ticket Creation ─────────────────

async function createTicketFromTag(interaction, tag) {
  const parentChannel = interaction.channel;

  if (!parentChannel?.threads?.create) {
    await interaction.editReply({
      content:
        'Tickets can only be created from a text channel panel.'
    });

    return;
  }

  const remaining = getRemainingCooldown(
    interaction.user.id
  );

  if (remaining > 0) {
    const readyAt = Math.floor(
      (Date.now() + remaining) / 1000
    );

    await interaction.editReply({
      content:
        `You recently closed a ticket. ` +
        `You can open another <t:${readyAt}:R>.`
    });

    return;
  }

  if (
    await hasOpenTicketInChannel(
      parentChannel,
      interaction.user.id,
      interaction.client.user.id
    )
  ) {
    await interaction.editReply({
      content:
        'You already have an active ticket in this channel.'
    });

    return;
  }

  const threadName = generateThreadName(
    tag.namePrefix
  );

  const thread = await parentChannel.threads
    .create({
      name: threadName,

      type: ChannelType.PrivateThread,

      invitable: false,

      autoArchiveDuration: AUTO_ARCHIVE_24H,

      reason:
        `Ticket created by ${interaction.user.id} ` +
        `(${tag.value})`
    })
    .catch(() => null);

  if (!thread) {
    await interaction.editReply({
      content:
        'Failed to create ticket thread.'
    });

    return;
  }

  await thread.members
    .add(interaction.user.id)
    .catch(() => null);

  if (ADD_STAFF_MEMBERS_TO_THREAD) {
    await addStaffMembersToThread(thread);
  }

  await sendOpeningPing(
    thread,
    interaction.user.id
  );

  await thread
    .send(
      buildTicketWelcomePayload(
        tag,
        interaction.user.id
      )
    )
    .catch(() => null);

  const createdAtUnix = Math.floor(
    Date.now() / 1000
  );

  await sendTicketLog(
    thread,
    'Ticket Created',
    0x8b2b2b,
    [
      `Created By: <@${interaction.user.id}>`,
      `Created At: <t:${createdAtUnix}:F>`,
      `Ticket Tag: ${tag.label}`,
      `Thread Link: ${buildThreadLink(
        interaction.guildId,
        thread.id
      )}`
    ]
  );

  await interaction.editReply({
    content: `Ticket created: <#${thread.id}>`
  });
}

// ───────────────── Resolve ─────────────────

async function toggleResolved(
  interaction,
  creatorId
) {
  if (
    !interaction.inGuild() ||
    !interaction.channel?.isThread?.()
  ) {
    await interaction.reply({
      content:
        'This button only works inside ticket threads.',

      ephemeral: true
    });

    return;
  }

  if (!isTicketStaffFromInteraction(interaction)) {
    await interaction.reply({
      content:
        'Only support staff can use this button.',

      ephemeral: true
    });

    return;
  }

  const thread = interaction.channel;

  const isClosed = isThreadNameClosed(
    thread.name
  );

  if (!isClosed) {
    await thread
      .setName(markThreadNameClosed(thread.name))
      .catch(() => null);

    await thread.members
      .remove(creatorId)
      .catch(() => null);

    setCooldown(creatorId);

    await sendTicketLog(
      thread,
      'Ticket Resolved',
      0x2fa44f,
      [
        `Resolved By: <@${interaction.user.id}>`,
        `Thread Link: ${buildThreadLink(
          interaction.guildId,
          thread.id
        )}`
      ]
    );

    await interaction.reply({
      content: 'Ticket marked as resolved.',
      ephemeral: true
    });

    return;
  }

  await thread
    .setName(markThreadNameOpen(thread.name))
    .catch(() => null);

  await thread.members
    .add(creatorId)
    .catch(() => null);

  cooldownMap.delete(creatorId);

  await sendTicketLog(
    thread,
    'Ticket Reopened',
    0xdca12d,
    [
      `Reopened By: <@${interaction.user.id}>`,
      `Thread Link: ${buildThreadLink(
        interaction.guildId,
        thread.id
      )}`
    ]
  );

  await interaction.reply({
    content: 'Ticket reopened.',
    ephemeral: true
  });
}

// ───────────────── Manage Users ─────────────────

async function handleManageUsersButton(
  interaction,
  creatorId
) {
  if (
    !interaction.inGuild() ||
    !interaction.channel?.isThread?.()
  ) {
    await interaction.reply({
      content:
        'This button only works inside ticket threads.',

      ephemeral: true
    });

    return;
  }

  if (!isTicketStaffFromInteraction(interaction)) {
    await interaction.reply({
      content:
        'Only support staff can manage users.',

      ephemeral: true
    });

    return;
  }

  const addSelect = new UserSelectMenuBuilder()
    .setCustomId(CUSTOM_IDS.addUserSelect)
    .setPlaceholder('Select user to add')
    .setMinValues(0)
    .setMaxValues(1);

  const removeSelect =
    new UserSelectMenuBuilder()
      .setCustomId(
        CUSTOM_IDS.removeUserSelect
      )
      .setPlaceholder(
        'Select user to remove'
      )
      .setMinValues(0)
      .setMaxValues(1);

  const modal = new ModalBuilder()
    .setCustomId(
      buildManageUsersModalCustomId(
        creatorId
      )
    )
    .setTitle('Manage Ticket Users');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      addSelect
    ),

    new ActionRowBuilder().addComponents(
      removeSelect
    )
  );

  await interaction.showModal(modal);
}

async function handleManageUsersModalSubmit(
  interaction,
  creatorId
) {
  if (
    !interaction.inGuild() ||
    !interaction.channel?.isThread?.()
  ) {
    return;
  }

  const thread = interaction.channel;

  if (!creatorId) {
    await interaction.reply({
      content: 'Invalid ticket state.',
      ephemeral: true
    });
    return;
  }

  if (!isTicketStaffFromInteraction(interaction)) {
    await interaction.reply({
      content: 'Only support staff can manage users.',
      ephemeral: true
    });
    return;
  }

  const addUsers =
    interaction.fields.getSelectedUsers(
      CUSTOM_IDS.addUserSelect
    );

  const removeUsers =
    interaction.fields.getSelectedUsers(
      CUSTOM_IDS.removeUserSelect
    );

  const addUserId =
    addUsers.first()?.id ?? null;

  const removeUserId =
    removeUsers.first()?.id ?? null;

  if (!addUserId && !removeUserId) {
    await interaction.reply({
      content:
        'Please select at least one user.',
      ephemeral: true
    });

    return;
  }

  const results = [];

  // ADD

  if (addUserId) {
    const member =
      await interaction.guild.members
        .fetch(addUserId)
        .catch(() => null);

    if (member) {
      await thread.members
        .add(addUserId)
        .catch(() => null);

      results.push(
        `Added <@${addUserId}>`
      );

      await sendTicketLog(
        thread,
        'User Added',
        0x57f287,
        [
          `Added By: <@${interaction.user.id}>`,
          `Added User: <@${addUserId}>`,
          `Thread Link: ${buildThreadLink(
            interaction.guildId,
            thread.id
          )}`
        ]
      );
    }
  }

  // REMOVE

  if (removeUserId) {
    const member =
      await interaction.guild.members
        .fetch(removeUserId)
        .catch(() => null);

    if (
      member &&
      isTicketStaffLike(
        member,
        interaction.guild,
        member.id
      )
    ) {
      results.push(
        `Cannot remove <@${removeUserId}> because they are support staff/admin/server owner`
      );
    } else {
      await thread.members
        .remove(removeUserId)
        .catch(() => null);

      results.push(
        `Removed <@${removeUserId}>`
      );

      await sendTicketLog(
        thread,
        'User Removed',
        0xed4245,
        [
          `Removed By: <@${interaction.user.id}>`,
          `Removed User: <@${removeUserId}>`,
          `Thread Link: ${buildThreadLink(
            interaction.guildId,
            thread.id
          )}`
        ]
      );
    }
  }

  await interaction.reply({
    content: results.join('\n'),
    ephemeral: true
  });
}

// ───────────────── Commands ─────────────────

async function executeTicketPanelCommand(
  interaction
) {
  if (
    !(await requireTicketStaff(interaction))
  ) {
    return;
  }

  await interaction.channel.send(
    buildTicketPanelPayload()
  );

  await interaction.editReply(
    'Ticket panel sent in this channel.'
  );
}

async function executePendingTicketCommand(
  interaction
) {
  if (
    !(await requireTicketStaff(interaction))
  ) {
    return;
  }

  await interaction.editReply(
    'This command is intentionally unused.'
  );
}

// ───────────────── Router ─────────────────

async function handleTicketTagSelect(
  interaction
) {
  await interaction.deferReply({
    ephemeral: true
  });

  const [selectedValue] =
    interaction.values;

  const selectedTag = TICKET_TAGS.find(
    (tag) => tag.value === selectedValue
  );

  if (!selectedTag) {
    await interaction.editReply({
      content:
        'Unknown ticket category selected.'
    });

    return;
  }

  await createTicketFromTag(
    interaction,
    selectedTag
  );
}

async function handleButton(interaction) {
  const resolvedCreatorId =
    parseResolvedCreatorId(
      interaction.customId
    );

  if (resolvedCreatorId) {
    await toggleResolved(
      interaction,
      resolvedCreatorId
    );

    return;
  }

  const manageCreatorId =
    parseManageUsersCreatorId(
      interaction.customId
    );

  if (manageCreatorId) {
    await handleManageUsersButton(
      interaction,
      manageCreatorId
    );
  }
}

async function handleModalSubmit(
  interaction
) {
  const creatorId =
    parseManageUsersModalCreatorId(
      interaction.customId
    );

  if (creatorId) {
    await handleManageUsersModalSubmit(
      interaction,
      creatorId
    );
  }
}

// ───────────────── Builder ─────────────────

function buildTicketCommand(
  name,
  description,
  execute
) {
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

// ───────────────── Export ─────────────────

export default {
  name: 'tickets',

  configSchema: {
    type: 'object',
    properties: {}
  },

  commands: [
    buildTicketCommand(
      'ticket',
      'Send the ticket creation panel',
      executeTicketPanelCommand
    ),

    buildTicketCommand(
      'claim',
      'Claim the current ticket',
      executePendingTicketCommand
    ),

    buildTicketCommand(
      'unclaim',
      'Unclaim the current ticket',
      executePendingTicketCommand
    ),

    buildTicketCommand(
      'close',
      'Close the current ticket',
      executePendingTicketCommand
    ),

    buildTicketCommand(
      'reopen',
      'Reopen the current ticket',
      executePendingTicketCommand
    )
  ],

  events: [
    {
      name: 'interactionCreate',

      async execute(interaction) {
        if (
          interaction.isChatInputCommand() &&
          TICKET_COMMAND_NAMES.has(
            interaction.commandName
          )
        ) {
          return;
        }

        if (
          interaction.isStringSelectMenu() &&
          interaction.customId ===
            CUSTOM_IDS.ticketTagSelect
        ) {
          await handleTicketTagSelect(
            interaction
          );
        }

        else if (interaction.isButton()) {
          await handleButton(interaction);
        }

        else if (
          interaction.isModalSubmit()
        ) {
          await handleModalSubmit(
            interaction
          );
        }
      }
    }
  ]
};
