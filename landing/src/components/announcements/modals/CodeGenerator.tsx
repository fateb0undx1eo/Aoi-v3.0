import { useState } from "react";
import { Check, Code, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ACCENT } from "../constants";
import type { QueryDataMessageData } from "../types";
import { generateDiscordJs, generateDiscordPy } from "../utils/codegen";

export default function CodeGenerator({ messageData, open, onClose }: { messageData: QueryDataMessageData; open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"js" | "py">("js");
  const [copied, setCopied] = useState(false);
  const code = tab === "js" ? generateDiscordJs(messageData) : generateDiscordPy(messageData);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl border-border/70 bg-black text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" style={{ color: ACCENT }} />
            Generate Code
          </DialogTitle>
          <DialogDescription className="text-zinc-400">discord.js or discord.py code snippet from current message.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex gap-1 rounded-lg border border-zinc-800 bg-black p-1">
            {(["js", "py"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === t ? "bg-primary/15 text-primary" : "text-zinc-500 hover:text-zinc-300"
                }`}>
                {t === "js" ? "discord.js" : "discord.py"}
              </button>
            ))}
          </div>
          <div className="relative">
            <pre className="max-h-80 overflow-auto rounded-lg border border-zinc-800 bg-black p-4 text-[12px] leading-relaxed">
              <code>{code}</code>
            </pre>
            <button type="button" onClick={handleCopy}
              className="absolute right-2 top-2 rounded-md border border-zinc-800 bg-black px-2.5 py-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
              {copied ? <><Check className="mr-1 inline h-3 w-3 text-green-400" />Copied!</> : <><Copy className="mr-1 inline h-3 w-3" />Copy</>}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
