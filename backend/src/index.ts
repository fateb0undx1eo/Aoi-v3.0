// @ts-nocheck
import {
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits
} from 'discord.js';

const POINTER = '<:Pointer:1502993771317694655>';
const AUTO_ARCHIVE_24H = 1440;
const AUTO_ARCHIVE_1H = 60;
const TICKET_COOLDOWN_MS = 10 * 60 * 1000;
const TICKET_CREATION_LOCK_MS = 8000;

const TICKET_STAFF_ROLE_IDS = [
  '1457403601512169724'
];

const TICKET_LOG_CHANNEL_ID = '1485668403132760243';
const ADD_STAFF_MEMBERS_TO_THREAD = false;

const THREAD_PREFIX_CLOSED = '[CLOSED] ';

const CUSTOM_IDS = {
  ticketTagSelect: 'tickets:tag-select',
  resolvedPrefix: 'tickets:resolved',
  resolveConfirmPrefix: 'tickets:resolve-confirm',
  resolveCancelPrefix: 'tickets:resolve-cancel',
  addUsersPrefix: 'tickets:add-users',
  removeUsersPrefix: 'tickets:remove-users',
  addUsersModal: 'tickets:add-users-modal',
  removeUsersModal: 'tickets:remove-users-modal',
  addUserSelect: 'tickets:add-user-select-modal',
  removeUserSelect: 'tickets:remove-user-select-modal'
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

const TICKET_COMMAND_NAMES = new Set(['ticket']);

// ───────────────── Cooldown ─────────────────

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

function isTicketStaffFromInteraction(interaction) {
  if (!interaction.inGuild()) return false;
  return isTicketStaffLike(interaction.member, interaction.guild, interaction.user?.id);
}

function isAdminOrOwnerFromInteraction(interaction) {
  if (!interaction.inGuild()) return false;
  if (interaction.guild?.ownerId === interaction.user?.id) return true;
  return interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator);
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

function buildResolvedCustomId(creatorId) {
  return `${CUSTOM_IDS.resolvedPrefix}:${creatorId}`;
}

function parseResolvedCreatorId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.resolvedPrefix}:`)) return null;
  const creatorId = customId.slice(`${CUSTOM_IDS.resolvedPrefix}:`.length);
  return /^\d{16,20}$/.test(creatorId) ? creatorId : null;
}

// resolve-confirm:<creatorId> — sent on the Yes button in the confirmation prompt
function buildResolveConfirmCustomId(creatorId) {
  return `${CUSTOM_IDS.resolveConfirmPrefix}:${creatorId}`;
}

function parseResolveConfirmCreatorId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.resolveConfirmPrefix}:`)) return null;
  const creatorId = customId.slice(`${CUSTOM_IDS.resolveConfirmPrefix}:`.length);
  return /^\d{16,20}$/.test(creatorId) ? creatorId : null;
}

// resolve-cancel:<creatorId> — sent on the No button
function buildResolveCancelCustomId(creatorId) {
  return `${CUSTOM_IDS.resolveCancelPrefix}:${creatorId}`;
}

function parseResolveCancelCreatorId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.resolveCancelPrefix}:`)) return null;
  const creatorId = customId.slice(`${CUSTOM_IDS.resolveCancelPrefix}:`.length);
  return /^\d{16,20}$/.test(creatorId) ? creatorId : null;
}

function buildAddUsersCustomId(threadId) {
  return `${CUSTOM_IDS.addUsersPrefix}:${threadId}`;
}

function parseAddUsersThreadId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.addUsersPrefix}:`)) return null;
  const threadId = customId.slice(`${CUSTOM_IDS.addUsersPrefix}:`.length);
  return /^\d{16,20}$/.test(threadId) ? threadId : null;
}

function buildRemoveUsersCustomId(threadId) {
  return `${CUSTOM_IDS.removeUsersPrefix}:${threadId}`;
}

function parseRemoveUsersThreadId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.removeUsersPrefix}:`)) return null;
  const threadId = customId.slice(`${CUSTOM_IDS.removeUsersPrefix}:`.length);
  return /^\d{16,20}$/.test(threadId) ? threadId : null;
}

function buildAddUsersModalCustomId(threadId) {
  return `${CUSTOM_IDS.addUsersModal}:${threadId}`;
}

function parseAddUsersModalThreadId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.addUsersModal}:`)) return null;
  const threadId = customId.slice(`${CUSTOM_IDS.addUsersModal}:`.length);
  return /^\d{16,20}$/.test(threadId) ? threadId : null;
}

function buildRemoveUsersModalCustomId(threadId) {
  return `${CUSTOM_IDS.removeUsersModal}:${threadId}`;
}

function parseRemoveUsersModalThreadId(customId) {
  if (!customId?.startsWith(`${CUSTOM_IDS.removeUsersModal}:`)) return null;
  const threadId = customId.slice(`${CUSTOM_IDS.removeUsersModal}:`.length);
  return /^\d{16,20}$/.test(threadId) ? threadId : null;
}

function buildThreadLink(guildId, threadId) {
  return `https://discord.com/channels/${guildId}/${threadId}`;
}

// ───────────────── Thread State ─────────────────

function markThreadNameClosed(name) {
  if (name.startsWith(THREAD_PREFIX_CLOSED)) return name;
  return `${THREAD_PREFIX_CLOSED}${name}`;
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

function buildTicketWelcomePayload(tag, creatorId, { resolvedDisabled = false } = {}) {
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
                label: 'RESOLVED',
                emoji: { name: 'Resolved', id: '1503284846980632647' },
                // Disabled once the ticket has been closed — no further interaction possible
                disabled: resolvedDisabled
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
  const suffix = Math.random().toString(16).slice(2, 6).toUpperCase();
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

  await Promise.all(
    [...staffUserIds].map((userId) => thread.members.add(userId).catch(() => null))
  );
}

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

function buildTicketMentions(creatorId) {
  const roleMentions = TICKET_STAFF_ROLE_IDS.map((roleId) => `<@&${roleId}>`).join(' ');
  return `<@${creatorId}> ${roleMentions}`.trim();
}

// ───────────────── Disable Resolved Button ─────────────────

// Finds the welcome message in the thread (the one containing the RESOLVED button)
// and edits it so the button is disabled. This prevents any further interaction
// with the button even if the message is still visible in the archived thread.
async function disableResolvedButtonInThread(thread, creatorId) {
  const messages = await thread.messages.fetch({ limit: 30 }).catch(() => null);
  if (!messages) return;

  // Determine which tag label this thread belongs to by reading the welcome message title
  let matchedTag = null;

  for (const message of messages.values()) {
    // The welcome message is the Components V2 message sent by the bot that contains
    // the RESOLVED button. Identify it by the presence of the resolved custom_id.
    let hasResolvedButton = false;
    for (const row of message.components ?? []) {
      for (const component of row.components ?? []) {
        const id = component.customId ?? component.custom_id ?? null;
        if (parseResolvedCreatorId(id)) {
          hasResolvedButton = true;
        }
      }
    }

    if (!hasResolvedButton) continue;

    // Try to infer the tag from the message so we can rebuild the payload correctly.
    // The welcome message renders "# <tag.label>" as the first TextDisplay content.
    // We walk the component tree to find it.
    for (const topLevel of message.components ?? []) {
      // Container → children
      for (const child of topLevel.components ?? []) {
        if (child.type === COMPONENT_TYPES.TextDisplay) {
          const text = child.content ?? child.data?.content ?? '';
          matchedTag = TICKET_TAGS.find((t) => text.includes(t.label)) ?? null;
          if (matchedTag) break;
        }
      }
      if (matchedTag) break;
    }

    // Fall back to a synthetic tag object if we couldn't match — keeps the button
    // disabled even if the label can't be recovered.
    const tag = matchedTag ?? { label: 'Support Ticket', intro: '' };

    await message
      .edit(buildTicketWelcomePayload(tag, creatorId, { resolvedDisabled: true }))
      .catch(() => null);

    return; // Only one welcome message per thread
  }
}

// ───────────────── Logging ─────────────────

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
    const embed = new EmbedBuilder()
      .setTitle('Resolved')
      .setColor(0x2fa44f)
      .setDescription(lines.join('\n'));

    await webhook
      .editMessage(existing.id, { embeds: [embed], allowedMentions: { parse: [] } })
      .catch(() => null);
  } else {
    await sendTicketLog(thread, 'Resolved', 0x2fa44f, lines);
  }
}

// ───────────────── Ticket Creation ─────────────────

async function createTicketFromTag(interaction, tag) {
  const parentChannel = interaction.channel;

  if (!parentChannel?.threads?.create) {
    await interaction.editReply({ content: 'Tickets can only be created from a text channel panel.' });
    return;
  }

  const remaining = getRemainingCooldown(interaction.user.id);
  if (remaining > 0) {
    const readyAt = Math.floor((Date.now() + remaining) / 1000);
    await interaction.editReply({
      content: `You recently closed a ticket. You can open another <t:${readyAt}:R>.`
    });
    return;
  }

  if (await hasOpenTicketInChannel(parentChannel, interaction.user.id, interaction.client.user.id)) {
    await interaction.editReply({ content: 'You already have an active ticket in this channel.' });
    return;
  }

  const threadName = generateThreadName(tag.namePrefix);

  let thread;
  try {
    thread = await parentChannel.threads.create({
      name: threadName,
      type: ChannelType.PrivateThread,
      invitable: false,
      autoArchiveDuration: AUTO_ARCHIVE_24H,
      reason: `Ticket created by ${interaction.user.id} (${tag.value})`
    });
  } catch {
    await interaction.editReply({ content: 'Failed to create ticket thread.' });
    return;
  }

  try {
    await thread.members.add(interaction.user.id);
  } catch {
    await interaction.editReply({
      content: 'Ticket thread was created, but I could not add you to it.'
    });
    return;
  }

  await interaction.editReply({ content: `Ticket created: <#${thread.id}>` });

  queueMicrotask(() => {
    (async () => {
      try {
        const setupTasks = [];

        if (ADD_STAFF_MEMBERS_TO_THREAD) {
          setupTasks.push(addStaffMembersToThread(thread));
        }

        const messageSetup = (async () => {
          await thread
            .send({
              content: buildTicketMentions(interaction.user.id),
              allowedMentions: {
                users: [interaction.user.id],
                roles: TICKET_STAFF_ROLE_IDS
              }
            })
            .catch(() => null);

          await thread
            .send(buildTicketWelcomePayload(tag, interaction.user.id))
            .catch(() => null);
        })();

        const logSetup = sendCreatedLog(thread, {
          creatorId: interaction.user.id,
          tagLabel: tag.label
        });

        setupTasks.push(messageSetup, logSetup);
        await Promise.allSettled(setupTasks);
      } catch (error) {
        console.error('Background ticket setup failed', error);
      }
    })();
  });
}

// ───────────────── Resolve: Confirmation Prompt ─────────────────

// Step 1 — staff presses RESOLVED → show ephemeral confirmation with Yes / No buttons.
// We do NOT defer here; we reply with a new ephemeral message containing the prompt.
async function handleResolvedButtonPress(interaction, creatorId) {
  if (!interaction.inGuild() || !interaction.channel?.isThread?.()) {
    await interaction
      .reply({ content: 'This button only works inside ticket threads.', ephemeral: true })
      .catch(() => null);
    return;
  }

  if (!isTicketStaffFromInteraction(interaction)) {
    await interaction
      .reply({ content: 'Only support staff can resolve tickets.', ephemeral: true })
      .catch(() => null);
    return;
  }

  const thread = interaction.channel;

  if (isThreadNameClosed(thread.name)) {
    // Ticket is already closed — nothing to do.
    await interaction
      .reply({ content: 'This ticket is already closed.', ephemeral: true })
      .catch(() => null);
    return;
  }

  // Show the confirmation prompt as an ephemeral reply.
  // The Yes and No buttons carry the creatorId so the confirm handler is fully stateless.
  await interaction
    .reply({
      content:
        '**Close this ticket?**\nThis will lock the thread and remove the ticket creator. ' +
        'No one will be able to message here again.',
      components: [
        {
          type: COMPONENT_TYPES.ActionRow,
          components: [
            {
              type: COMPONENT_TYPES.Button,
              style: ButtonStyle.Danger,
              custom_id: buildResolveConfirmCustomId(creatorId),
              label: 'Yes, close it'
            },
            {
              type: COMPONENT_TYPES.Button,
              style: ButtonStyle.Secondary,
              custom_id: buildResolveCancelCustomId(creatorId),
              label: 'No, keep open'
            }
          ]
        }
      ],
      ephemeral: true
    })
    .catch(() => null);
}

// Step 2a — staff pressed Yes → actually close the ticket.
async function handleResolveConfirm(interaction, creatorId) {
  // deferUpdate so the ephemeral confirmation message gets updated in place,
  // and the "Yes / No" buttons stop being interactive immediately.
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate().catch(() => null);
  }

  const followUp = async (content) => {
    await interaction.followUp({ content, ephemeral: true }).catch(() => null);
  };

  if (!interaction.inGuild() || !interaction.channel?.isThread?.()) {
    await followUp('This button only works inside ticket threads.');
    return;
  }

  if (!isTicketStaffFromInteraction(interaction)) {
    await followUp('Only support staff can close tickets.');
    return;
  }

  const thread = interaction.channel;

  if (isThreadNameClosed(thread.name)) {
    await followUp('This ticket is already closed.');
    return;
  }

  // ── Close sequence ──

  // 1. Disable the RESOLVED button on the welcome message so it can never be pressed again.
  //    Do this before locking so the edit goes through (locked threads reject edits).
  await disableResolvedButtonInThread(thread, creatorId);

  // 2. Rename and remove creator in parallel
  await Promise.allSettled([
    thread.setName(markThreadNameClosed(thread.name)),
    thread.members.remove(creatorId)
  ]);

  // 3. Lock (blocks everyone — staff included — from sending new messages)
  //    then archive.
  await thread.setLocked(true).catch(() => null);
  await thread.setArchived(true).catch(() => null);

  setCooldown(creatorId);

  // Fire log in background — don't block the confirmation response
  upsertResolvedLog(thread, {
    creatorId,
    resolverId: interaction.user.id,
    tagLabel: 'Unknown'
  }).catch(() => null);

  await followUp('Ticket has been closed successfully.');
}

// Step 2b — staff pressed No → update the ephemeral to a cancellation notice.
async function handleResolveCancel(interaction) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate().catch(() => null);
  }

  await interaction
    .followUp({ content: 'Action cancelled — the ticket remains open.', ephemeral: true })
    .catch(() => null);
}

// ───────────────── Manage Users ─────────────────

async function handleAddUsersButton(interaction, threadId) {
  if (!interaction.inGuild() || !interaction.channel?.isThread?.()) {
    await interaction
      .reply({ content: 'This button only works inside ticket threads.', ephemeral: true })
      .catch(() => null);
    return;
  }

  if (!isTicketStaffFromInteraction(interaction)) {
    await interaction
      .reply({ content: 'Only support staff can manage users.', ephemeral: true })
      .catch(() => null);
    return;
  }

  if (interaction.channelId !== threadId) {
    await interaction
      .reply({ content: 'This control only works in its original thread.', ephemeral: true })
      .catch(() => null);
    return;
  }

  await interaction
    .showModal({
      custom_id: buildAddUsersModalCustomId(threadId),
      title: 'Add User',
      components: [
        {
          type: 1,
          components: [
            {
              type: 5,
              custom_id: CUSTOM_IDS.addUserSelect,
              placeholder: 'Select user to add',
              min_values: 1,
              max_values: 1
            }
          ]
        }
      ]
    })
    .catch(() => null);
}

async function handleRemoveUsersButton(interaction, threadId) {
  if (!interaction.inGuild() || !interaction.channel?.isThread?.()) {
    await interaction
      .reply({ content: 'This button only works inside ticket threads.', ephemeral: true })
      .catch(() => null);
    return;
  }

  if (!isTicketStaffFromInteraction(interaction)) {
    await interaction
      .reply({ content: 'Only support staff can manage users.', ephemeral: true })
      .catch(() => null);
    return;
  }

  if (interaction.channelId !== threadId) {
    await interaction
      .reply({ content: 'This control only works in its original thread.', ephemeral: true })
      .catch(() => null);
    return;
  }

  await interaction
    .showModal({
      custom_id: buildRemoveUsersModalCustomId(threadId),
      title: 'Remove User',
      components: [
        {
          type: 1,
          components: [
            {
              type: 5,
              custom_id: CUSTOM_IDS.removeUserSelect,
              placeholder: 'Select user to remove',
              min_values: 1,
              max_values: 1
            }
          ]
        }
      ]
    })
    .catch(() => null);
}

async function handleAddUsersModalSubmit(interaction, threadId) {
  if (!interaction.inGuild() || !interaction.channel?.isThread?.()) return;

  await interaction.deferReply({ ephemeral: true }).catch(() => null);

  const thread = interaction.channel;

  if (!threadId || interaction.channelId !== threadId) {
    await interaction.editReply({ content: 'Invalid ticket state.' }).catch(() => null);
    return;
  }

  if (!isTicketStaffFromInteraction(interaction)) {
    await interaction.editReply({ content: 'Only support staff can manage users.' }).catch(() => null);
    return;
  }

  const addUserId = interaction.components?.[0]?.components?.[0]?.values?.[0] ?? null;

  if (!addUserId) {
    await interaction.editReply({ content: 'Please select a user to add.' }).catch(() => null);
    return;
  }

  const member = await interaction.guild.members.fetch(addUserId).catch(() => null);

  if (!member) {
    await interaction.editReply({ content: 'Could not find that user.' }).catch(() => null);
    return;
  }

  await thread.members.add(addUserId).catch(() => null);

  await sendTicketLog(thread, 'User Added', 0x57f287, [
    `Added By: <@${interaction.user.id}>`,
    `Added User: <@${addUserId}>`,
    `Thread Link: ${buildThreadLink(interaction.guildId, thread.id)}`
  ]);

  await interaction.editReply({ content: `Added <@${addUserId}>` }).catch(() => null);
}

async function handleRemoveUsersModalSubmit(interaction, threadId) {
  if (!interaction.inGuild() || !interaction.channel?.isThread?.()) return;

  await interaction.deferReply({ ephemeral: true }).catch(() => null);

  const thread = interaction.channel;

  if (!threadId || interaction.channelId !== threadId) {
    await interaction.editReply({ content: 'Invalid ticket state.' }).catch(() => null);
    return;
  }

  if (!isTicketStaffFromInteraction(interaction)) {
    await interaction.editReply({ content: 'Only support staff can manage users.' }).catch(() => null);
    return;
  }

  const removeUserId = interaction.components?.[0]?.components?.[0]?.values?.[0] ?? null;

  if (!removeUserId) {
    await interaction.editReply({ content: 'Please select a user to remove.' }).catch(() => null);
    return;
  }

  const member = await interaction.guild.members.fetch(removeUserId).catch(() => null);

  if (member && isTicketStaffLike(member, interaction.guild, member.id)) {
    await interaction
      .editReply({
        content: `Cannot remove <@${removeUserId}> — they are support staff, an admin, or the server owner.`
      })
      .catch(() => null);
    return;
  }

  await thread.members.remove(removeUserId).catch(() => null);

  await sendTicketLog(thread, 'User Removed', 0xed4245, [
    `Removed By: <@${interaction.user.id}>`,
    `Removed User: <@${removeUserId}>`,
    `Thread Link: ${buildThreadLink(interaction.guildId, thread.id)}`
  ]);

  await interaction.editReply({ content: `Removed <@${removeUserId}>` }).catch(() => null);
}

// ───────────────── Commands ─────────────────

async function executeTicketCommand(interaction) {
  if (!(await requireTicketStaff(interaction))) return;

  let group = null;
  let subcommand = null;
  try { group = interaction.options.getSubcommandGroup(false); } catch {}
  try { subcommand = interaction.options.getSubcommand(false); } catch {}

  if (subcommand === 'panel') {
    if (!isAdminOrOwnerFromInteraction(interaction)) {
      await interaction.editReply('Only server owner or admins can use `/ticket panel`.');
      return;
    }
    await interaction.channel.send(buildTicketPanelPayload());
    await interaction.editReply('Ticket panel sent in this channel.');
    return;
  }

  if (group === 'manage' && subcommand === 'users') {
    if (!interaction.channel?.isThread?.()) {
      await interaction.editReply('Run this inside a ticket thread.');
      return;
    }

    const threadId = interaction.channelId;

    await interaction.editReply({
      content: 'Ticket user controls:',
      components: [
        {
          type: COMPONENT_TYPES.ActionRow,
          components: [
            {
              type: COMPONENT_TYPES.Button,
              style: ButtonStyle.Secondary,
              custom_id: buildAddUsersCustomId(threadId),
              label: 'ADD USER',
              emoji: { name: 'Add', id: '1503290197079752745' }
            },
            {
              type: COMPONENT_TYPES.Button,
              style: ButtonStyle.Secondary,
              custom_id: buildRemoveUsersCustomId(threadId),
              label: 'REMOVE USER',
              emoji: { name: 'Remove', id: '1503290199281635391' }
            }
          ]
        }
      ]
    });
    return;
  }

  await interaction.editReply('Use `/ticket panel` or `/ticket manage users`.');
}

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
  const { customId } = interaction;

  // ── Resolve confirmation flow ──
  const resolvedCreatorId = parseResolvedCreatorId(customId);
  if (resolvedCreatorId) {
    await handleResolvedButtonPress(interaction, resolvedCreatorId);
    return;
  }

  const confirmCreatorId = parseResolveConfirmCreatorId(customId);
  if (confirmCreatorId) {
    await handleResolveConfirm(interaction, confirmCreatorId);
    return;
  }

  const cancelCreatorId = parseResolveCancelCreatorId(customId);
  if (cancelCreatorId) {
    await handleResolveCancel(interaction);
    return;
  }

  // ── User management ──
  const addThreadId = parseAddUsersThreadId(customId);
  if (addThreadId) {
    await handleAddUsersButton(interaction, addThreadId);
    return;
  }

  const removeThreadId = parseRemoveUsersThreadId(customId);
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
      executeTicketCommand,
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
        if (interaction.isCommand()) {
          if (TICKET_COMMAND_NAMES.has(interaction.commandName)) {
            await executeTicketCommand(interaction);
          }
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
};// @ts-nocheck
