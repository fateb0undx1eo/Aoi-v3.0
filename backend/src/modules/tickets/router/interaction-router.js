import { lockService } from '../services/lock-service.js';
import { TICKET_COMMAND_NAMES } from '../utils/constants.js';
import { 
  parseResolvedCreatorId,
  parseAddUsersThreadId,
  parseRemoveUsersThreadId,
  parseAddUsersModalThreadId,
  parseRemoveUsersModalThreadId,
  CUSTOM_IDS
} from '../utils/custom-id-utils.js';
import { createTicketFromTag } from '../handlers/ticket-creation.js';
import { toggleResolved } from '../handlers/ticket-resolution.js';
import { 
  handleAddUsersButton,
  handleRemoveUsersButton,
  handleAddUsersModalSubmit,
  handleRemoveUsersModalSubmit
} from '../handlers/user-management.js';
import { TICKET_TAGS } from '../utils/constants.js';

/**
 * Handle ticket tag selection
 */
export async function handleTicketTagSelect(interaction) {
  // Check for active creation lock
  const hasLock = await lockService.hasCreationLock(
    interaction.guildId,
    interaction.user.id
  );

  if (hasLock) {
    await interaction.reply({
      content: 'A ticket creation is already in progress. Please wait a few seconds and try again.',
      ephemeral: true
    });
    return;
  }

  // Acquire creation lock
  const lockValue = await lockService.acquireCreationLock(
    interaction.guildId,
    interaction.user.id
  );

  if (!lockValue) {
    await interaction.reply({
      content: 'Could not acquire creation lock. Please try again.',
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply({
    ephemeral: true
  });

  try {
    const [selectedValue] = interaction.values;
    const selectedTag = TICKET_TAGS.find((tag) => tag.value === selectedValue);

    if (!selectedTag) {
      await interaction.editReply({
        content: 'Unknown ticket category selected.'
      });
      return;
    }

    await createTicketFromTag(interaction, selectedTag);
  } finally {
    // Always release the lock
    await lockService.releaseCreationLock(
      interaction.guildId,
      interaction.user.id,
      lockValue
    );
  }
}

/**
 * Handle button interactions
 */
export async function handleButton(interaction) {
  const customId = interaction.customId;

  // Handle resolved button
  const resolvedCreatorId = parseResolvedCreatorId(customId);
  if (resolvedCreatorId) {
    await toggleResolved(interaction, resolvedCreatorId);
    return;
  }

  // Handle add users button
  const addThreadId = parseAddUsersThreadId(customId);
  if (addThreadId) {
    await handleAddUsersButton(interaction, addThreadId);
    return;
  }

  // Handle remove users button
  const removeThreadId = parseRemoveUsersThreadId(customId);
  if (removeThreadId) {
    await handleRemoveUsersButton(interaction, removeThreadId);
    return;
  }
}

/**
 * Handle modal submissions
 */
export async function handleModalSubmit(interaction) {
  const customId = interaction.customId;

  // Handle add users modal
  const addThreadId = parseAddUsersModalThreadId(customId);
  if (addThreadId) {
    await handleAddUsersModalSubmit(interaction, addThreadId);
    return;
  }

  // Handle remove users modal
  const removeThreadId = parseRemoveUsersModalThreadId(customId);
  if (removeThreadId) {
    await handleRemoveUsersModalSubmit(interaction, removeThreadId);
    return;
  }
}

/**
 * Main interaction router
 */
export async function handleInteraction(interaction) {
  // Handle chat input commands
  if (interaction.isChatInputCommand() && TICKET_COMMAND_NAMES.has(interaction.commandName)) {
    return; // Let the command handler deal with this
  }

  // Handle string select menus
  if (interaction.isStringSelectMenu() && interaction.customId === CUSTOM_IDS.ticketTagSelect) {
    await handleTicketTagSelect(interaction);
    return;
  }

  // Handle button interactions
  if (interaction.isButton()) {
    await handleButton(interaction);
    return;
  }

  // Handle modal submissions
  if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction);
    return;
  }
}
