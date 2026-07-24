export function extractGuildId(args: any[]): string | null {
  const arg = args[0];
  if (!arg) return null;
  if (typeof arg.guildId === "string") return arg.guildId;
  if (arg.guild?.id) return arg.guild.id;
  return null;
}
