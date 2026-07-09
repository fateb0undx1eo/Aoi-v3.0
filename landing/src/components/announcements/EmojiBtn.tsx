import { useState } from "react";
import { Smile } from "lucide-react";
import EmojiPickerPopover from "./pickers/EmojiPickerPopover";
import type { APIEmoji, GuildEmoji } from "./types";

export function EmojiBtn({ onEmoji, serverEmojis }: { onEmoji: (text: string) => void; serverEmojis: GuildEmoji[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button type="button" onClick={() => setOpen(true)} title="Insert emoji"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 18, height: 18, borderRadius: 4, border: "none",
          background: "transparent", color: "#52525b", cursor: "pointer",
          fontSize: 11, padding: 0, lineHeight: 1,
        }}>
        <Smile style={{ width: 13, height: 13 }} />
      </button>
      <EmojiPickerPopover
        open={open}
        onClose={() => setOpen(false)}
        onEmojiSelect={(emoji: APIEmoji) => {
          const text = emoji.name
            ? emoji.id
              ? emoji.animated
                ? `<a:${emoji.name}:${emoji.id}>`
                : `<:${emoji.name}:${emoji.id}>`
              : emoji.name
            : "";
          onEmoji(text);
          setOpen(false);
        }}
        serverEmojis={serverEmojis}
      />
    </div>
  );
}
