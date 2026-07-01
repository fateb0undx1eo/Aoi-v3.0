const DISCORD_TO_UNICODE: Record<string, string> = {};

export function findEmoji(content: string): string | undefined {
  const emojiRegex =
    /[\u{1F000}-\u{1FFFF}]|[\u2600-\u27BF]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]|[\u{2300}-\u{23FF}]/u;
  const match = content.match(emojiRegex);
  return match?.[0];
}

export function getEmojiName(emoji: string): string | undefined {
  return emoji;
}

export function translateNamedEmoji(
  source: string,
): { content: string; offset: number; name?: string } {
  const match = /^:(\w+):/.exec(source);
  if (match) {
    return { content: match[0], offset: match[0].length, name: match[1] };
  }
  return { content: source[0] ?? "", offset: 1 };
}

export function trimToNearestNonSymbolEmoji(content: string): string {
  return content;
}
