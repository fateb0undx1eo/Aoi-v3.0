import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, any>;
  context?: Record<string, any>;
};

type LogMessage =
  | { type: "backlog"; entries: LogEntry[] }
  | { type: "log"; entry: LogEntry };

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "text-zinc-500",
  info: "text-emerald-400",
  warn: "text-amber-400",
  error: "text-red-400",
};

const LEVEL_BADGES: Record<LogLevel, string> = {
  debug: "bg-zinc-700 text-zinc-300",
  info: "bg-emerald-900/60 text-emerald-300",
  warn: "bg-amber-900/60 text-amber-300",
  error: "bg-red-900/60 text-red-300",
};

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false });
}

function formatContext(ctx?: Record<string, any>): string {
  if (!ctx || Object.keys(ctx).length === 0) return "";
  const pairs = Object.entries(ctx)
    .filter(([_, v]) => typeof v === "string" || typeof v === "number")
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  return pairs ? ` [${pairs}]` : "";
}

function formatMeta(meta?: Record<string, any>): string {
  if (!meta) return "";
  const keys = Object.keys(meta);
  if (keys.length === 0) return "";
  const sub = keys.slice(0, 3).map((k) => {
    const v = typeof meta[k] === "string" ? meta[k] : JSON.stringify(meta[k]);
    return v.length > 60 ? v.slice(0, 60) + "..." : v;
  }).join(" ");
  return sub ? ` — ${sub}` : "";
}

function LogLine({ entry }: { entry: LogEntry }) {
  const time = formatTime(entry.timestamp);
  const levelLabel = entry.level.toUpperCase().padEnd(5);
  const ctx = formatContext(entry.context);
  const meta = formatMeta(entry.meta);

  return (
    <div className="flex w-full flex-wrap gap-0 leading-relaxed hover:bg-white/5">
      <span className="shrink-0 text-zinc-600 tabular-nums">{time}</span>
      <span className={`mx-2 shrink-0 rounded px-1 text-[11px] font-semibold uppercase tracking-wider ${LEVEL_BADGES[entry.level]}`}>
        {levelLabel}
      </span>
      <span className={LEVEL_COLORS[entry.level]}>
        {entry.message}
        {ctx && <span className="text-zinc-500">{ctx}</span>}
        {meta && <span className="text-zinc-600">{meta}</span>}
      </span>
    </div>
  );
}

function AutoScroll({ children }: { children: React.ReactNode }) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto font-mono text-[13px] leading-relaxed">
        <pre className="m-0 inline p-0 leading-relaxed">
          {children}
        </pre>
        <div ref={sentinelRef} />
      </div>
      <AutoScroller sentinelRef={sentinelRef} />
    </div>
  );
}

function AutoScroller({ sentinelRef }: { sentinelRef: React.RefObject<HTMLDivElement | null> }) {
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    sentinelRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sentinelRef]);

  useEffect(() => {
    if (autoScroll) scrollToBottom();
  }, [autoScroll, scrollToBottom]);

  return (
    <div className="sticky bottom-0 flex items-center gap-3 border-t border-zinc-800 bg-zinc-950/90 px-3 py-1.5 backdrop-blur">
      <button
        type="button"
        onClick={() => { setAutoScroll(!autoScroll); if (!autoScroll) scrollToBottom(); }}
        className={`rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider transition-colors ${
          autoScroll ? "bg-emerald-900/50 text-emerald-300" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
        }`}
      >
        Auto-scroll {autoScroll ? "ON" : "OFF"}
      </button>
      <button
        type="button"
        onClick={scrollToBottom}
        className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
      >
        Bottom
      </button>
      <span className="ml-auto text-[11px] text-zinc-600">
        Ring buffer: 5000
      </span>
    </div>
  );
}

export default function GuildLogsPage() {
  const router = useRouter();
  const { guildId } = router.query;

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!guildId || typeof guildId !== "string") return;

    let cancelled = false;

    const connect = async () => {
      try {
        const ticketRes = await fetch(`/api/dashboard/guild/${guildId}/logs-socket-ticket`, {
          method: "POST",
        });

        if (!ticketRes.ok) {
          const data = await ticketRes.json().catch(() => ({}));
          throw new Error(data?.error || "failed_to_get_ticket");
        }

        const { ticket, wsUrl } = await ticketRes.json();
        if (!ticket || !wsUrl) throw new Error("invalid_ticket_response");

        const url = `${wsUrl}?ticket=${encodeURIComponent(ticket)}`;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!cancelled) setConnected(true);
        };

        ws.onmessage = (event) => {
          if (cancelled) return;
          try {
            const msg: LogMessage = JSON.parse(event.data);
            if (msg.type === "backlog") {
              setLogs(msg.entries);
            } else if (msg.type === "log") {
              setLogs((prev) => [...prev, msg.entry]);
            }
          } catch {
            // ignore malformed messages
          }
        };

        ws.onerror = () => {
          if (!cancelled) setError("WebSocket connection error");
        };

        ws.onclose = () => {
          if (!cancelled) setConnected(false);
        };
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "connection_failed");
      }
    };

    connect();

    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [guildId]);

  return (
    <DashboardLayout guildId={String(guildId || "")} heading="Logs">
      <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-700/60 bg-zinc-950 shadow-2xl" style={{ height: "calc(100vh - 130px)" }}>
        <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/90 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
            <span className="h-3 w-3 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
            <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
          </div>
          <span className="absolute left-1/2 -translate-x-1/2 select-none text-[12px] font-medium tracking-wide text-zinc-500">
            aoi@runtime:~$ — AOI Log Stream
          </span>
          <div className="ml-auto flex items-center gap-2.5">
            <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-red-500"}`} />
            <span className="text-[11px] text-zinc-600">{connected ? "LIVE" : "DISCONNECTED"}</span>
            <span className="text-[11px] text-zinc-700">{logs.length} entries</span>
          </div>
        </div>

        {error && (
          <div className="border-b border-red-900/50 bg-red-950/40 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <AutoScroll>
          {logs.length > 0 ? (
            logs.map((entry, i) => <LogLine key={i} entry={entry} />)
          ) : (
            <span className="text-zinc-600">Waiting for log entries...</span>
          )}
        </AutoScroll>
      </div>
    </DashboardLayout>
  );
}
