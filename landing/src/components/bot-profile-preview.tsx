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
}) {
  const prefix = ACTIVITY_PREFIX[activityType] || "";
  const displayActivity = customStatus || activityText || "No activity";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-700 text-xl font-bold text-zinc-300 ring-2 ring-zinc-600">
            B
          </div>
          <span
            className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-zinc-900"
            style={{ backgroundColor: STATUS_COLORS[status] || STATUS_COLORS.invisible }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className="text-lg font-bold"
              style={{
                fontFamily: fontLabel === "Default" ? undefined : fontLabel,
                color: primaryColor || "#fff",
                textShadow: effectLabel === "Glow" ? `0 0 12px ${primaryColor || "#5865F2"}80` : undefined,
              }}
            >
              AOI
            </span>
            {secondaryColor && (
              <span className="text-xs text-zinc-500">/ {secondaryColor}</span>
            )}
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">
              {effectLabel}
            </span>
          </div>

          {activityType === "custom" && customStatus && (
            <div className="mt-1 text-sm text-zinc-400 italic">
              &ldquo;{customStatus}&rdquo;
            </div>
          )}

          {prefix || (activityType !== "custom" && activityText) ? (
            <div className="mt-1 text-sm text-zinc-400">
              {prefix && <span className="font-medium text-zinc-300">{prefix} </span>}
              {activityType !== "custom" && activityText ? (
                <span>{activityText}</span>
              ) : null}
            </div>
          ) : null}

          {activityType === "streaming" && streamingUrl && (
            <div className="mt-1 text-xs text-purple-400">
              {streamingUrl}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-300">
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
        {(primaryColor || secondaryColor) && (
          <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-300">
            Colors active
          </span>
        )}
      </div>
    </div>
  );
}
