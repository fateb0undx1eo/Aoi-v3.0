import { ButtonStyle, MessageFlags } from 'discord.js';
import { COMPONENT_TYPES, POINTER } from '../utils/constants.js';

/**
 * Build ticket panel payload (Components V2)
 */
export function buildTicketPanelPayload() {
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
                custom_id: 'tickets:tag-select',
                placeholder: 'Select a ticket category',
                min_values: 1,
                max_values: 1,
                options: [
                  {
                    label: 'General Support',
                    value: 'general_support',
                    description: 'Help with server-related questions',
                    emoji: { name: 'Wump', id: '1503037895382929580' }
                  },
                  {
                    label: 'Report a User',
                    value: 'report_user',
                    description: 'Report rule-breaking members',
                    emoji: { name: 'Exclamation', id: '1503038935645945876' }
                  },
                  {
                    label: 'Partnership Requests',
                    value: 'partnership_requests',
                    description: 'Inquiries regarding collaborations',
                    emoji: { name: 'Fistbump', id: '1503043689281355896' }
                  },
                  {
                    label: 'Booster Perk Claims',
                    value: 'booster_perk_claims',
                    description: 'Claim your booster rewards',
                    emoji: { name: 'Heart', id: '1503038224044527739' }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * Build ticket welcome message payload (Components V2)
 */
export function buildTicketWelcomePayload(tag, creatorId) {
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
                custom_id: `tickets:resolved:${creatorId}`,
                label: 'RESOLVED',
                emoji: {
                  name: 'Resolved',
                  id: '1503284846980632647'
                }
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * Build user management controls payload
 */
export function buildUserManagementPayload(threadId) {
  return {
    components: [
      {
        type: COMPONENT_TYPES.ActionRow,
        components: [
          {
            type: COMPONENT_TYPES.Button,
            style: ButtonStyle.Secondary,
            custom_id: `tickets:add-users:${threadId}`,
            label: 'USER',
            emoji: { name: 'Add', id: '1503290197079752745' }
          },
          {
            type: COMPONENT_TYPES.Button,
            style: ButtonStyle.Secondary,
            custom_id: `tickets:remove-users:${threadId}`,
            label: 'USER',
            emoji: { name: 'Remove', id: '1503290199281635391' }
          }
        ]
      }
    ]
  };
}
