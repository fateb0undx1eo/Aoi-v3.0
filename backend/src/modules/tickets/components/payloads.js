import { ButtonStyle } from 'discord.js';
import { COMPONENT_TYPES, POINTER, TICKET_TAGS, CUSTOM_IDS } from '../utils/constants.js';

/**
 * Build ticket panel payload
 */
export function buildTicketPanelPayload() {
  return {
    embeds:[
      {
        color: 0x2b2d31,
        description: '# <:Empty:1503044372487471328><:Empty:1503044372487471328><:Empty:1503044372487471328><a:Sparkle2:1503090874417152020><:Ticket1:1503003731887788072><:Ticket2:1503003714213118104><a:Sparkle2:1503090874417152020>\n\n**Need help with something?**\nCreate a support ticket by selecting a category below and our staff team will assist you as soon as possible.'
      }
    ],
    components:[
      {
        type: COMPONENT_TYPES.ActionRow,
        components:[
          {
            type: COMPONENT_TYPES.StringSelect,
            custom_id: CUSTOM_IDS.ticketTagSelect,
            placeholder: 'Select a ticket category',
            min_values: 1,
            max_values: 1,
            options: TICKET_TAGS.map(tag => ({
              label: tag.label,
              value: tag.value,
              description: tag.description,
              emoji: tag.emoji
            }))
          }
        ]
      }
    ]
  };
}

/**
 * Build ticket welcome message payload
 */
export function buildTicketWelcomePayload(tag, creatorId) {
  return {
    embeds:[
      {
        color: 0x2b2d31,
        description: `# ${tag.label}\n\nThank you for opening a support ticket.\n${tag.intro}\nA staff member will respond as soon as possible.\n\n## General Guidelines\n${POINTER} Explain your issue clearly and include full details.\n${POINTER} Share screenshots, user IDs, message links, and evidence where relevant.\n${POINTER} Keep all context in this thread so staff can help quickly.\n${POINTER} Avoid pings and wait for a response from staff.`
      }
    ],
    components:[
      {
        type: COMPONENT_TYPES.ActionRow,
        components:[
          {
            type: COMPONENT_TYPES.Button,
            style: ButtonStyle.Secondary,
            custom_id: `${CUSTOM_IDS.resolvedPrefix}:${creatorId}`,
            label: 'RESOLVED',
            emoji: {
              name: 'Resolved',
              id: '1503284846980632647'
            }
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
        components:[
          {
            type: COMPONENT_TYPES.Button,
            style: ButtonStyle.Secondary,
            custom_id: `${CUSTOM_IDS.addUsersPrefix}:${threadId}`,
            label: 'USER',
            emoji: { name: 'Add', id: '1503290197079752745' }
          },
          {
            type: COMPONENT_TYPES.Button,
            style: ButtonStyle.Secondary,
            custom_id: `${CUSTOM_IDS.removeUsersPrefix}:${threadId}`,
            label: 'USER',
            emoji: { name: 'Remove', id: '1503290199281635391' }
          }
        ]
      }
    ]
  };
}