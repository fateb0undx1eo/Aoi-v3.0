function includeAny(targets = [], candidates = []) {
  if (!Array.isArray(targets) || targets.length === 0) return true;
  return candidates.some((value) => targets.includes(value));
}

export class PermissionService {
  isAllowed(interaction, overrides = {}) {
    const memberRoles = [...(interaction.member?.roles?.cache?.keys?.() ?? [])];
    const userId = interaction.user?.id;
    const channelId = interaction.channelId;

    const allowedUsers = overrides?.users ?? [];
    const allowedRoles = overrides?.roles ?? [];
    const allowedChannels = overrides?.channels ?? [];
    const requiredDiscordPermissions = overrides?.discordPermissions ?? [];

    const userAllowed = allowedUsers.length === 0 || allowedUsers.includes(userId);
    const roleAllowed = includeAny(allowedRoles, memberRoles);
    const channelAllowed = allowedChannels.length === 0 || allowedChannels.includes(channelId);
    const permissionsAllowed =
      requiredDiscordPermissions.length === 0 ||
      interaction.memberPermissions?.has?.(requiredDiscordPermissions, true);

    return userAllowed && roleAllowed && channelAllowed && permissionsAllowed;
  }
}
