import { format } from "date-fns";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useGuildOverview } from "@/lib/api";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
  context?: Record<string, unknown>;
};

type LogMessage =
  | { type: "backlog"; entries: LogEntry[] }
  | { type: "log"; entry: LogEntry };

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "text-zinc-400 dark:text-zinc-500",
  info: "text-green-700 dark:text-[#10540E]",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
};

const LEVEL_BADGES: Record<LogLevel, string> = {
  debug: "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300",
  info: "bg-green-100 text-green-700 dark:bg-[#10540E]/10 dark:text-[#10540E]",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  error: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
};

function formatTime(ts: string) {
  return format(new Date(ts), "HH:mm:ss");
}

function formatContext(ctx?: Record<string, unknown>): string {
  if (!ctx || Object.keys(ctx).length === 0) return "";
  const pairs = Object.entries(ctx)
    .filter(([_, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  return pairs ? ` [${pairs}]` : "";
}

function formatMeta(meta?: Record<string, unknown>): string {
  if (!meta) return "";
  const keys = Object.keys(meta);
  if (keys.length === 0) return "";
  const sub = keys.slice(0, 3).map((k) => {
    const v = typeof meta[k] === "string" ? meta[k] : JSON.stringify(meta[k]);
    return v.length > 80 ? v.slice(0, 80) + "..." : v;
  }).join(" ");
  return sub ? ` — ${sub}` : "";
}

function LogLine({ entry }: { entry: LogEntry }) {
  const time = formatTime(entry.timestamp);
  const levelLabel = entry.level.toUpperCase().padEnd(5);
  const ctx = formatContext(entry.context);
  const meta = formatMeta(entry.meta);

  return (
    <div className="flex w-full flex-wrap items-baseline gap-x-1 gap-y-0 leading-relaxed hover:bg-zinc-100 dark:hover:bg-white/5">
      <span className="shrink-0 tabular-nums text-zinc-400 dark:text-zinc-600">{time}</span>
      <span className={`shrink-0 rounded px-1 text-[11px] font-semibold uppercase tracking-wider ${LEVEL_BADGES[entry.level]}`}>
        {levelLabel}
      </span>
      <span className={`min-w-0 break-words ${LEVEL_COLORS[entry.level]}`}>
        {entry.message}
        {ctx && <span className="text-zinc-400 dark:text-zinc-500">{ctx}</span>}
        {meta && <span className="text-zinc-400 dark:text-zinc-600">{meta}</span>}
      </span>
    </div>
  );
}

function AutoScroll({ children, logs }: { children: React.ReactNode; logs: LogEntry[] }) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  const scrollToBottom = useCallback(() => {
    sentinelRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sentinelRef]);

  useEffect(() => {
    if (autoScroll) scrollToBottom();
  }, [autoScroll, scrollToBottom, logs.length]);

  const copyLogs = useCallback(async () => {
    const text = logs
      .map((entry) => {
        const time = formatTime(entry.timestamp);
        const level = entry.level.toUpperCase().padEnd(5);
        const ctx = formatContext(entry.context);
        const meta = formatMeta(entry.meta);
        return `${time} [${level}] ${entry.message}${ctx}${meta}`;
      })
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [logs]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-x-auto overflow-y-auto font-mono text-[13px] leading-relaxed">
        <pre className="m-0 inline p-0 leading-relaxed whitespace-pre-wrap break-words">
          {children}
        </pre>
        <div ref={sentinelRef} />
      </div>
      <div className="sticky bottom-0 flex items-center justify-between border-t border-zinc-200 bg-white/90 px-3 py-1.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setAutoScroll(!autoScroll); if (!autoScroll) scrollToBottom(); }}
            className={`rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider transition-colors ${
              autoScroll ? "bg-[#10540E]/10 text-[#10540E]" : "bg-zinc-200 text-zinc-500 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            Auto-scroll {autoScroll ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            onClick={scrollToBottom}
            className="rounded bg-zinc-200 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500 transition-colors hover:bg-zinc-300 hover:text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            Bottom
          </button>
        </div>
        <button
          type="button"
          onClick={copyLogs}
          className="rounded px-3 py-0.5 text-[11px] font-medium uppercase tracking-wider transition-colors bg-zinc-200 text-zinc-500 hover:bg-zinc-300 hover:text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function LiveTab({ gid }: { gid: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;

    const connect = async () => {
      try {
        const ticketRes = await fetch(`/api/dashboard/guild/${gid}/logs-socket-ticket`, {
          method: "POST",
        });

        if (!ticketRes.ok) {
          const data = await ticketRes.json().catch(() => ({}));
          throw new Error(data?.error || "failed_to_get_ticket");
        }

        const { ticket, wsUrl } = await ticketRes.json();
        if (!ticket || !wsUrl) throw new Error("invalid_ticket_response");

        const url = `${wsUrl}?ticket=${encodeURIComponent(ticket)}`;
        ws = new WebSocket(url);

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
          } catch {}
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
      ws?.close();
    };
  }, [gid]);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <AutoScroll logs={logs}>
        {logs.length > 0 ? (
          logs.map((entry, i) => <LogLine key={i} entry={entry} />)
        ) : (
          <span className="font-mono text-zinc-400 dark:text-zinc-600">Waiting for log entries...</span>
        )}
      </AutoScroll>
      <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-3 py-1 dark:border-zinc-800">
        <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-[#10540E]" : "bg-red-500"}`} />
        <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{connected ? "LIVE" : "DISCONNECTED"}</span>
      </div>
    </div>
  );
}

export default function GuildLogsPage() {
  const router = useRouter();
  const { guildId } = router.query;
  const gid = typeof guildId === "string" ? guildId : undefined;

  const [modules, setModules] = useState<{ name: string; display_name?: string; enabled?: boolean }[]>([]);
  const { data: overviewData } = useGuildOverview(gid);

  useEffect(() => {
    if (overviewData?.modules) {
      setModules(overviewData.modules as any[]);
    }
  }, [overviewData]);

  return (
    <DashboardLayout guildId={gid ?? ""} heading="Logs" modules={modules}>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center border-b border-zinc-200 bg-white/80 px-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
          <div className="flex items-center gap-1.5 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#10540E]" />
          </div>
          <span className="ml-4 select-none font-mono text-[13px] font-semibold tracking-tight text-zinc-500 dark:text-zinc-400">
            AOI00.dat
          </span>
        </div>
        {gid && <LiveTab gid={gid} />}
      </div>
    </DashboardLayout>
  );
}
