import pRetry, { AbortError } from 'p-retry';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase.js';
import { metrics } from '../observability/metrics.js';
import { ExternalServiceUnavailableError } from '../errors.js';

export class RepositoryError extends Error {
  public override name = 'RepositoryError';
  public cause: Error | null;

  constructor(message: string, cause: Error | null = null) {
    super(message);
    this.cause = cause;
  }
}

function isTransientNetworkError(error: any): boolean {
  const markers = ['fetch failed', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'Connect Timeout Error', 'network'];
  const details = String(error?.details || error?.message || error?.cause?.details || error?.cause?.message || '');
  return markers.some((marker) => details.includes(marker));
}

type QueryBuilder<T> = (table: any) => any;

async function runRepositoryOperation<T>(
  actionLabel: string,
  table: string,
  operation: () => Promise<{ data: T | null; error: any }>,
  retries: number = 1
): Promise<T> {
  try {
    return await pRetry(async () => {
      const { data, error } = await metrics.time('database_latency_ms', { table, action: actionLabel }, operation);
      if (error) {
        if (isTransientNetworkError(error)) {
          throw error;
        }
        throw new AbortError(error);
      }
      return data as T;
    }, {
      retries,
      minTimeout: 400,
      maxTimeout: 400 * (retries + 1),
      onFailedAttempt: () => {}
    });
  } catch (error: any) {
    if (isTransientNetworkError(error)) {
      throw new ExternalServiceUnavailableError(`Failed to ${actionLabel} ${table}`, error);
    }
    throw new RepositoryError(`Failed to ${actionLabel} ${table}`, error);
  }
}

export async function fetchMany<T = any>(table: string, queryBuilder: QueryBuilder<T>): Promise<T[]> {
  const result = await runRepositoryOperation('fetch from', table, () => queryBuilder(supabase.from(table)) as any as Promise<{ data: unknown; error: any }>);
  return (result ?? []) as T[];
}

export async function fetchOne<T = any>(table: string, queryBuilder: QueryBuilder<T>): Promise<T | null> {
  const result = await runRepositoryOperation('fetch single row from', table, () => queryBuilder(supabase.from(table)).single() as any as Promise<{ data: unknown; error: any }>);
  return result as T | null;
}

export async function upsertRows(table: string, payload: Record<string, any>, conflictColumns: string | null = null): Promise<void> {
  await runRepositoryOperation('upsert into', table, () =>
    supabase.from(table).upsert(payload, conflictColumns ? { onConflict: conflictColumns } : {}) as any as Promise<{ data: unknown; error: any }>
  );
}

export async function deleteWhere(table: string, queryBuilder: QueryBuilder<any>): Promise<void> {
  await runRepositoryOperation('delete from', table, () => queryBuilder(supabase.from(table).delete()) as any as Promise<{ data: unknown; error: any }>);
}

export async function updateWhere(table: string, values: Record<string, any>, queryBuilder: QueryBuilder<any>): Promise<void> {
  await runRepositoryOperation('update', table, () => queryBuilder(supabase.from(table).update(values)) as any as Promise<{ data: unknown; error: any }>);
}
