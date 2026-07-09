import { Zap } from "lucide-react";
import { CoolIcon } from "@/components/icons/CoolIcon";
import type { FlowAction } from "./types";

const actionMeta: Record<FlowAction["type"], { label: string; desc: string; group: string }> = {
  add_role:       { label: "Add Role",       desc: "Grant a role to the user", group: "roles" },
  remove_role:    { label: "Remove Role",    desc: "Remove a role from the user", group: "roles" },
  create_role:    { label: "Create Role",    desc: "Create a new role and assign it", group: "roles" },
  delete_role:    { label: "Delete Role",    desc: "Delete a role", group: "roles" },
  send_message:   { label: "Send Message",   desc: "Post a message in a channel", group: "messages" },
  send_dm:        { label: "Send DM",        desc: "DM the user who interacted", group: "messages" },
  reply:          { label: "Reply",          desc: "Reply to the interaction", group: "messages" },
  edit_response:  { label: "Edit Response",  desc: "Edit the bot's response", group: "messages" },
  delete_response:{ label: "Delete Response",desc: "Delete the interaction response", group: "messages" },
  create_thread:  { label: "Create Thread",  desc: "Create a thread from the message", group: "threads" },
  create_ticket:  { label: "Create Ticket",  desc: "Open a ticket channel", group: "tickets" },
  close_ticket:   { label: "Close Ticket",   desc: "Close the current ticket", group: "tickets" },
  webhook:        { label: "Webhook",        desc: "Send a webhook request", group: "advanced" },
  modal:          { label: "Modal",          desc: "Open a modal for user input", group: "advanced" },
  log:            { label: "Log",            desc: "Log to a channel", group: "advanced" },
  custom:         { label: "Custom Event",   desc: "Emit a custom bot event", group: "advanced" },
};

const groupOrder = ["roles", "messages", "threads", "tickets", "advanced"] as const;
const groupLabels: Record<string, string> = {
  roles: "Role Actions",
  messages: "Message Actions",
  threads: "Thread & Ticket",
  tickets: "Ticket Only",
  advanced: "Advanced",
};

export default function FlowActionEditor({ actions, onChange, isButton, isSelect, options }: {
  actions: FlowAction[];
  onChange: (a: FlowAction[]) => void;
  isButton: boolean;
  isSelect: boolean;
  options?: { label: string; value: string }[];
}) {
  const addAction = (type: FlowAction["type"]) => {
    const action: FlowAction = { type };
    if (type === "send_message" || type === "reply" || type === "edit_response" || type === "send_dm") action.message_content = "";
    if (type === "custom") { action.custom_event = ""; action.custom_data = ""; }
    if (type === "create_thread") action.thread_name = "";
    if (type === "create_role") { action.role_name = ""; action.role_color = ""; }
    if (type === "webhook") { action.webhook_url = ""; action.webhook_body = ""; }
    if (type === "modal") { action.modal_title = ""; action.modal_custom_id = ""; action.modal_components = ""; }
    if (type === "log") { action.log_channel_id = ""; action.log_template = ""; }
    if (type === "reply") action.reply_message_id = "";
    if (type === "edit_response") action.edit_content = "";
    if (type === "create_ticket") action.channel_id = "";
    if (type === "close_ticket") action.channel_id = "";
    onChange([...actions, action]);
  };
  const updateAction = (i: number, upd: Partial<FlowAction>) => {
    onChange(actions.map((a, j) => j === i ? { ...a, ...upd } : a));
  };
  const removeAction = (i: number) => onChange(actions.filter((_, j) => j !== i));

  const groupedActions = groupOrder.map((group) => ({
    group,
    label: groupLabels[group],
    types: Object.entries(actionMeta).filter(([, m]) => m.group === group).map(([type]) => type as FlowAction["type"]),
  }));

  return (
    <div className="space-y-1.5">
      {actions.length === 0 && (
        <p className="text-[10px] text-zinc-600">No actions configured. When this component is interacted with, nothing extra will happen.</p>
      )}
      {actions.map((action, i) => (
        <div key={i} className="rounded-lg border border-zinc-800 bg-black p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1 text-[10px] font-medium text-zinc-400">
              <Zap className="h-2.5 w-2.5 text-amber-400" />
              {actionMeta[action.type]?.label || action.type}
              {isSelect && action.option_value && (
                <span className="rounded bg-zinc-800 px-1 text-[8px] text-zinc-500">on: {action.option_value}</span>
              )}
            </span>
            <button type="button" onClick={() => removeAction(i)} className="text-zinc-600 hover:text-red-400"><CoolIcon icon="Close_MD" size={12} /></button>
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
            {action.type === "create_role" && (
              <>
                <input type="text" value={action.role_name || ""} onChange={(e) => updateAction(i, { role_name: e.target.value })}
                  placeholder="Role name" className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none" />
                <input type="text" value={action.role_color || ""} onChange={(e) => updateAction(i, { role_color: e.target.value })}
                  placeholder="Color (hex, e.g. #FF0000)" className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none font-mono" />
              </>
            )}
            {action.type === "delete_role" && (
              <input type="text" value={action.role_id || ""} onChange={(e) => updateAction(i, { role_id: e.target.value })}
                placeholder="Role ID to delete" className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none font-mono" />
            )}
            {(action.type === "send_message" || action.type === "send_dm" || action.type === "reply" || action.type === "edit_response") && (
              <textarea value={action.message_content || action.edit_content || ""}
                onChange={(e) => {
                  if (action.type === "edit_response") updateAction(i, { edit_content: e.target.value });
                  else updateAction(i, { message_content: e.target.value });
                }}
                placeholder="Message content..." rows={2} maxLength={2000}
                className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600 outline-none resize-none" />
            )}
            {action.type === "send_message" && (
              <input type="text" value={action.channel_id || ""}
                onChange={(e) => updateAction(i, { channel_id: e.target.value || undefined })}
                placeholder="Channel ID (leave empty for current)" className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none font-mono" />
            )}
            {(action.type === "reply" || action.type === "edit_response") && (
              <input type="text" value={action.reply_message_id || ""}
                onChange={(e) => updateAction(i, { reply_message_id: e.target.value || undefined })}
                placeholder={action.type === "edit_response" ? 'Message ID or "@original"' : "Reply to message ID (optional)"}
                className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none font-mono" />
            )}
            {action.type === "create_thread" && (
              <input type="text" value={action.thread_name || ""}
                onChange={(e) => updateAction(i, { thread_name: e.target.value })}
                placeholder="Thread name" className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none" />
            )}
            {action.type === "create_ticket" && (
              <input type="text" value={action.channel_id || ""}
                onChange={(e) => updateAction(i, { channel_id: e.target.value || undefined })}
                placeholder="Category/Channel ID" className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none font-mono" />
            )}
            {action.type === "webhook" && (
              <>
                <input type="url" value={action.webhook_url || ""}
                  onChange={(e) => updateAction(i, { webhook_url: e.target.value })}
                  placeholder="Webhook URL" className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none font-mono" />
                <textarea value={action.webhook_body || ""}
                  onChange={(e) => updateAction(i, { webhook_body: e.target.value })}
                  placeholder='JSON body (optional)...' rows={2}
                  className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600 outline-none resize-none font-mono" />
              </>
            )}
            {action.type === "modal" && (
              <>
                <input type="text" value={action.modal_title || ""}
                  onChange={(e) => updateAction(i, { modal_title: e.target.value })}
                  placeholder="Modal title" className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none" />
                <input type="text" value={action.modal_custom_id || ""}
                  onChange={(e) => updateAction(i, { modal_custom_id: e.target.value })}
                  placeholder="Modal custom ID" className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none font-mono" />
                <textarea value={action.modal_components || ""}
                  onChange={(e) => updateAction(i, { modal_components: e.target.value })}
                  placeholder='Components JSON (action rows)...' rows={2}
                  className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600 outline-none resize-none font-mono" />
              </>
            )}
            {action.type === "log" && (
              <>
                <input type="text" value={action.log_channel_id || ""}
                  onChange={(e) => updateAction(i, { log_channel_id: e.target.value })}
                  placeholder="Log channel ID" className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none font-mono" />
                <textarea value={action.log_template || ""}
                  onChange={(e) => updateAction(i, { log_template: e.target.value })}
                  placeholder='Log message template...' rows={2}
                  className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600 outline-none resize-none font-mono" />
              </>
            )}
            {action.type === "custom" && (
              <>
                <input type="text" value={action.custom_event || ""}
                  onChange={(e) => updateAction(i, { custom_event: e.target.value })}
                  placeholder="Event name" className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none font-mono" />
                <textarea value={action.custom_data || ""}
                  onChange={(e) => updateAction(i, { custom_data: e.target.value })}
                  placeholder="JSON data..." rows={2}
                  className="w-full rounded border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600 outline-none resize-none font-mono" />
              </>
            )}
          </div>
        </div>
      ))}
      <div className="space-y-1">
        {groupedActions.map(({ group, label, types }) => (
          <div key={group}>
            <p className="mb-0.5 text-[9px] uppercase tracking-wider text-zinc-600">{label}</p>
            <div className="flex flex-wrap gap-1">
              {types.map((type) => (
                <button key={type} type="button" onClick={() => addAction(type)}
                  className="flex items-center justify-center w-6 h-6 rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
                  <CoolIcon icon="Add_Plus" size={14} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
