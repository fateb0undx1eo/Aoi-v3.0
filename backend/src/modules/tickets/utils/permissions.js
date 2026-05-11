import { PermissionFlagsBits } from 'discord.js';

/**
 * Permission utilities for ticket system
 */

const TICKET_STAFF_ROLE_IDS = [
  '1457403601512169724'
];

/**
 * Check if member has ticket staff permissions
 */
export function isTicketStaffLike(member, guild, userId) {
  if (!member || !guild || !userId) return false;

  if (guild.ownerId === userId) return true;

  if (member.permissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  return TICKET_STAFF_ROLE_IDS.some((roleId) =>
    member.roles?.cache?.has(roleId)
  );
}

/**
 * Check if interaction user has ticket staff permissions
 */
export function isTicketStaffFromInteraction(interaction) {
  if (!interaction.inGuild()) return false;

  return isTicketStaffLike(
    interaction.member,
    interaction.guild,
    interaction.user?.id
  );
}

/**
 * Check if user is admin or server owner
 */
export function isAdminOrOwnerFromInteraction(interaction) {
  if (!interaction.inGuild()) return false;
  if (interaction.guild?.ownerId === interaction.user?.id) return true;
  return interaction.memberPermissions?.has?.(
    PermissionFlagsBits.Administrator
  );
}

/**
 * Require ticket staff permissions with error response
 */
export async function requireTicketStaff(interaction) {
  if (isTicketStaffFromInteraction(interaction)) return true;

  const payload = {
    content: 'You are not allowed to use ticket commands.'
  };

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
  } else {
    await interaction.reply({
      ...payload,
      ephemeral: true
    });
  }

  return false;
}

/**
 * Check if user can be removed from ticket (not staff/admin/owner)
 */
export function canRemoveUser(member, guild, userId) {
  return !isTicketStaffLike(member, guild, userId);
}

/**
 * Get staff role IDs for mentions
 */
export function getStaffRoleIds() {
  return [...TICKET_STAFF_ROLE_IDS];
}

/**
 * Build staff mention string
 */
export function buildStaffMentions() {
  return TICKET_STAFF_ROLE_IDS
    .map((roleId) => `<@&${roleId}>`)
    .join(' ');
}

/**
 * Build ticket mention string (user + staff roles)
 */
export function buildTicketMentions(creatorId) {
  const roleMentions = buildStaffMentions();
  return `<@${creatorId}> ${roleMentions}`.trim();
}
