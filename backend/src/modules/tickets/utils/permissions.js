/**
 * Permission checking utilities
 */

import { PermissionFlagsBits } from 'discord.js';
import { TICKET_STAFF_ROLE_IDS } from './constants.js';

/**
 * Checks if a member is ticket staff-like (has admin/permissions or staff role)
 * Also includes server owner
 */
export function isTicketStaffLike(member, guild, userId) {
  if (!member || !guild || !userId) return false;
  if (guild.ownerId === userId) return true;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  return TICKET_STAFF_ROLE_IDS.some((roleId) => member.roles?.cache?.has(roleId));
}

/**
 * Checks if the interaction user is ticket staff from an interaction
 */
export function isTicketStaffFromInteraction(interaction) {
  if (!interaction.inGuild()) return false;
  return isTicketStaffLike(interaction.member, interaction.guild, interaction.user?.id);
}

/**
 * Checks if the interaction user is admin or server owner
 */
export function isAdminOrOwnerFromInteraction(interaction) {
  if (!interaction.inGuild()) return false;
  if (interaction.guild?.ownerId === interaction.user?.id) return true;
  return interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator);
}

/**
 * Requires the interaction user to be ticket staff
 * Replies with an error if they don't have permission
 * Returns true if authorized, false otherwise
 */
export async function requireTicketStaff(interaction) {
  if (isTicketStaffFromInteraction(interaction)) return true;

  const payload = { content: 'You are not allowed to use ticket commands.' };
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
  } else {
    await interaction.reply({ ...payload, ephemeral: true });
  }
  return false;
}

/**
 * Requires the interaction user to be admin or server owner
 * Replies with an error if they don't have permission
 * Returns true if authorized, false otherwise
 */
export async function requireAdminOrOwner(interaction) {
  if (isAdminOrOwnerFromInteraction(interaction)) return true;

  const payload = { content: 'Only server owner or admins can use this command.' };
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
  } else {
    await interaction.reply({ ...payload, ephemeral: true });
  }
  return false;
}

export default {
  isTicketStaffLike,
  isTicketStaffFromInteraction,
  isAdminOrOwnerFromInteraction,
  requireTicketStaff,
  requireAdminOrOwner
};
