import { COMPONENT_TYPES } from '../utils/constants.js';
import { buildTicketTagSelectRow } from './selects.js';
import { buildResolvedButton, buildResolveConfirmationRow, buildUserManagementRow } from './buttons.js';

export function buildTicketPanelPayload() {
  return {
    flags: 32768,
    components: [
      {
        type: 17,
        components: [
          {
            type: 10,
            content:
              '# <:Empty:1503044372487471328><:Empty:1503044372487471328><:Empty:1503044372487471328><a:Sparkle2:1503090874417152020><:Ticket1:1503003731887788072><:Ticket2:1503003714213118104><a:Sparkle2:1503090874417152020>'
          },
          {
            type: 10,
            content:
              '**Need help with something?**\nCreate a support ticket by selecting a category below and our staff team will assist you as soon as possible.'
          },
          buildTicketTagSelectRow()
        ]
      }
    ]
  };
}

export function buildTicketWelcomePayload(tag: { label: string; intro: string }, creatorId: string, { resolvedDisabled = false }: { resolvedDisabled?: boolean } = {}) {
  return {
    flags: 32768,
    components: [
      {
        type: 17,
        components: [
          {
            type: 10,
            content: `# ${tag.label}`
          },
          {
            type: 10,
            content:
              `Thank you for opening a support ticket.\n` +
              `${tag.intro}\n` +
              `A staff member will respond as soon as possible.`
          },
          {
            type: 10,
            content:
              `## General Guidelines\n` +
              `${'<:Pointer:1502993771317694655>'} Explain your issue clearly and include full details.\n` +
              `${'<:Pointer:1502993771317694655>'} Share screenshots, user IDs, message links, and evidence where relevant.\n` +
              `${'<:Pointer:1502993771317694655>'} Keep all context in this thread so staff can help quickly.\n` +
              `${'<:Pointer:1502993771317694655>'} Avoid pings and wait for a response from staff.`
          },
          {
            type: 1,
            components: [buildResolvedButton(creatorId, resolvedDisabled)]
          }
        ]
      }
    ]
  };
}

export function buildResolveConfirmationPayload(creatorId: string) {
  return {
    content:
      '**Close this ticket?**\nThis will lock the thread and remove the ticket creator. ' +
      'No one will be able to message here again.',
    components: [buildResolveConfirmationRow(creatorId)],
    ephemeral: true
  };
}

export function buildUserManagementPayload(threadId: string) {
  return {
    content: 'Ticket user controls:',
    components: [buildUserManagementRow(threadId)],
    ephemeral: false
  };
}

export function buildSuccessPayload(message: string) {
  return {
    content: `✅ ${message}`,
    ephemeral: true
  };
}

export function buildErrorPayload(message: string) {
  return {
    content: `❌ ${message}`,
    ephemeral: true
  };
}

export function buildInfoPayload(message: string) {
  return {
    content: `ℹ️ ${message}`,
    ephemeral: true
  };
}

export function buildWarningPayload(message: string) {
  return {
    content: `⚠️ ${message}`,
    ephemeral: true
  };
}

export function buildBlacklistListPayload(entries: any[], guildName: string) {
  const lines = entries.map((e: any, i: number) =>
    `${i + 1}. <@${e.user_id}> — added by <@${e.added_by}> · <t:${Math.floor(new Date(e.created_at).getTime() / 1000)}:R>`
  );

  const content = lines.join('\n').slice(0, 3800);

  return {
    flags: 32768,
    components: [
      {
        type: 17,
        components: [
          { type: 10, content: `# Ticket Blacklist — ${escapeFormatting(guildName)}` },
          { type: 10, content: `**${entries.length} user(s)** are blocked from opening tickets.` },
          { type: 10, content }
        ]
      }
    ]
  };
}

function escapeFormatting(text: string): string {
  return text.replace(/\\(?!\s)/g, '\\\\').replace(/[_~*|]/g, '\\$&');
}

export default {
  buildTicketPanelPayload,
  buildTicketWelcomePayload,
  buildResolveConfirmationPayload,
  buildUserManagementPayload,
  buildSuccessPayload,
  buildErrorPayload,
  buildInfoPayload,
  buildWarningPayload
};
