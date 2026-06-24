const STATUS_COLORS: Record<string, string> = {
  online: "#22c55e",
  idle: "#eab308",
  dnd: "#ef4444",
  invisible: "#6b7280",
};

const ACTIVITY_PREFIX: Record<string, string> = {
  playing: "Playing",
  streaming: "Streaming",
  listening: "Listening to",
  watching: "Watching",
  competing: "Competing in",
  custom: "",
  none: "",
};

const FONT_STACK: Record<string, string> = {
  Bangers: "'Bangers', cursive",
  BioRhyme: "'BioRhyme', serif",
  "Cherry Bomb": "'Cherry Bomb', cursive",
  Chicle: "'Chicle', cursive",
  Compagnon: "'Compagnon', serif",
  MuseoModerno: "'MuseoModerno', cursive",
  "Neo-Castel": "'Neo-Castel', serif",
  "Pixelify Sans": "'Pixelify Sans', sans-serif",
  Ribes: "'Ribes', serif",
  Sinistre: "'Sinistre', serif",
  Default: "inherit",
  "Zilla Slab": "'Zilla Slab', serif",
};

export function BotProfilePreview({
  status,
  activityType,
  activityText,
  customStatus,
  streamingUrl,
  fontLabel,
  effectLabel,
  primaryColor,
  secondaryColor,
  useGradient,
}: {
  status: string;
  activityType: string;
  activityText: string;
  customStatus: string;
  streamingUrl: string;
  fontLabel: string;
  effectLabel: string;
  primaryColor: string;
  secondaryColor: string;
  useGradient: boolean;
}) {
  const prefix = ACTIVITY_PREFIX[activityType] || "";

  let nameStyle: React.CSSProperties = {
    fontFamily: FONT_STACK[fontLabel] || "inherit",
    fontWeight: 700,
  };

  if (useGradient && primaryColor && secondaryColor) {
    nameStyle = {
      ...nameStyle,
      background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    };
  } else if (primaryColor) {
    nameStyle = {
      ...nameStyle,
      color: primaryColor,
      textShadow: effectLabel === "Glow" ? `0 0 12px ${primaryColor}80` : undefined,
    };
  } else {
    nameStyle = { ...nameStyle, color: "#fff" };
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold" style={nameStyle}>
              AOI
            </span>
          </div>

          {activityType === "custom" && customStatus && (
            <div className="mt-1 text-sm text-zinc-400 italic">
              &ldquo;{customStatus}&rdquo;
            </div>
          )}

          {activityType !== "custom" && activityType !== "none" && (prefix || activityText) && (
            <div className="mt-1 text-sm text-zinc-400">
              {prefix && <span className="font-medium text-zinc-300">{prefix} </span>}
              {activityText && <span>{activityText}</span>}
            </div>
          )}

          {activityType === "streaming" && streamingUrl && (
            <div className="mt-1 text-xs text-purple-400 truncate">{streamingUrl}</div>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-300"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] || STATUS_COLORS.invisible }} />
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>

          </div>
        </div>
      </div>
    </div>
  );
}
