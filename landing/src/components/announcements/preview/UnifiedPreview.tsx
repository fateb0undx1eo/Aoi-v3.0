import { useState } from "react";
import { CoolIcon } from "@/components/icons/CoolIcon";
import { EMBED_BG, DISCORD, FONT } from "../constants";
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
    <div style={{ borderRadius: 8, backgroundColor: EMBED_BG, fontFamily: FONT }}>
      {messages.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 24px", textAlign: "center" }}>
          <CoolIcon icon="Show" size={40} style={{ color: DISCORD.textMuted, marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: DISCORD.textMuted, fontFamily: FONT, margin: 0 }}>No messages yet</p>
          <p style={{ marginTop: 4, fontSize: 12, color: "#52525b", fontFamily: FONT }}>Add a message to start composing</p>
        </div>
      ) : (
        messages.map((m, i) => {
          const isSelected = m._id === selectedId;
          const isHovered = hoveredIdx === i;
          return (
            <div key={m._id} onClick={() => onSelect(i)}
              onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}
              style={{
                cursor: "pointer",
                transition: "background-color 0.1s",
                backgroundColor: isSelected ? "rgba(88,101,242,0.04)" : isHovered ? DISCORD.messageHover : "transparent",
                ...(i > 0 ? { borderTop: "1px solid rgba(255,255,255,0.06)" } : {}),
              }}>
              <div style={{ display: "flex" }}>
                {isSelected && <div style={{ width: 3, flexShrink: 0, borderRadius: 4, backgroundColor: "rgba(88,101,242,0.6)" }} />}
                <div style={{ minWidth: 0, flex: 1, padding: "8px 16px" }}>
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
