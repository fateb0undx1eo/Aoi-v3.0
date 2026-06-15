import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { LogIn, Save, X, ChevronDown } from "lucide-react";
import { useGuildMembers } from "@/lib/api";
import type { DmBroadcastForm, DmBroadcastPlainMessage, DmBroadcastBlock, DmBroadcastJob, SaveState } from "./types";
import { renderDmBroadcastPlainPreview, renderPreviewText, renderStatusMessage } from "./utils";

type Props = {
  guildId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guild: { name?: string } | null;
  emojis: { id: string; name: string; url: string }[];
};

const DEFAULT_DM_BROADCAST_FORM: DmBroadcastForm = {
  target_mode: "member",
  member_id: "",
  plain_messages: [
    {
      id: "dm-message-1",
      content: "Hey {username}, this is a DM from {server_name}.",
    },
  ],
  container_blocks: [
    { type: "text", content: "Add your container text here." },
  ],
  delay_seconds: 1.2,
};

export default function DmBroadcast({ guildId, open, onOpenChange, guild, emojis }: Props) {
  const [form, setForm] = useState<DmBroadcastForm>(DEFAULT_DM_BROADCAST_FORM);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const [jobId, setJobId] = useState("");

  const [memberQuery, setMemberQuery] = useState("");
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [debouncedMemberQuery, setDebouncedMemberQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMemberQuery(memberQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [memberQuery]);

  const { data: memberData, error: memberError } = useGuildMembers(
    guildId,
    open && form.target_mode === "member" ? debouncedMemberQuery : ""
  );
  const members = memberData?.members ?? [];

  const emojiById = useMemo(() => new Map(emojis.map((emoji) => [emoji.id, emoji])), [emojis]);

  const selectedDmMember = useMemo(
    () => members.find((member: any) => member.id === form.member_id) || null,
    [members, form.member_id]
  );

  function updateDmBlock(index: number, updates: Partial<DmBroadcastBlock>) {
    setForm((current) => ({
      ...current,
      container_blocks: current.container_blocks.map((block, blockIndex) =>
        blockIndex === index ? { ...block, ...updates } : block
      ),
    }));
  }

  function createDmPlainMessage(content = ""): DmBroadcastPlainMessage {
    return {
      id: `dm-plain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content,
    };
  }

  function updateDmPlainMessage(messageId: string, content: string) {
    setForm((current) => ({
      ...current,
      plain_messages: current.plain_messages.map((m) =>
        m.id === messageId ? { ...m, content } : m
      ),
    }));
  }

  function addDmPlainMessage() {
    setForm((current) => ({
      ...current,
      plain_messages: [...current.plain_messages, createDmPlainMessage("")],
    }));
  }

  function removeDmPlainMessage(messageId: string) {
    setForm((current) => ({
      ...current,
      plain_messages:
        current.plain_messages.length === 1
          ? current.plain_messages.map((m) =>
              m.id === messageId ? { ...m, content: "" } : m
            )
          : current.plain_messages.filter((m) => m.id !== messageId),
    }));
  }

  function addDmBlock(type: DmBroadcastBlock["type"]) {
    setForm((current) => ({
      ...current,
      container_blocks: [
        ...current.container_blocks,
        { type, content: "" },
      ],
    }));
  }

  function removeDmBlock(index: number) {
    setForm((current) => ({
      ...current,
      container_blocks: current.container_blocks.filter((_, blockIndex) => blockIndex !== index),
    }));
  }

  function getDmBroadcastProgressMessage(job: DmBroadcastJob) {
    if (job.status === "queued") {
      return `Queued ${job.requested} DMs. Starting now...`;
    }
    if (job.status === "running") {
      return `Sending ${job.processed}/${job.requested} DMs. ${job.sent} sent${job.failed > 0 ? `, ${job.failed} failed` : ""}.`;
    }
    if (job.status === "completed") {
      return `Sent ${job.sent}/${job.requested} DMs.${job.failed > 0 ? ` ${job.failed} failed.` : ""}`;
    }
    return job.error || "DM broadcast failed";
  }

  async function pollDmBroadcastJob(currentGuildId: string, currentJobId: string) {
    while (true) {
      const response = await fetch(`/api/guilds/${currentGuildId}/dm-broadcast/${currentJobId}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to fetch DM broadcast status");
      }

      const job = data?.job as DmBroadcastJob | undefined;
      if (!job) {
        throw new Error("DM broadcast status is missing");
      }

      setMessage(getDmBroadcastProgressMessage(job));

      if (job.status === "completed") {
        setState("success");
        return;
      }

      if (job.status === "failed") {
        throw new Error(job.error || "DM broadcast failed");
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async function handleDmBroadcastSend() {
    if (form.target_mode === "member" && !form.member_id) {
      setState("error");
      setMessage("Choose a member before sending.");
      return;
    }

    const hasPlainMessages = form.plain_messages.some((m) => m.content.trim());
    const hasContainerContent = form.container_blocks.some((b) => b.type === "separator" || b.content.trim());

    if (!hasPlainMessages && !hasContainerContent) {
      setState("error");
      setMessage("Add a plain message or at least one container block before sending.");
      return;
    }

    setSending(true);
    setState("idle");
    setMessage("");
    setJobId("");

    try {
      const response = await fetch(`/api/guilds/${guildId}/dm-broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to send DM broadcast");
      }

      const job = data?.job as DmBroadcastJob | undefined;
      if (!job?.id) {
        throw new Error("DM broadcast job was not created");
      }

      setJobId(job.id);
      setMessage(getDmBroadcastProgressMessage(job));
      await pollDmBroadcastJob(guildId, job.id);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Failed to send DM broadcast");
    } finally {
      setJobId("");
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(95vw,1340px)] overflow-y-auto border-border/70 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <LogIn className="h-5 w-5 text-green-400" />
            DM All
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Send a one-off DM to a selected member or the whole server. Placeholders apply only to the plain message on top, not to the container blocks.
          </DialogDescription>
        </DialogHeader>

        <div id="dm-broadcast-top" className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.7fr)]">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-zinc-200">Target</Label>
                <Select
                  value={form.target_mode}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      target_mode: value as DmBroadcastForm["target_mode"],
                      member_id: value === "everyone" ? "" : current.member_id,
                    }))
                  }
                >
                  <SelectTrigger className="border-zinc-800 bg-black text-zinc-100">
                    <SelectValue placeholder="Choose target" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-black text-zinc-100">
                    <SelectItem value="member" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Selected member</SelectItem>
                    <SelectItem value="everyone" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">Everyone in server</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dm-broadcast-delay" className="text-zinc-200">Delay Between DMs</Label>
                <Input
                  id="dm-broadcast-delay"
                  type="number"
                  min={0.5}
                  max={10}
                  step={0.1}
                  value={form.delay_seconds}
                  className="border-zinc-800 bg-zinc-950 text-zinc-100"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      delay_seconds: Math.min(10, Math.max(0.5, Number.parseFloat(event.target.value) || 0.5)),
                    }))
                  }
                />
                <p className="text-xs text-zinc-500">
                  Used for server-wide sends. Recommended: <code>1.0</code> to <code>1.5</code> seconds.
                </p>
              </div>
            </div>

            {form.target_mode === "member" && (
              <div id="dm-broadcast-member" className="space-y-3">
                <Label className="text-zinc-200">Choose Member</Label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMemberPickerOpen((current) => !current)}
                    className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100"
                  >
                    <span>{selectedDmMember ? `${selectedDmMember.display_name} (${selectedDmMember.username})` : "Open member dropdown"}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${memberPickerOpen ? "rotate-180" : ""}`} />
                  </button>

                  {memberPickerOpen && (
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-800 bg-black shadow-2xl">
                      <div className="border-b border-zinc-800 p-3">
                        <Input
                          placeholder="Type a member name to filter..."
                          value={memberQuery}
                          className="border-zinc-800 bg-zinc-950 text-zinc-100"
                          onChange={(event) => setMemberQuery(event.target.value)}
                          onFocus={() => setMemberPickerOpen(true)}
                        />
                        {memberError && (
                          <p className="mt-2 text-xs text-red-400">{memberError instanceof Error ? memberError.message : "Failed to load members"}</p>
                        )}
                      </div>
                      <div className="max-h-72 overflow-y-auto p-2">
                        {members.length === 0 ? (
                          <div className="rounded-lg px-3 py-4 text-sm text-zinc-500">No members match that search.</div>
                        ) : (
                          members.map((member: any) => (
                            <button
                              key={member.id}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setForm((current) => ({ ...current, member_id: member.id }));
                                setMemberPickerOpen(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                form.member_id === member.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-300 hover:bg-zinc-900"
                              }`}
                            >
                              <div>
                                <div className="font-medium">{member.display_name}</div>
                                <div className="text-xs text-zinc-500">{member.username}</div>
                              </div>
                              {form.member_id === member.id ? (
                                <Badge className="bg-green-600 text-white hover:bg-green-600">Selected</Badge>
                              ) : null}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div id="dm-broadcast-message-section" className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-zinc-200">Plain Message Stack</Label>
                <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={addDmPlainMessage}>
                  Add Message
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                Each plain message below sends as its own Discord DM. Use this when your DM needs multiple text messages before or after the container.
              </p>
              <div className="space-y-3">
                {form.plain_messages.map((message, index) => (
                  <div key={message.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <Badge className="bg-zinc-800 text-zinc-100 hover:bg-zinc-800">Message {index + 1}</Badge>
                      <button type="button" onClick={() => removeDmPlainMessage(message.id)} className="rounded-full text-zinc-400 hover:text-red-400">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <Textarea
                      value={message.content}
                      className="min-h-[120px] border-zinc-800 bg-zinc-950 text-zinc-100"
                      placeholder="Write the plain DM message"
                      onChange={(event) => updateDmPlainMessage(message.id, event.target.value.slice(0, 1800))}
                    />
                    <p className="mt-2 text-xs text-zinc-500">
                      Placeholders here only: <code>{"{username}"}</code>, <code>{"{server_name}"}</code>, <code>{"{mention}"}</code>.
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div id="dm-broadcast-blocks" className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-zinc-200">Container Blocks</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addDmBlock("text")}>Add Text</Button>
                  <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addDmBlock("image")}>Add Image</Button>
                  <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addDmBlock("separator")}>Add Separator</Button>
                </div>
              </div>

              <div className="space-y-3">
                {form.container_blocks.map((block, index) => (
                  <div key={`${block.type}-${index}`} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <Badge className="bg-zinc-800 text-zinc-100 hover:bg-zinc-800">{block.type}</Badge>
                      <button type="button" onClick={() => removeDmBlock(index)} className="rounded-full text-zinc-400 hover:text-red-400">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {block.type !== "separator" && (
                      <Textarea
                        value={block.content}
                        placeholder={block.type === "image" ? "https://..." : "Container text block"}
                        className="min-h-[90px] border-zinc-800 bg-zinc-950 text-zinc-100"
                        onChange={(event) => updateDmBlock(index, { content: event.target.value.slice(0, 2000) })}
                      />
                    )}
                    {block.type === "separator" && (
                      <p className="text-sm text-zinc-500">This adds a divider inside the container.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div id="dm-broadcast-preview" className="scroll-mt-24" />
          <div className="hidden lg:block">
            <div className="sticky top-0 space-y-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-zinc-500">DM Sequence Preview</div>
                    <div className="mt-1 text-sm text-zinc-300">Each plain entry below becomes its own DM message.</div>
                  </div>
                  <Badge className="bg-zinc-800 text-zinc-100 hover:bg-zinc-800">
                    {form.plain_messages.filter((m) => m.content.trim()).length} text message{form.plain_messages.filter((m) => m.content.trim()).length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="space-y-3">
                  {form.plain_messages.filter((m) => m.content.trim()).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                      No plain DM messages yet.
                    </div>
                  ) : (
                    form.plain_messages.map((message, index) =>
                      message.content.trim() ? (
                        <div key={message.id} className="rounded-2xl border border-zinc-700 bg-black p-4">
                          <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Message {index + 1}</div>
                          <div className="whitespace-pre-wrap text-zinc-100">
                            {renderDmBroadcastPlainPreview(message.content, emojiById, selectedDmMember, guild)}
                          </div>
                        </div>
                      ) : null
                    )
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Container Preview</div>
                <div className="space-y-3 rounded-2xl border border-zinc-700 bg-black p-4">
                  {form.container_blocks.length === 0 ? (
                    <div className="text-sm text-zinc-500">No container blocks yet.</div>
                  ) : (
                    form.container_blocks.map((block, index) => {
                      if (block.type === "separator") {
                        return <div key={index} className="h-px w-full bg-zinc-800" />;
                      }
                      if (block.type === "image") {
                        return block.content ? (
                          <img key={index} src={block.content} alt="Preview block" className="max-h-64 w-full rounded-xl border border-zinc-800 object-cover" />
                        ) : (
                          <div key={index} className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">Image URL goes here.</div>
                        );
                      }
                      return (
                        <div key={index} className="whitespace-pre-wrap text-zinc-100">
                          {renderPreviewText(block.content || "Container text block", emojiById)}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div id="dm-broadcast-preview-mobile" className="space-y-4 lg:hidden">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-zinc-500">DM Sequence Preview</div>
                  <div className="mt-1 text-sm text-zinc-300">Each plain entry below becomes its own DM message.</div>
                </div>
                <Badge className="bg-zinc-800 text-zinc-100 hover:bg-zinc-800">
                  {form.plain_messages.filter((m) => m.content.trim()).length} text
                </Badge>
              </div>
              <div className="space-y-3">
                {form.plain_messages.filter((m) => m.content.trim()).length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                    No plain DM messages yet.
                  </div>
                ) : (
                  form.plain_messages.map((message, index) =>
                    message.content.trim() ? (
                      <div key={message.id} className="rounded-2xl border border-zinc-700 bg-black p-4">
                        <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Message {index + 1}</div>
                        <div className="whitespace-pre-wrap text-zinc-100">
                          {renderDmBroadcastPlainPreview(message.content, emojiById, selectedDmMember, guild)}
                        </div>
                      </div>
                    ) : null
                  )
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Container Preview</div>
              <div className="space-y-3 rounded-2xl border border-zinc-700 bg-black p-4">
                {form.container_blocks.length === 0 ? (
                  <div className="text-sm text-zinc-500">No container blocks yet.</div>
                ) : (
                  form.container_blocks.map((block, index) => {
                    if (block.type === "separator") {
                      return <div key={index} className="h-px w-full bg-zinc-800" />;
                    }
                    if (block.type === "image") {
                      return block.content ? (
                        <img key={index} src={block.content} alt="Preview block" className="max-h-64 w-full rounded-xl border border-zinc-800 object-cover" />
                      ) : (
                        <div key={index} className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">Image URL goes here.</div>
                      );
                    }
                    return (
                      <div key={index} className="whitespace-pre-wrap text-zinc-100">
                        {renderPreviewText(block.content || "Container text block", emojiById)}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-20 -mx-6 border-t border-zinc-800 bg-zinc-950/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex-1">
              {renderStatusMessage(state, message, "Send a one-off DM to one member or the whole server.")}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={addDmPlainMessage}>Add Message</Button>
              <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addDmBlock("text")}>Add Text</Button>
              <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addDmBlock("image")}>Add Image</Button>
              <Button type="button" variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={() => addDmBlock("separator")}>Add Separator</Button>
              <Button type="button" onClick={handleDmBroadcastSend} disabled={sending} className="gap-2 bg-green-600 text-white hover:bg-green-500">
                <Save className="h-4 w-4" />
                {sending ? (jobId ? "Sending..." : "Queueing...") : "Send DM"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
