import {
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits
} from 'discord.js';

import { 
  TICKET_STAFF_ROLE_IDS,
  TICKET_LOG_CHANNEL_ID,
  TICKET_TAGS,
  TICKET_COMMAND_NAMES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  LOG_COLORS,
  COMPONENT_TYPES,
  CUSTOM_IDS,
  DEFAULT_ARCHIVE_DURATION
} from './utils/constants.js';
import { 
  parseResolvedCreatorId,
  parseAddUsersThreadId,
  parseRemoveUsersThreadId,
  parseAddUsersModalThreadId,
  parseRemoveUsersModalThreadId
} from './utils/custom-id-utils.js';
import { createTicketFromTag } from './handlers/ticket-creation.js';
import { 
  handleResolvedButton,
  handleResolvedConfirmYes,
  handleResolvedConfirmNo
} from './handlers/ticket-resolution.js';
import { 
  handleAddUsersButton,
  handleRemoveUsersButton,
  handleAddUsersModalSubmit,
  handleRemoveUsersModalSubmit
} from './handlers/user-management.js';
import { executeTicketPanelCommand } from './commands/ticket-command.js';
import { ticketService } from './services/ticket-service.js';
import { webhookService } from './services/webhook-service.js';
import { isTicketStaffFromInteraction, isAdminOrOwnerFromInteraction } from './utils/permissions.js';
import { buildTicketPanelPayload } from './components/payloads.js';
import { buildUserManagementPayload } from './components/payloads.js';
import { buildThreadLink, buildTicketMentions, markThreadNameOpen, markThreadNameClosed, isThreadNameClosed, generateThreadName } from './utils/thread-utils.js';

const POINTER = '<:Pointer:1502993771317694655>';
const TICKET_COOLDOWN_MS = 10 * 60 * 1000;
const TICKET_CREATION_LOCK_MS = 8000;
const ADD_STAFF_MEMBERS_TO_THREAD = false;
const THREAD_PREFIX_CLOSED = '[CLOSED] ';

const cooldownMap = new Map();
const creationLockMap = new Map();

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

function hasActiveCreationLock(userId) {
  const lockedAt = creationLockMap.get(userId);
  if (!lockedAt) return false;
  if (Date.now() - lockedAt >= TICKET_CREATION_LOCK_MS) {
    creationLockMap.delete(userId);
    return false;
  }
  return true;
}

function acquireCreationLock(userId) {
  creationLockMap.set(userId, Date.now());
}

function releaseCreationLock(userId) {
  creationLockMap.delete(userId);
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
    (await logChannel.createWebhook({ name: 'Ticket Logs' }).catch(() => null));

  return cachedLogWebhook;
}

// ───────────────── Permissions ─────────────────

function isTicketStaffLike(member, guild, userId) {
  if (!member || !guild || !userId) return false;
  if (guild.ownerId === userId) return true;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  return TICKET_STAFF_ROLE_IDS.some((roleId) => member.roles?.cache?.has(roleId));
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

// ───────────────── Custom IDs ─────────────────

// ───────────────── Thread State ─────────────────

// ───────────────── Thread Utilities ─────────────────

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

  await Promise.all(
    [...staffUserIds].map((userId) => thread.members.add(userId).catch(() => null))
  );
}

// FIX: More robust creator detection — also checks thread starter message
async function getCreatorIdFromThread(thread) {
  const messages = await thread.messages.fetch({ limit: 30 }).catch(() => null);
  if (!messages) return null;

  for (const message of messages.values()) {
    for (const row of message.components ?? []) {
      for (const component of row.components ?? []) {
        const id = component.customId ?? component.custom_id ?? null;
        const creatorId = parseResolvedCreatorId(id);
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
    if (isThreadNameClosed(thread.name)) continue;
    if (thread.locked || thread.archived) continue;

    const creatorId = await getCreatorIdFromThread(thread);
    if (creatorId === userId) return true;
  }

  return false;
}


// ───────────────── Logging ─────────────────

// FIX: Logs are now two separate messages (Created + Resolved), never edited into one another.
// We find them independently by title so we can update the right one.

async function getLogWebhookAndChannel(guild) {
  if (!TICKET_LOG_CHANNEL_ID) return { webhook: null, logChannel: null };

  const logChannel = await guild.channels.fetch(TICKET_LOG_CHANNEL_ID).catch(() => null);
  if (!logChannel?.isTextBased?.()) return { webhook: null, logChannel: null };

  const webhook = await getOrCreateLogWebhook(logChannel).catch(() => null);
  return { webhook, logChannel };
}

async function sendTicketLog(thread, title, color, lines) {
  const { webhook } = await getLogWebhookAndChannel(thread.guild);
  if (!webhook) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(lines.join('\n'));

  await webhook
    .send({ embeds: [embed], allowedMentions: { parse: [] } })
    .catch(() => null);
}

// FIX: Finds a log message strictly by title — so Created and Resolved are separate.
async function findTicketLogMessageByTitle(logChannel, threadLink, title) {
  const messages = await logChannel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return null;

  for (const message of messages.values()) {
    const embed = message.embeds?.[0];
    if (!embed?.description) continue;
    if (!embed.description.includes(threadLink)) continue;
    if (embed.title === title) return message;
  }

  return null;
}

function parseLogDescriptionField(description, label) {
  const match = description.match(new RegExp(`${label}:\\s*(.+)`));
  return match?.[1]?.trim() ?? null;
}

// FIX: Sends a new "Created" log message — never updates an existing one on open,
// so Created and Resolved remain two separate messages.
async function sendCreatedLog(thread, { creatorId, tagLabel }) {
  const createdAtUnix = Math.floor(Date.now() / 1000);
  const threadLink = buildThreadLink(thread.guildId, thread.id);

  const lines = [
    `${POINTER} Created By: <@${creatorId}>`,
    `${POINTER} Created At: <t:${createdAtUnix}:F>`,
    `${POINTER} Ticket Tag: ${tagLabel}`,
    `${POINTER} Thread Link: ${threadLink}`
  ];

  await sendTicketLog(thread, 'Created', 0x8b2b2b, lines);
}

// FIX: Finds or creates a separate "Resolved" log message — does not touch the "Created" one.
async function upsertResolvedLog(thread, { creatorId, resolverId, tagLabel }) {
  const { webhook, logChannel } = await getLogWebhookAndChannel(thread.guild);
  if (!webhook || !logChannel) return;

  const threadLink = buildThreadLink(thread.guildId, thread.id);
  const now = Math.floor(Date.now() / 1000);

  const lines = [
    `${POINTER} Resolved By: <@${resolverId}>`,
    `${POINTER} Resolved At: <t:${now}:F>`,
    `${POINTER} Created By: <@${creatorId}>`,
    `${POINTER} Ticket Tag: ${tagLabel}`,
    `${POINTER} Thread Link: ${threadLink}`
  ];

  const existing = await findTicketLogMessageByTitle(logChannel, threadLink, 'Resolved');

  if (existing) {
    // Update the existing Resolved message
    const embed = new EmbedBuilder()
      .setTitle('Resolved')
      .setColor(0x2fa44f)
      .setDescription(lines.join('\n'));

    await webhook
      .editMessage(existing.id, { embeds: [embed], allowedMentions: { parse: [] } })
      .catch(() => null);
  } else {
    // Send a new Resolved message alongside the Created one
    await sendTicketLog(thread, 'Resolved', 0x2fa44f, lines);
  }
}

// ───────────────── Ticket Creation ─────────────────

// ───────────────── Resolve ─────────────────

// ───────────────── Manage Users ─────────────────





// ───────────────── Router ─────────────────

async function handleTicketTagSelect(interaction) {
  if (hasActiveCreationLock(interaction.user.id)) {
    await interaction.reply({
      content: 'A ticket creation is already in progress. Please wait a few seconds and try again.',
      ephemeral: true
    });
    return;
  }

  acquireCreationLock(interaction.user.id);
  await interaction.deferReply({ ephemeral: true });

  try {
    const [selectedValue] = interaction.values;
    const selectedTag = TICKET_TAGS.find((tag) => tag.value === selectedValue);

    if (!selectedTag) {
      await interaction.editReply({ content: 'Unknown ticket category selected.' });
      return;
    }

    await createTicketFromTag(interaction, selectedTag);
  } finally {
    releaseCreationLock(interaction.user.id);
  }
}

async function handleButton(interaction) {
  const resolvedCreatorId = parseResolvedCreatorId(interaction.customId);
  if (resolvedCreatorId) {
    await handleResolvedButton(interaction, resolvedCreatorId);
    return;
  }

  const addThreadId = parseAddUsersThreadId(interaction.customId);
  if (addThreadId) {
    await handleAddUsersButton(interaction, addThreadId);
    return;
  }

  const removeThreadId = parseRemoveUsersThreadId(interaction.customId);
  if (removeThreadId) {
    await handleRemoveUsersButton(interaction, removeThreadId);
  }
}

async function handleModalSubmit(interaction) {
  const addThreadId = parseAddUsersModalThreadId(interaction.customId);
  if (addThreadId) {
    await handleAddUsersModalSubmit(interaction, addThreadId);
    return;
  }

  const removeThreadId = parseRemoveUsersModalThreadId(interaction.customId);
  if (removeThreadId) {
    await handleRemoveUsersModalSubmit(interaction, removeThreadId);
  }
}

// ───────────────── Builder ─────────────────

function buildTicketCommand(name, description, execute, options = []) {
  return {
    name,
    description,
    ephemeral: true,
    options,
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
      'Manage the ticket system',
      async (interaction) => {
        await executeTicketPanelCommand(interaction);
      },
      [
        {
          name: 'panel',
          type: 1,
          description: 'Send the ticket creation panel'
        },
        {
          name: 'manage',
          type: 2,
          description: 'Ticket management controls',
          options: [
            {
              name: 'users',
              type: 1,
              description: 'Open add/remove user controls for this ticket thread'
            }
          ]
        }
      ]
    )
  ],

  events: [
    {
      name: 'interactionCreate',

      async execute(interaction) {
        // Handle interactions through the new router
        if (interaction.isChatInputCommand() && TICKET_COMMAND_NAMES.has(interaction.commandName)) {
          // Commands are now handled by the new command system
          return;
        }

        if (
          interaction.isStringSelectMenu() &&
          interaction.customId === CUSTOM_IDS.ticketTagSelect
        ) {
          await handleTicketTagSelect(interaction);
        } else if (interaction.isButton()) {
          await handleButton(interaction);
        } else if (interaction.isModalSubmit()) {
          await handleModalSubmit(interaction);
        }
      }
    }
  ]
};
