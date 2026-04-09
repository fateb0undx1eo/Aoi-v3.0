import { supabase } from './supabase.js';

export class RepositoryError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'RepositoryError';
    this.cause = cause;
  }
}

const TRANSIENT_NETWORK_MARKERS = [
  'fetch failed',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'Connect Timeout Error',
  'network'
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorDetails(error) {
  return String(error?.details || error?.message || error?.cause?.details || error?.cause?.message || '');
}

function isTransientNetworkError(error) {
  const details = getErrorDetails(error);
  return TRANSIENT_NETWORK_MARKERS.some((marker) => details.includes(marker));
}

async function runRepositoryOperation(actionLabel, table, operation, retries = 1) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { data, error } = await operation();
    if (!error) {
      return data;
    }

    lastError = error;
    if (!isTransientNetworkError(error) || attempt === retries) {
      break;
    }

    await sleep(400 * (attempt + 1));
  }

  throw new RepositoryError(`Failed to ${actionLabel} ${table}`, lastError);
}

export async function fetchMany(table, queryBuilder) {
  const data = await runRepositoryOperation('fetch from', table, () => queryBuilder(supabase.from(table)));
  return data ?? [];
}

export async function fetchOne(table, queryBuilder) {
  const data = await runRepositoryOperation('fetch single row from', table, () => queryBuilder(supabase.from(table)).single());
  return data;
}

export async function upsertRows(table, payload, conflictColumns = null) {
  await runRepositoryOperation('upsert into', table, () =>
    supabase.from(table).upsert(payload, conflictColumns ? { onConflict: conflictColumns } : {})
  );
}

export async function deleteWhere(table, queryBuilder) {
  await runRepositoryOperation('delete from', table, () => queryBuilder(supabase.from(table).delete()));
}

export async function updateWhere(table, values, queryBuilder) {
  await runRepositoryOperation('update', table, () => queryBuilder(supabase.from(table).update(values)));
}
