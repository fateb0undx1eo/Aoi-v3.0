import test from 'node:test';
import assert from 'node:assert/strict';
import TicketCreationHandler from '../src/modules/tickets/handlers/ticket-creation.js';

test('ticket creation flow creates one thread and records durable ticket state', async () => {
  const createdThreads = [];
  const createdTickets = [];
  const interaction = {
    guildId: '123456789012345678',
    user: { id: '223456789012345678' },
    client: { user: { id: '323456789012345678' } },
    channel: {
      threads: {
        async fetchActive() {
          return { threads: new Map() };
        },
        async create(options) {
          createdThreads.push(options);
          return {
            id: '423456789012345678',
            guildId: '123456789012345678',
            guild: { id: '123456789012345678' },
            name: options.name,
            members: { add: async () => true },
            send: async () => ({ id: '523456789012345678' })
          };
        }
      }
    },
    editReply(payload) {
      this.lastReply = payload;
      return Promise.resolve();
    },
    deferred: true,
    replied: false
  };

  const handler = new TicketCreationHandler(
    {
      cooldownService: { checkCooldown: async () => true },
      getUserActiveTickets: async () => [],
      createTicket: async (row) => { createdTickets.push(row); }
    },
    {},
    {},
    { getOrCreateLogWebhook: async () => null },
    { channels: { fetch: async () => null }, user: { displayAvatarURL: () => '' } }
  );

  await handler.handleTicketCreation(interaction, {
    value: 'general_support',
    label: 'General Support',
    namePrefix: 'support',
    intro: 'Help'
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(createdThreads.length, 1);
  assert.match(interaction.lastReply.content, /Ticket created: <#423456789012345678>/);
  assert.equal(createdTickets.length, 1);
  assert.equal(createdTickets[0].tagValue, 'general_support');
  assert.equal(createdTickets[0].tagLabel, 'General Support');
});

test('ticket creation flow blocks durable active tickets before Discord thread creation', async () => {
  let threadCreated = false;
  const interaction = {
    guildId: '123456789012345678',
    user: { id: '223456789012345678' },
    client: { user: { id: '323456789012345678' } },
    channel: {
      threads: {
        async create() {
          threadCreated = true;
        }
      }
    },
    editReply(payload) {
      this.lastReply = payload;
      return Promise.resolve();
    },
    deferred: true,
    replied: false
  };

  const handler = new TicketCreationHandler(
    {
      cooldownService: { checkCooldown: async () => true },
      getUserActiveTickets: async () => [{ thread_id: '423456789012345678' }],
      createTicket: async () => {}
    },
    {},
    {},
    {},
    { channels: { fetch: async () => null } }
  );

  await handler.handleTicketCreation(interaction, {
    value: 'general_support',
    label: 'General Support',
    namePrefix: 'support',
    intro: 'Help'
  });

  assert.equal(threadCreated, false);
  assert.match(interaction.lastReply.content, /already have an active ticket/i);
});
