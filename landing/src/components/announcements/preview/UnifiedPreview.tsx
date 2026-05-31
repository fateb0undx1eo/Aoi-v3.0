import { useState } from "react";
import { Eye } from "lucide-react";
import { EMBED_BG } from "../constants";
import type { APIComponentInActionRow, DraftFile, QueryDataMessage, QueryDataTarget } from "../types";
import { isComponentsV2 } from "../utils/message";
import DiscordPreview from "./DiscordPreview";

export default function UnifiedPreview({ messages, targets, selectedId, onSelect, onEditComponent, messageFiles }: {
  messages: QueryDataMessage[];
  targets?: QueryDataTarget[];
  selectedId?: string;
  onSelect: (i: number) => void;
  onEditComponent?: (comp: APIComponentInActionRow, ri?: number, ci?: number) => void;
  messageFiles?: Record<string, DraftFile[]>;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  return (
    <div className="rounded-lg" style={{ backgroundColor: EMBED_BG }}>
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <Eye className="mb-3 h-10 w-10 text-zinc-600" />
          <p className="text-sm text-zinc-500">No messages yet</p>
          <p className="mt-1 text-xs text-zinc-600">Add a message to start composing</p>
        </div>
      ) : (
        messages.map((m, i) => {
          const isSelected = m._id === selectedId;
          const isHovered = hoveredIdx === i;
          return (
            <div key={m._id} onClick={() => onSelect(i)}
              onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}
              className={`transition-colors cursor-pointer ${i > 0 ? "border-t border-zinc-700/60" : ""} ${isSelected ? "bg-primary/[0.04]" : isHovered ? "bg-white/[0.03]" : ""}`}>
              <div className="flex">
                {isSelected && <div className="w-0.5 shrink-0 rounded-full bg-primary/60" />}
                <div className="min-w-0 flex-1 px-4 py-2">
                  <DiscordPreview message={m.data} isV2={isComponentsV2(m.data.flags)} targets={targets}
                    onEditComponent={onEditComponent} noBg files={messageFiles?.[m._id || ""]} />
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
