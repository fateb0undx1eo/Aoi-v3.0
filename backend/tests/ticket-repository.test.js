import test from 'node:test';
import assert from 'node:assert/strict';
import TicketRepository from '../src/modules/tickets/repositories/ticket-repository.js';

function createQuery(tableName, rowsRef) {
  const state = { tableName, op: null, payload: null, filters: [], selected: null };
  const api = {
    insert(payload) { state.op = 'insert'; state.payload = payload; return api; },
    update(payload) { state.op = 'update'; state.payload = payload; return api; },
    delete() { state.op = 'delete'; return api; },
    select(value = '*') { state.selected = value; return api; },
    eq(column, value) { state.filters.push({ column, value }); return api; },
    in(column, value) { state.filters.push({ column, value, in: true }); return api; },
    lt(column, value) { state.filters.push({ column, value, lt: true }); return api; },
    order() { return api; },
    limit() { return api; },
    __state: state,
    __rowsRef: rowsRef
  };
  return api;
}

test('ticket repository writes schema-compatible ticket rows through shared repository helpers', async () => {
  const calls = [];
  const db = {
    async fetchMany(table, build) {
      const query = createQuery(table, []);
      build(query);
      calls.push(query.__state);
      return [{ thread_id: query.__state.payload.thread_id, status: 'open' }];
    }
  };
  const repo = new TicketRepository(db);

  const result = await repo.createTicket({
    guildId: '123456789012345678',
    threadId: '223456789012345678',
    creatorId: '323456789012345678',
    tagValue: 'general_support',
    tagLabel: 'General Support',
    threadName: 'support-ABCD'
  });

  assert.equal(result.thread_id, '223456789012345678');
  assert.equal(calls[0].tableName, 'tickets');
  assert.equal(calls[0].payload.tag, 'general_support');
  assert.equal(calls[0].payload.tag_label, 'General Support');
  assert.equal(calls[0].payload.status, 'open');
});

test('ticket repository resolves tickets with status and lock/archive mirror fields', async () => {
  let updatePayload = null;
  const db = {
    async fetchMany(table, build) {
      const query = createQuery(table, []);
      build(query);
      updatePayload = query.__state.payload;
      return [{ thread_id: '223456789012345678', status: 'resolved' }];
    }
  };
  const repo = new TicketRepository(db);

  await repo.resolveTicket('223456789012345678', '323456789012345678');

  assert.equal(updatePayload.status, 'resolved');
  assert.equal(updatePayload.resolved_by, '323456789012345678');
  assert.equal(updatePayload.is_archived, true);
  assert.equal(updatePayload.is_locked, true);
});
