const EMOJI_CDN =
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72";

function toCodePoint(emoji: string): string {
  const codePoints: string[] = [];
  for (const char of emoji) {
    codePoints.push(char.codePointAt(0)!.toString(16));
  }
  return codePoints.join("-");
}

export function Twemoji({
  emoji,
  className,
}: {
  emoji: string;
  className?: string;
}) {
  return (
    <img
      className={className}
      src={`${EMOJI_CDN}/${toCodePoint(emoji)}.png`}
      alt={emoji}
      title={emoji}
    />
  );
}
