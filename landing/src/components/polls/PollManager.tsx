import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  Hourglass,
  Loader2,
  Minus,
  Music4,
  OctagonX,
  Plus,
  RefreshCw,
  RotateCcw,
  Swords,
  Trash2,
} from "lucide-react";

import { useToasts } from "@/components/announcements/ToastContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PollRow, PollTotals } from "./types";

interface ManagedPoll {
  poll: PollRow;
  totals: PollTotals[];
}

const SHIFT_STEPS = [
  { label: "-1h", ms: -3_600_000 },
  { label: "-15m", ms: -900_000 },
  { label: "+15m", ms: 900_000 },
  { label: "+1h", ms: 3_600_000 },
  { label: "+12h", ms: 43_200_000 },
];

function totalVotes(totals: PollTotals[]): number {
  return totals.reduce((sum, t) => sum + (Number(t.count) || 0), 0);
}

function pollTitle(poll: PollRow): string {
  if (poll.title.trim()) return poll.title;
  if (poll.type === "music") return poll.options[0]?.label || "Music poll";
  return "Untitled poll";
}

function endsInLabel(endsAt: string | null, now: number): string {
  if (!endsAt) return "No timer";
  const diff = new Date(endsAt).getTime() - now;
  if (!Number.isFinite(diff)) return "Unknown";
  if (diff <= 0) return "Closing…";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Under a minute left";
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m left` : `${hours}h left`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

export default function PollManager({
  guildId,
  channelNames,
  refreshSignal,
}: {
  guildId: string;
  channelNames: Record<string, string>;
  refreshSignal: number;
}) {
  const { addToast } = useToasts();
  const [polls, setPolls] = useState<ManagedPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustValue, setAdjustValue] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const fetchPolls = useCallback(async () => {
    try {
      const res = await fetch(`/api/backend/polls/${guildId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load polls");
      const list = Array.isArray(json?.polls) ? json.polls : [];
      setPolls(
        list.map((entry: any) =>
          entry?.poll
            ? { poll: entry.poll as PollRow, totals: (entry.totals ?? []) as PollTotals[] }
            : { poll: entry as PollRow, totals: [] as PollTotals[] },
        ),
      );
    } catch (error: any) {
      addToast("error", error?.message ?? "Failed to load polls");
    } finally {
      setLoading(false);
    }
  }, [guildId, addToast]);

  useEffect(() => {
    void fetchPolls();
  }, [fetchPolls, refreshSignal]);

  // Countdown labels tick locally every second (no network).
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(clock);
  }, []);

  const [liveState, setLiveState] = useState<"connecting" | "live" | "offline">("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // Live vote/result stream over the poll socket. Falls back to a 30s
  // refresh when the socket is unreachable; every reconnect re-syncs.
  useEffect(() => {
    if (!guildId) return;

    const cleanupSocket = () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (reconnectTimerRef.current != null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelledRef.current) return;
      const attempt = Math.min(reconnectAttemptsRef.current + 1, 5);
      reconnectAttemptsRef.current = attempt;
      const delay = Math.min(2500 * attempt, 15000);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    async function connect() {
      cleanupSocket();
      setLiveState("connecting");
      try {
        const response = await fetch(`/api/dashboard/guild/${guildId}/poll-socket-ticket`, {
          method: "POST",
        });
        if (!response.ok) throw new Error("Failed to create realtime connection");
        const data = await response.json();
        if (!data?.ticket || !data?.wsUrl) throw new Error("Invalid realtime connection payload");

        const socket = new WebSocket(`${data.wsUrl}?ticket=${encodeURIComponent(data.ticket)}`);
        socketRef.current = socket;

        socket.onopen = () => {
          reconnectAttemptsRef.current = 0;
          setLiveState("live");
          // Re-sync on every (re)connect so nothing is missed while offline.
          void fetchPolls();
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message?.type !== "poll:update" || !message?.pollId) return;
            const incomingPoll = (message.poll ?? null) as PollRow | null;
            const incomingTotals = (message.totals ?? []) as PollTotals[];
            if (message.event === "finalized" || message.event === "deleted") {
              setPolls((prev) => prev.filter((entry) => entry.poll.id !== message.pollId));
              return;
            }
            if (!incomingPoll) return;
            setPolls((prev) => {
              const exists = prev.some((entry) => entry.poll.id === message.pollId);
              const next = { poll: incomingPoll, totals: incomingTotals };
              return exists
                ? prev.map((entry) => (entry.poll.id === message.pollId ? next : entry))
                : [next, ...prev];
            });
          } catch {
            /* ignore malformed frames */
          }
        };

        socket.onerror = () => setLiveState("offline");
        socket.onclose = () => {
          setLiveState("offline");
          scheduleReconnect();
        };
      } catch {
        setLiveState("offline");
        scheduleReconnect();
      }
    }

    connect();
    // Safety net: full re-sync every 60s in case a frame was missed.
    const safety = setInterval(() => void fetchPolls(), 60_000);
    return () => {
      cleanupSocket();
      clearInterval(safety);
    };
  }, [guildId, fetchPolls]);

  const mutate = useCallback(
    async (pollId: string, body: Record<string, unknown>, success: string) => {
      setBusyId(pollId);
      try {
        const res = await fetch(`/api/backend/polls/${guildId}/${pollId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Update failed");
        if (body.status === "closed") {
          // Finalized polls delete their rows — drop from the list.
          setPolls((prev) => prev.filter((entry) => entry.poll.id !== pollId));
        } else if (json?.poll) {
          setPolls((prev) =>
            prev.map((entry) =>
              entry.poll.id === pollId
                ? { poll: json.poll as PollRow, totals: (json.totals ?? entry.totals) as PollTotals[] }
                : entry,
            ),
          );
        } else {
          await fetchPolls();
        }
        addToast("success", success);
      } catch (error: any) {
        addToast("error", error?.message ?? "Update failed");
      } finally {
        setBusyId(null);
      }
    },
    [guildId, addToast, fetchPolls],
  );

  const remove = useCallback(
    async (pollId: string) => {
      setBusyId(pollId);
      try {
        const res = await fetch(`/api/backend/polls/${guildId}/${pollId}`, { method: "DELETE" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Delete failed");
        setPolls((prev) => prev.filter((entry) => entry.poll.id !== pollId));
        addToast("success", "Poll deleted.");
      } catch (error: any) {
        addToast("error", error?.message ?? "Delete failed");
      } finally {
        setBusyId(null);
      }
    },
    [guildId, addToast],
  );

  const applyCustomShift = useCallback(
    (poll: PollRow) => {
      const match = /^([+-]?)\s*(\d+(?:\.\d+)?)\s*([mhd])$/i.exec(adjustValue.trim());
      if (!match) {
        addToast("error", "Use e.g. +30m, -2h, +1d.");
        return;
      }
      const sign = match[1] === "-" ? -1 : 1;
      const amount = Number(match[2]);
      const unit = (match[3] ?? "m").toLowerCase();
      const ms = amount * (unit === "h" ? 3_600_000 : unit === "d" ? 86_400_000 : 60_000);
      if (!Number.isFinite(ms) || ms === 0) {
        addToast("error", "Use e.g. +30m, -2h, +1d.");
        return;
      }
      setAdjustId(null);
      setAdjustValue("");
      void mutate(poll.id, { shift_ms: sign * ms }, "Timer updated.");
    },
    [adjustValue, addToast, mutate],
  );

  const openPolls = useMemo(() => polls.filter((e) => e.poll.status === "open"), [polls]);
  const closedPolls = useMemo(() => polls.filter((e) => e.poll.status !== "open"), [polls]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading polls…
        </CardContent>
      </Card>
    );
  }

  if (polls.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">No active polls</CardTitle>
          <CardDescription>
            Open polls appear here with live votes and timer controls. Closed polls bake
            their results into Discord and are removed automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchPolls()} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  const renderEntry = (entry: ManagedPoll) => {
    const { poll, totals } = entry;
    const votes = totalVotes(totals);
    const busy = busyId === poll.id;
    const jump = poll.message_id
      ? `https://discord.com/channels/${guildId}/${poll.channel_id}/${poll.message_id}`
      : null;
    return (
      <Card key={poll.id}>
        <CardContent className="flex flex-col gap-3 pt-5">
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {poll.type === "music" ? (
                  <Music4 className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <Swords className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate text-sm font-semibold">{pollTitle(poll)}</span>
                <Badge variant={poll.status === "open" ? "default" : "secondary"}>
                  {poll.status === "open" ? "Open" : "Closed"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                #{channelNames[poll.channel_id] ?? poll.channel_id} • {votes} vote{votes === 1 ? "" : "s"}
                {poll.status === "open" ? ` • ${endsInLabel(poll.ends_at, now)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void fetchPolls()}
                disabled={busy}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              {jump ? (
                <Button type="button" variant="outline" size="sm" asChild className="gap-1.5">
                  <a href={jump} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Open
                  </a>
                </Button>
              ) : null}
            </div>
          </div>

          {poll.type === "music" && poll.options[0] ? (
            <p className="truncate text-xs text-muted-foreground">
              {poll.options[0].label}
              {poll.options[0].track_artist ? ` — ${poll.options[0].track_artist}` : ""}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {poll.options.map((option) => {
                const entry2 = totals.find((t) => t.option_id === option.id);
                const count = Number(entry2?.count) || 0;
                const pct = Number(entry2?.pct) || 0;
                return (
                  <div key={option.id} className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 truncate font-medium">
                      {option.label || "Option"}
                    </span>
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                    </div>
                    <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
              {votes === 0 ? (
                <p className="text-xs text-muted-foreground">No votes yet — rows above fill in live.</p>
              ) : null}
            </div>
          )}

          {poll.status === "open" ? (
            <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Hourglass className="h-3.5 w-3.5" /> Adjust
                </span>
                {SHIFT_STEPS.map((step) => (
                  <Button
                    key={step.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void mutate(poll.id, { shift_ms: step.ms }, "Timer updated.")}
                    className="gap-1"
                  >
                    {step.ms > 0 ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {step.label.replace(/^[+-]/, "")}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setAdjustId(adjustId === poll.id ? null : poll.id);
                    setAdjustValue("");
                  }}
                >
                  Custom…
                </Button>
              </div>
              {adjustId === poll.id ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor={`poll-adjust-${poll.id}`}>Shift timer</Label>
                    <Input
                      id={`poll-adjust-${poll.id}`}
                      value={adjustValue}
                      onChange={(e) => setAdjustValue(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") applyCustomShift(poll);
                      }}
                      placeholder="+30m, -2h, +1d"
                      className="font-mono"
                    />
                  </div>
                  <Button type="button" size="sm" disabled={busy} onClick={() => applyCustomShift(poll)}>
                    Apply
                  </Button>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => void mutate(poll.id, { status: "closed" }, "Poll ended — results baked in.")}
                  className="gap-1.5"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <OctagonX className="h-3.5 w-3.5" />}
                  End now
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void remove(poll.id)}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void mutate(poll.id, { status: "open" }, "Poll reopened.")}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reopen
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void remove(poll.id)}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default">{openPolls.length} open</Badge>
        {closedPolls.length > 0 ? <Badge variant="secondary">{closedPolls.length} closed</Badge> : null}
        <Badge variant={liveState === "live" ? "default" : "secondary"}>
          {liveState === "live" ? "Live" : liveState === "connecting" ? "Connecting…" : "Reconnecting…"}
        </Badge>
        <span className="text-xs text-muted-foreground">Votes update the instant they land.</span>
      </div>
      {openPolls.map(renderEntry)}
      {closedPolls.length > 0 ? (
        <>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Closed</p>
          {closedPolls.map(renderEntry)}
        </>
      ) : null}
    </div>
  );
}
