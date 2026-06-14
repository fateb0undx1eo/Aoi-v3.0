import type { Interaction } from 'discord.js';

function includeAny(targets: string[] = [], candidates: string[] = []): boolean {
  if (!Array.isArray(targets) || targets.length === 0) return true;
  return candidates.some((value) => targets.includes(value));
}

interface PermissionOverrides {
  discordPermissions?: string[];
  roles?: string[];
  users?: string[];
  channels?: string[];
}

export class PermissionService {
  isAllowed(interaction: Interaction, overrides: PermissionOverrides = {}): boolean {
    const memberRoles: string[] = interaction.member && 'roles' in interaction.member
      ? [...((interaction.member as any).roles?.cache?.keys?.() ?? [])]
      : [];
    const userId = interaction.user?.id;
    const channelId = (interaction as any).channelId;

    const allowedUsers = overrides?.users ?? [];
    const allowedRoles = overrides?.roles ?? [];
    const allowedChannels = overrides?.channels ?? [];
    const requiredDiscordPermissions = overrides?.discordPermissions ?? [];

    const userAllowed = allowedUsers.length === 0 || allowedUsers.includes(userId);
    const roleAllowed = includeAny(allowedRoles, memberRoles);
    const channelAllowed = allowedChannels.length === 0 || allowedChannels.includes(channelId);
    const permissionsAllowed =
      requiredDiscordPermissions.length === 0 ||
      (interaction as any).memberPermissions?.has?.(requiredDiscordPermissions, true);

    return userAllowed && roleAllowed && channelAllowed && permissionsAllowed;
  }
}
