import { PermissionFlagsBits } from 'discord.js';
import { TICKET_STAFF_ROLE_IDS } from './constants.js';

export function isTicketStaffLike(member: any, guild: any, userId: string, staffRoleIds: string[]): boolean {
  if (!member || !guild || !userId) return false;
  if (guild.ownerId === userId) return true;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  return staffRoleIds.some((roleId) => member.roles?.cache?.has(roleId));
}

export function isTicketStaffFromInteraction(interaction: any, staffRoleIds?: string[]): boolean {
  if (!interaction.inGuild()) return false;
  return isTicketStaffLike(interaction.member, interaction.guild, interaction.user?.id, staffRoleIds || TICKET_STAFF_ROLE_IDS);
}

export function isAdminOrOwnerFromInteraction(interaction: any): boolean {
  if (!interaction.inGuild()) return false;
  if (interaction.guild?.ownerId === interaction.user?.id) return true;
  return interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator);
}

export async function requireTicketStaff(interaction: any, staffRoleIds?: string[]): Promise<boolean> {
  const roles = staffRoleIds || TICKET_STAFF_ROLE_IDS;
  if (isTicketStaffLike(interaction.member, interaction.guild, interaction.user?.id, roles)) return true;

  const payload = { content: 'You are not allowed to use ticket commands.' };
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
  } else {
    await interaction.reply({ ...payload, ephemeral: true });
  }
  return false;
}

export async function requireAdminOrOwner(interaction: any): Promise<boolean> {
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
