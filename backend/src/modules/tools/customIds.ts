export const RC_PREFIX = 'rc';

export interface RcParsedCid {
  action: string;
  userId: string;
  data: string[];
}

export function cidRole(action: string, userId: string, ...extra: string[]): string {
  return [RC_PREFIX, action, userId, ...extra].join(':');
}

export function parseRoleCid(customId: string): RcParsedCid | null {
  const parts = customId.split(':');
  if (parts[0] !== RC_PREFIX || parts.length < 3) return null;
  return { action: parts[1]!, userId: parts[2]!, data: parts.slice(3) };
}
