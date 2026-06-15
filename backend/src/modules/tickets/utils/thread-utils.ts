import { ChannelType } from 'discord.js';
import { THREAD_PREFIX_CLOSED, TICKET_STAFF_ROLE_IDS, ADD_STAFF_MEMBERS_TO_THREAD, COMPONENT_TYPES } from './constants.js';
import { parseResolvedCreatorId } from './custom-id-utils.js';

export function generateThreadName(prefix: string): string {
  const suffix = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

export function markThreadNameClosed(name: string): string {
  if (name.startsWith(THREAD_PREFIX_CLOSED)) return name;
  return `${THREAD_PREFIX_CLOSED}${name}`;
}

export function isThreadNameClosed(name: string): boolean {
  return name.startsWith(THREAD_PREFIX_CLOSED);
}

export async function addStaffMembersToThread(thread: any, staffRoleIds: string[] = TICKET_STAFF_ROLE_IDS): Promise<void> {
  if (!ADD_STAFF_MEMBERS_TO_THREAD) return;

  const guild = thread.guild;
  await guild.members.fetch().catch(() => null);

  const staffUserIds = new Set<string>();
  for (const roleId of staffRoleIds) {
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

export async function getCreatorIdFromThread(thread: any): Promise<string | null> {
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

export async function hasOpenTicketInChannel(parentChannel: any, userId: string, botUserId: string): Promise<boolean> {
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

export function buildTicketMentions(creatorId: string, staffRoleIds: string[] = TICKET_STAFF_ROLE_IDS): string {
  const roleMentions = staffRoleIds.map((roleId) => `<@&${roleId}>`).join(' ');
  return `<@${creatorId}> ${roleMentions}`.trim();
}

export async function findWelcomeMessageInThread(thread: any): Promise<any | null> {
  const messages = await thread.messages.fetch({ limit: 30 }).catch(() => null);
  if (!messages) return null;

  for (const message of messages.values()) {
    let hasResolvedButton = false;
    for (const row of message.components ?? []) {
      for (const component of row.components ?? []) {
        const id = component.customId ?? component.custom_id ?? null;
        if (parseResolvedCreatorId(id)) {
          hasResolvedButton = true;
          break;
        }
      }
      if (hasResolvedButton) break;
    }

    if (hasResolvedButton) {
      return message;
    }
  }

  return null;
}

export function extractTagLabelFromMessage(message: any): string | null {
  if (!message) return null;
  for (const topLevel of message.components ?? []) {
    for (const child of topLevel.components ?? []) {
      if (child.type === COMPONENT_TYPES.TextDisplay) {
        const text = child.content ?? child.data?.content ?? '';
        if (text.startsWith('# ')) {
          return text.slice(2).trim();
        }
      }
    }
  }
  return null;
}

export default {
  generateThreadName,
  markThreadNameClosed,
  isThreadNameClosed,
  addStaffMembersToThread,
  getCreatorIdFromThread,
  hasOpenTicketInChannel,
  buildTicketMentions,
  findWelcomeMessageInThread,
  extractTagLabelFromMessage
};
