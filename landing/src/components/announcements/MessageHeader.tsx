import { useState, useEffect, useRef, type ReactNode } from "react";
import { CoolIcon } from "@/components/icons/CoolIcon";
import { C } from "./constants";
import { getPlacement } from "./utils/placement";

export function MessageActionBtn({ icon, tooltip, onClick, popover }: {
  icon: ReactNode; tooltip: string; onClick: () => void; popover?: (close: () => void) => ReactNode;
}) {
  const [h, sH] = useState(false);
  if (popover) {
    return <MessageAddBtn icon={icon} tooltip={tooltip} renderPopover={popover} />;
  }
  return (
    <button type="button" onClick={onClick} title={tooltip}
      onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 22, height: 22, borderRadius: 6, border: "none",
        backgroundColor: h ? "#1a1a1a" : "transparent",
        color: h ? C.text : "#52525b", cursor: "pointer",
        fontSize: 10, fontWeight: 600, transition: "all 0.12s", flexShrink: 0,
      }}>
      {icon}
    </button>
  );
}

function MessageAddBtn({ icon, tooltip, renderPopover }: {
  icon: ReactNode; tooltip: string; renderPopover: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const [h, sH] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = () => {
    if (!open) {
      if (btnRef.current) setPlacement(getPlacement(btnRef.current));
    }
    setOpen(!open);
  };

  const close = () => setOpen(false);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button ref={btnRef} type="button" onClick={toggle} title={tooltip}
        onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 22, height: 22, borderRadius: 6, border: "none",
          backgroundColor: h ? "#1a1a1a" : "transparent",
          color: h ? C.text : "#52525b", cursor: "pointer",
          fontSize: 10, fontWeight: 600, transition: "background-color 0.12s, color 0.12s", flexShrink: 0,
        }}>
        <span style={{
          display: "inline-block",
          transform: open ? "rotate(135deg)" : "rotate(0deg)",
          transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}>
          {icon}
        </span>
      </button>
      <div style={{
        position: "absolute", right: 0, zIndex: 200,
        top: placement === "below" ? "calc(100% + 4px)" : undefined,
        bottom: placement === "above" ? "calc(100% + 4px)" : undefined,
        minWidth: 260, maxWidth: 300,
        borderRadius: 8, border: `1px solid ${C.border}`,
        backgroundColor: C.surface,
        boxShadow: "0 0 0 100vmax rgba(0,0,0,0.55)",
        padding: 4,
        opacity: open ? 1 : 0,
        transform: `translateY(${open ? 0 : placement === "below" ? -4 : 4}px)`,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 0.15s ease, transform 0.15s ease",
      }}>
        {renderPopover(close)}
      </div>
    </div>
  );
}

export function AddMessagePopover({ onAddStandard, onAddV2 }: { onAddStandard: () => void; onAddV2: () => void }) {
  return (
    <>
      <button type="button" onClick={onAddStandard}
        style={{
          display: "block", width: "100%", textAlign: "left",
          padding: "8px 10px", borderRadius: 6, border: "none",
          backgroundColor: "transparent", color: C.text, cursor: "pointer",
          fontSize: 11, fontWeight: 600, transition: "all 0.1s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${C.burg}20`; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        Standard Message
        <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 400, marginTop: 2, lineHeight: 1.4, opacity: 0.65 }}>
          Can display text, then attachments, then embeds. If you aren't sure, choose this.
        </div>
      </button>
      <button type="button" onClick={onAddV2}
        style={{
          display: "block", width: "100%", textAlign: "left",
          padding: "8px 10px", borderRadius: 6, border: "none",
          backgroundColor: "transparent", color: C.text, cursor: "pointer",
          fontSize: 11, fontWeight: 600, transition: "all 0.1s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${C.burg}20`; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        Components-based Message
        <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 400, marginTop: 2, lineHeight: 1.4, opacity: 0.65 }}>
          Can display text, media, files, and containers (similar to embeds) in any order! This is more customizable than a standard message.
        </div>
      </button>
    </>
  );
}

export function AddContentPopover({
  maxedOut, onAddEmbed, onAddComponent,
}: {
  maxedOut: boolean;
  onAddEmbed: () => void;
  onAddComponent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = () => {
    if (!open) {
      if (btnRef.current) setPlacement(getPlacement(btnRef.current));
    }
    setOpen(!open);
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button ref={btnRef} type="button" onClick={toggle}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, borderRadius: 8, border: "none",
          backgroundColor: "transparent", color: C.textMuted, cursor: "pointer",
          transition: "color 0.12s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; }}>
        <CoolIcon icon="Add_Plus_Circle" size={22} />
      </button>
      {open && (
        <div style={{
          position: "absolute", left: "50%", zIndex: 200,
          top: placement === "below" ? "calc(100% + 4px)" : undefined,
          bottom: placement === "above" ? "calc(100% + 4px)" : undefined,
          transform: `translateX(-50%)${placement === "above" ? " translateY(0)" : ""}`,
          minWidth: 160, borderRadius: 8, border: `1px solid #1a1a1a`,
          backgroundColor: "#111111", padding: 4,
          boxShadow: "0 0 0 100vmax rgba(0,0,0,0.55)",
        }}>
          <button type="button" disabled={maxedOut} onClick={() => { onAddEmbed(); setOpen(false); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "8px 12px", borderRadius: 6, border: "none",
              backgroundColor: "transparent", cursor: maxedOut ? "not-allowed" : "pointer",
              opacity: maxedOut ? 0.4 : 1, fontSize: 12, color: C.text,
            }}
            onMouseEnter={(e) => { if (!maxedOut) e.currentTarget.style.backgroundColor = "#18181b"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
            Embed
          </button>
          <button type="button" onClick={() => { onAddComponent(); setOpen(false); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "8px 12px", borderRadius: 6, border: "none",
              backgroundColor: "transparent", cursor: "pointer",
              fontSize: 12, color: C.text,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#18181b"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
            Component
          </button>
        </div>
      )}
    </div>
  );
}
