import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink, Plus, Smile, X, Zap } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ACCENT, BUTTON_STYLES } from "../constants";
import type { APIButtonComponent, APIComponentInActionRow, APIStringSelectComponent, ButtonStyle, GuildEmoji, FlowAction } from "../types";
import { randomId } from "../utils/message";
import FlowActionEditor from "../FlowActionEditor";

export default function ComponentEditModal({ open, onClose, component, onChange, serverEmojis }: {
  open: boolean; onClose: () => void;
  component: APIComponentInActionRow | null;
  onChange: (c: APIComponentInActionRow) => void;
  serverEmojis: GuildEmoji[];
}) {
  const [draft, setDraft] = useState<(APIComponentInActionRow & { _flows?: FlowAction[] }) | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  useEffect(() => { if (open && component) setDraft(JSON.parse(JSON.stringify(component))); }, [open, component]);

  if (!open || !draft) return null;

  const isButton = draft.type === 2;
  const isSelect = draft.type >= 3 && draft.type <= 8;
  const isStringSelect = draft.type === 3;

  const update = (updates: Partial<APIComponentInActionRow & { _flows?: FlowAction[] }>) => {
    setDraft({ ...draft, ...updates } as APIComponentInActionRow & { _flows?: FlowAction[] });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-border/70 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" style={{ color: ACCENT }} />
            Edit {isButton ? "Button" : "Select Menu"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Configure the {isButton ? "button label, style, emoji, and behavior" : "select menu options and settings"}.
          </DialogDescription>
        </DialogHeader>

        {isButton && (
          <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-xs text-zinc-400 space-y-1">
            <p className="font-medium text-zinc-300">How this button works</p>
            <p>Users see the <strong className="text-zinc-200">Label</strong> text with your chosen <strong className="text-zinc-200">Style</strong> color. Clicking it triggers your bot via the <strong className="text-zinc-200">Custom ID</strong> &mdash; this ID is what your code listens for.</p>
            <p className="text-zinc-500">Tip: Use a descriptive Custom ID like <code className="text-zinc-300">claim_reward_123</code> so your bot knows which button was pressed.</p>
          </div>
        )}
        {isSelect && (
          <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-xs text-zinc-400 space-y-1">
            <p className="font-medium text-zinc-300">How this select menu works</p>
            <p>Users pick from the <strong className="text-zinc-200">Options</strong> list. Your bot receives the chosen option&apos;s <strong className="text-zinc-200">Value</strong> through the <strong className="text-zinc-200">Custom ID</strong>.</p>
            <p className="text-zinc-500">Tip: Set <strong className="text-zinc-200">Min/Max Values</strong> to allow multiple selections.</p>
          </div>
        )}

        <div className="space-y-4">
          {isButton && (
            <>
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-zinc-500">Emoji</span>
                  <div className="relative">
                    <button type="button" onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-black text-lg hover:border-zinc-500">
                      {draft.emoji?.id ? (
                        <img src={`https://cdn.discordapp.com/emojis/${draft.emoji.id}.${draft.emoji.animated ? "gif" : "png"}?size=48`}
                          alt="" className="h-6 w-6 object-contain" />
                      ) : draft.emoji?.name ? (
                        <span>{draft.emoji.name}</span>
                      ) : (
                        <Smile className="h-4 w-4 text-zinc-500" />
                      )}
                    </button>
                  </div>
                  <span className="text-[9px] text-zinc-600">Optional</span>
                </div>
                <div className="min-w-0 flex-1">
                  <Label className="text-xs text-zinc-400">
                    Label <span className="text-zinc-600 font-normal">&mdash; text users see on the button</span>
                  </Label>
                  <input type="text" value={draft.label || ""} onChange={(e) => update({ label: e.target.value || undefined })}
                    placeholder="Button label" maxLength={80}
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600" />
                </div>
                <div className="mt-5 flex items-center gap-1.5">
                  <label className="text-[10px] text-zinc-500">Disabled</label>
                  <input type="checkbox" checked={draft.disabled || false}
                    onChange={(e) => update({ disabled: e.target.checked || undefined })}
                    className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800" />
                </div>
              </div>

              {draft.style !== 5 ? (
                <div>
                  <Label className="text-xs text-zinc-400">
                    Style <span className="text-zinc-600 font-normal">&mdash; controls the button&apos;s color</span>
                  </Label>
                  <div className="mt-1 grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((s) => {
                      const bs = BUTTON_STYLES[s];
                      return (
                        <button key={s} type="button" onClick={() => update({ style: s as ButtonStyle })}
                          className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
                            draft.style === s ? "ring-2 ring-white/40" : ""
                          } ${bs?.discordClass}`}>
                          {draft.style === s && <Check className="h-3 w-3" />}
                          {bs?.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {draft.style === 5 ? (
                <div>
                  <Label className="text-xs text-zinc-400">
                    URL <span className="text-zinc-600 font-normal">&mdash; where the link button sends users</span>
                  </Label>
                  <input type="url" value={(draft as APIButtonComponent).url || ""}
                    onChange={(e) => update({ url: e.target.value } as Partial<APIButtonComponent>)}
                    placeholder="https://discord.com"
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600" />
                </div>
              ) : (
                <div>
                  <Label className="text-xs text-zinc-400">
                    Custom ID <span className="text-zinc-600 font-normal">&mdash; unique identifier your bot listens for</span>
                  </Label>
                  <input type="text" value={(draft as APIButtonComponent).custom_id || ""}
                    onChange={(e) => update({ custom_id: e.target.value } as Partial<APIButtonComponent>)}
                    placeholder="my_button_id"
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600" />
                </div>
              )}
            </>
          )}

          {isSelect && (
            <>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <Label className="text-xs text-zinc-400">
                    Placeholder <span className="text-zinc-600 font-normal">&mdash; grey hint text before a choice is made</span>
                  </Label>
                  <input type="text" value={(draft as APIStringSelectComponent).placeholder || ""}
                    onChange={(e) => update({ placeholder: e.target.value || undefined })}
                    placeholder={isStringSelect ? "Choose an option" : "Select..."} maxLength={150}
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600" />
                </div>
                <div className="mt-5 flex items-center gap-1.5">
                  <label className="text-[10px] text-zinc-500">Disabled</label>
                  <input type="checkbox" checked={draft.disabled || false}
                    onChange={(e) => update({ disabled: e.target.checked || undefined })}
                    className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800" />
                </div>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">
                  Custom ID <span className="text-zinc-600 font-normal">&mdash; unique identifier your bot listens for</span>
                </Label>
                <input type="text" value={draft.custom_id || ""} onChange={(e) => update({ custom_id: e.target.value })}
                  placeholder="select_menu_id"
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600" />
              </div>

              {isStringSelect && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="text-xs text-zinc-400">
                      Options <span className="text-zinc-600 font-normal">&mdash; choices users pick from</span> ({(draft as APIStringSelectComponent).options.length}/25)
                    </Label>
                  </div>
                  <div className="space-y-2">
                    {(draft as APIStringSelectComponent).options.map((opt, oi) => (
                      <div key={oi} className="rounded-lg border border-zinc-800 bg-black/50 p-2">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[10px] text-zinc-500">Option {oi + 1}</span>
                          <div className="flex items-center gap-1">
                            <button type="button" disabled={oi === 0}
                              onClick={() => {
                                const opts = [...(draft as APIStringSelectComponent).options];
                                [opts[oi - 1], opts[oi]] = [opts[oi], opts[oi - 1]];
                                update({ options: opts } as Partial<APIStringSelectComponent>);
                              }}
                              className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                            <button type="button" disabled={oi === (draft as APIStringSelectComponent).options.length - 1}
                              onClick={() => {
                                const opts = [...(draft as APIStringSelectComponent).options];
                                [opts[oi], opts[oi + 1]] = [opts[oi + 1], opts[oi]];
                                update({ options: opts } as Partial<APIStringSelectComponent>);
                              }}
                              className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
                            <button type="button"
                              onClick={() => {
                                const cloned = JSON.parse(JSON.stringify(opt));
                                cloned.value = randomId();
                                const opts = [...(draft as APIStringSelectComponent).options];
                                opts.splice(oi + 1, 0, cloned);
                                update({ options: opts } as Partial<APIStringSelectComponent>);
                              }}
                              className="text-zinc-600 hover:text-zinc-300"><Copy className="h-3 w-3" /></button>
                            <button type="button"
                              onClick={() => {
                                const opts = (draft as APIStringSelectComponent).options.filter((_, i) => i !== oi);
                                update({ options: opts } as Partial<APIStringSelectComponent>);
                              }}
                              className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
                          </div>
                        </div>
                        <div className="mb-1 flex items-center gap-2">
                          <input type="text" value={opt.label} onChange={(e) => {
                            const opts = [...(draft as APIStringSelectComponent).options];
                            opts[oi] = { ...opts[oi], label: e.target.value };
                            update({ options: opts } as Partial<APIStringSelectComponent>);
                          }} placeholder="Label" maxLength={100}
                            className="min-w-0 flex-1 rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
                          <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                            <input type="checkbox" checked={opt.default || false}
                              onChange={(e) => {
                                const opts = [...(draft as APIStringSelectComponent).options];
                                opts[oi] = { ...opts[oi], default: e.target.checked };
                                update({ options: opts } as Partial<APIStringSelectComponent>);
                              }}
                              className="h-3 w-3 rounded border-zinc-700 bg-zinc-800" />
                            Default
                          </label>
                        </div>
                        <input type="text" value={opt.description || ""} onChange={(e) => {
                          const opts = [...(draft as APIStringSelectComponent).options];
                          opts[oi] = { ...opts[oi], description: e.target.value || undefined };
                          update({ options: opts } as Partial<APIStringSelectComponent>);
                        }} placeholder="Description (optional)" maxLength={100}
                          className="mb-1 w-full rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
                        <input type="text" value={opt.value} onChange={(e) => {
                          const opts = [...(draft as APIStringSelectComponent).options];
                          opts[oi] = { ...opts[oi], value: e.target.value };
                          update({ options: opts } as Partial<APIStringSelectComponent>);
                        }} placeholder="Value" maxLength={100}
                          className="w-full rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none font-mono" />
                      </div>
                    ))}
                    <button type="button" disabled={(draft as APIStringSelectComponent).options.length >= 25}
                      onClick={() => {
                        const opts = [...(draft as APIStringSelectComponent).options, { label: "", value: randomId() }];
                        update({ options: opts } as Partial<APIStringSelectComponent>);
                      }}
                      className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 py-1.5 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 disabled:opacity-40">
                      <Plus className="h-3 w-3" /> Add Option
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {isStringSelect && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-zinc-400">Min Values <span className="text-zinc-600 font-normal">(0 = optional)</span></Label>
                <input type="number" value={(draft as APIStringSelectComponent).min_values ?? 1}
                  onChange={(e) => update({ min_values: Math.max(0, Number(e.target.value)) } as Partial<APIStringSelectComponent>)}
                  min={0} max={(draft as APIStringSelectComponent).max_values ?? 1}
                  className="mt-1 w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 outline-none" />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Max Values <span className="text-zinc-600 font-normal">(how many they can select)</span></Label>
                <input type="number" value={(draft as APIStringSelectComponent).max_values ?? 1}
                  onChange={(e) => update({ max_values: Math.max(1, Number(e.target.value)) } as Partial<APIStringSelectComponent>)}
                  min={1} max={25}
                  className="mt-1 w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 outline-none" />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-black/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">
              <Zap className="mr-1 inline h-3 w-3" /> Flow Actions
            </span>
            <span className="text-[9px] text-zinc-600">Optional &mdash; what happens on interaction</span>
          </div>
          <FlowActionEditor
            actions={draft._flows || []}
            onChange={(flows) => update({ _flows: flows } as any)}
            isButton={isButton}
            isSelect={isStringSelect}
            options={isStringSelect ? (draft as APIStringSelectComponent).options : undefined}
          />
        </div>

        <div className="rounded-lg border border-zinc-800 bg-black/30 p-3">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">Preview</p>
          <div className="flex flex-wrap gap-2">
            {isButton && (
              <div className={`inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm font-medium ${draft.style === 5 ? "bg-transparent" : ""}`}
                style={draft.style === 5 ? { color: "#00a8fc", border: "1px solid #00a8fc" } : { color: BUTTON_STYLES[draft.style]?.color || "#fff", backgroundColor: BUTTON_STYLES[draft.style]?.bg || "#5865f2", border: `1px solid ${BUTTON_STYLES[draft.style]?.border || "#5865f2"}` }}>
                {draft.emoji?.name && <span>{draft.emoji.name}</span>}
                {draft.label || "Button"}
                {draft.style === 5 && <ExternalLink className="h-3 w-3" />}
              </div>
            )}
            {isStringSelect && (
              <div className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm text-zinc-400" style={{ backgroundColor: "#4e5058" }}>
                <ChevronDown className="h-3 w-3" />
                {(draft as APIStringSelectComponent).placeholder || "Select an option"}
              </div>
            )}
            {(draft.type === 5 || draft.type === 6 || draft.type === 7 || draft.type === 8) && (
              <div className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm text-zinc-400" style={{ backgroundColor: "#4e5058" }}>
                <ChevronDown className="h-3 w-3" />
                {draft.placeholder || "Select..."}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
          <button type="button" onClick={() => { onChange(draft); onClose(); }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: ACCENT }}>
            <Check className="mr-1 inline h-4 w-4" /> Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
