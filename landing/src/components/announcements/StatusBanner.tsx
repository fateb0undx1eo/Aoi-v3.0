import type { StatusMsg } from "./types";

export default function StatusBanner({ status }: { status: StatusMsg }) {
  if (!status || status.state === "idle") return null;
  const m: Record<string, string> = {
    success: "border-emerald-700/60 bg-emerald-500/10 text-emerald-300",
    error: "border-red-700/60 bg-red-500/10 text-red-300",
    info: "border-sky-700/60 bg-sky-500/10 text-sky-300",
    sending: "border-amber-700/60 bg-amber-500/10 text-amber-300",
  };
  return <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${m[status.state] || "text-zinc-400"}`}>{status.text}</div>;
}
