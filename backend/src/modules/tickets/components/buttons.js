import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { CUSTOM_IDS } from '../utils/constants.js';

export function createTicketTagButtons(tags) {
  const rows =[];
  for (let i = 0; i < tags.length; i += 5) {
    const row = new ActionRowBuilder();
    const rowTags = tags.slice(i, i + 5);
    for (const tag of rowTags) {
      row.addComponents(
        createButton({
          customId: `${CUSTOM_IDS.ticketTagPrefix}:${tag.value}`,
          label: tag.label,
          style: ButtonStyle.Secondary,
          emoji: tag.emoji
        })
      );
    }
    rows.push(row);
  }
  return rows;
}

export function createUserManagementButtons(threadId, creatorId) {
  return new ActionRowBuilder().addComponents(
    createButton({
      customId: `${CUSTOM_IDS.addUsersPrefix}:${threadId}`,
      label: 'Add User',
      style: ButtonStyle.Primary,
      emoji: '➕'
    }),
    createButton({
      customId: `${CUSTOM_IDS.removeUsersPrefix}:${threadId}`,
      label: 'Remove User',
      style: ButtonStyle.Secondary,
      emoji: '➖'
    })
  );
}

export function createResolutionButtons(creatorId) {
  return new ActionRowBuilder().addComponents(
    createButton({
      customId: `${CUSTOM_IDS.resolvedPrefix}:${creatorId}`,
      label: 'Mark as Resolved',
      style: ButtonStyle.Danger,
      emoji: '✅'
    })
  );
}

export function createResolutionConfirmationButtons(creatorId) {
  return new ActionRowBuilder().addComponents(
    createButton({
      customId: `${CUSTOM_IDS.resolvedConfirmYes}:${creatorId}`,
      label: 'Yes, Resolve',
      style: ButtonStyle.Danger,
      emoji: '✅'
    }),
    createButton({
      customId: `${CUSTOM_IDS.resolvedConfirmNo}:${creatorId}`,
      label: 'Cancel',
      style: ButtonStyle.Secondary,
      emoji: '❌'
    })
  );
}

export function createDisabledResolutionButton(creatorId) {
  return new ActionRowBuilder().addComponents(
    createButton({
      customId: `${CUSTOM_IDS.resolvedPrefix}:${creatorId}`,
      label: 'RESOLVED (Already Resolved)',
      style: ButtonStyle.Secondary,
      emoji: '✅',
      disabled: true
    })
  );
}

export function createTicketControlButtons(threadId, creatorId, isResolved = false) {
  const rows =[];
  rows.push(createUserManagementButtons(threadId, creatorId));
  if (isResolved) {
    rows.push(createDisabledResolutionButton(creatorId));
  } else {
    rows.push(createResolutionButtons(creatorId));
  }
  return rows;
}

export function createButton(options) {
  const button = new ButtonBuilder();
  button.setCustomId(options.customId);
  button.setLabel(options.label);
  button.setStyle(options.style);
  
  if (options.emoji) button.setEmoji(options.emoji);
  if (options.disabled) button.setDisabled(true);
  if (options.url) button.setURL(options.url);
  
  return button;
}

export function createNavigationButtons(stepId, canGoBack = true, canGoForward = true, canFinish = false) {
  const row = new ActionRowBuilder();
  if (canGoBack) {
    row.addComponents(
      createButton({
        customId: `${CUSTOM_IDS.navBackPrefix}:${stepId}`,
        label: 'Back',
        style: ButtonStyle.Secondary,
        emoji: '⬅️'
      })
    );
  }
  if (canFinish) {
    row.addComponents(
      createButton({
        customId: `${CUSTOM_IDS.navFinishPrefix}:${stepId}`,
        label: 'Finish',
        style: ButtonStyle.Success,
        emoji: '✅'
      })
    );
  } else if (canGoForward) {
    row.addComponents(
      createButton({
        customId: `${CUSTOM_IDS.navNextPrefix}:${stepId}`,
        label: 'Next',
        style: ButtonStyle.Primary,
        emoji: '➡️'
      })
    );
  }
  row.addComponents(
    createButton({
      customId: `${CUSTOM_IDS.navCancelPrefix}:${stepId}`,
      label: 'Cancel',
      style: ButtonStyle.Danger,
      emoji: '❌'
    })
  );
  return row;
}

export function createActionButtons(threadId, options = {}) {
  const { allowAdd = true, allowRemove = true, allowResolve = true, allowClose = false } = options;
  const rows =[];
  const firstRow = new ActionRowBuilder();
  
  if (allowAdd) {
    firstRow.addComponents(
      createButton({ customId: `${CUSTOM_IDS.addUsersPrefix}:${threadId}`, label: 'Add User', style: ButtonStyle.Primary, emoji: '➕' })
    );
  }
  if (allowRemove) {
    firstRow.addComponents(
      createButton({ customId: `${CUSTOM_IDS.removeUsersPrefix}:${threadId}`, label: 'Remove User', style: ButtonStyle.Secondary, emoji: '➖' })
    );
  }
  rows.push(firstRow);
  
  if (allowResolve || allowClose) {
    const secondRow = new ActionRowBuilder();
    if (allowResolve) {
      secondRow.addComponents(
        createButton({ customId: `${CUSTOM_IDS.resolvedPrefix}:${threadId}`, label: 'Mark as Resolved', style: ButtonStyle.Danger, emoji: '✅' })
      );
    }
    if (allowClose) {
      secondRow.addComponents(
        createButton({ customId: `${CUSTOM_IDS.closeTicketPrefix}:${threadId}`, label: 'Close Ticket', style: ButtonStyle.Danger, emoji: '🔒' })
      );
    }
    rows.push(secondRow);
  }
  return rows;
}

export function createStatusButtons(status, threadId) {
  const row = new ActionRowBuilder();
  switch (status) {
    case 'open':
      row.addComponents(createButton({ customId: `status_open:${threadId}`, label: '🟢 Open', style: ButtonStyle.Success, disabled: true }));
      break;
    case 'resolved':
      row.addComponents(createButton({ customId: `status_resolved:${threadId}`, label: '✅ Resolved', style: ButtonStyle.Success, disabled: true }));
      break;
    case 'closed':
      row.addComponents(createButton({ customId: `status_closed:${threadId}`, label: '🔒 Closed', style: ButtonStyle.Secondary, disabled: true }));
      break;
    default:
      row.addComponents(createButton({ customId: `status_unknown:${threadId}`, label: '❓ Unknown', style: ButtonStyle.Secondary, disabled: true }));
  }
  return row;
}