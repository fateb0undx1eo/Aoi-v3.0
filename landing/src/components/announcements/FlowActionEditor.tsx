import { Plus, X, Zap } from "lucide-react";
import type { FlowAction } from "./types";

export default function FlowActionEditor({ actions, onChange, isButton, isSelect, options }: {
  actions: FlowAction[];
  onChange: (a: FlowAction[]) => void;
  isButton: boolean;
  isSelect: boolean;
  options?: { label: string; value: string }[];
}) {
  const addAction = (type: FlowAction["type"]) => {
    const action: FlowAction = { type };
    if (type === "custom") { action.custom_event = ""; action.custom_data = ""; }
    if (type === "send_message") { action.message_content = ""; }
    if (type === "create_thread") { action.thread_name = ""; }
    onChange([...actions, action]);
  };
  const updateAction = (i: number, upd: Partial<FlowAction>) => {
    onChange(actions.map((a, j) => j === i ? { ...a, ...upd } : a));
  };
  const removeAction = (i: number) => onChange(actions.filter((_, j) => j !== i));

  const actionLabels: Record<FlowAction["type"], string> = {
    add_role: "Add Role",
    remove_role: "Remove Role",
    send_message: "Send Message",
    create_thread: "Create Thread",
    custom: "Custom Event",
  };

  return (
    <div className="space-y-1.5">
      {actions.length === 0 && (
        <p className="text-[10px] text-zinc-600">No actions configured. When this component is interacted with, nothing extra will happen.</p>
      )}
      {actions.map((action, i) => (
        <div key={i} className="rounded-lg border border-zinc-800 bg-black/40 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1 text-[10px] font-medium text-zinc-400">
              <Zap className="h-2.5 w-2.5 text-amber-400" />
              {actionLabels[action.type] || action.type}
              {isSelect && action.option_value && (
                <span className="rounded bg-zinc-800 px-1 text-[8px] text-zinc-500">on: {action.option_value}</span>
              )}
            </span>
            <button type="button" onClick={() => removeAction(i)} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
          </div>
          <div className="space-y-1">
            {isSelect && (
              <select value={action.option_value || ""} onChange={(e) => updateAction(i, { option_value: e.target.value || undefined })}
                className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none">
                <option value="">— On any option —</option>
                {options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label || opt.value}</option>)}
              </select>
            )}
            {(action.type === "add_role" || action.type === "remove_role") && (
              <input type="text" value={action.role_id || ""} onChange={(e) => updateAction(i, { role_id: e.target.value })}
                placeholder="Role ID" className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none font-mono" />
            )}
            {action.type === "send_message" && (
              <textarea value={action.message_content || ""} onChange={(e) => updateAction(i, { message_content: e.target.value })}
                placeholder="Message content..." rows={2} maxLength={2000}
                className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600 outline-none resize-none" />
            )}
            {action.type === "create_thread" && (
              <input type="text" value={action.thread_name || ""} onChange={(e) => updateAction(i, { thread_name: e.target.value })}
                placeholder="Thread name" className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none" />
            )}
            {action.type === "custom" && (
              <>
                <input type="text" value={action.custom_event || ""} onChange={(e) => updateAction(i, { custom_event: e.target.value })}
                  placeholder="Event name" className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none font-mono" />
                <textarea value={action.custom_data || ""} onChange={(e) => updateAction(i, { custom_data: e.target.value })}
                  placeholder="JSON data..." rows={2}
                  className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600 outline-none resize-none font-mono" />
              </>
            )}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-1">
        {(["add_role", "remove_role", "send_message", "create_thread", "custom"] as const).map((type) => (
          <button key={type} type="button" onClick={() => addAction(type)}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] uppercase text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
            <Plus className="h-2 w-2" /> {actionLabels[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
