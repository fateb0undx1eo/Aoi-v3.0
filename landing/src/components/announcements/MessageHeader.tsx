import { useState, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });

  useEffect(() => {
    if (!open) return;
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuW = 160;
      let left = r.left + r.width / 2 - menuW / 2;
      let top = r.bottom + 4;
      if (left + menuW > window.innerWidth) left = window.innerWidth - menuW - 8;
      if (left < 8) left = 8;
      if (top + 120 > window.innerHeight) top = r.top - 120;
      setMenuPos({ top, left });
    }
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button ref={btnRef} type="button" onClick={() => setOpen(!open)}
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
      {open && createPortal(
        <div ref={menuRef} style={{
          position: "fixed", zIndex: 99999, top: menuPos.top, left: menuPos.left,
          width: 160, borderRadius: 8, border: "1px solid #1a1a1a",
          backgroundColor: "#111111", padding: 4,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}>
          <button type="button" disabled={maxedOut} onClick={() => { onAddEmbed(); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", textAlign: "left",
              padding: "8px 12px", borderRadius: 6, border: "none",
              backgroundColor: "transparent", cursor: maxedOut ? "not-allowed" : "pointer",
              opacity: maxedOut ? 0.4 : 1, fontSize: 12, color: C.text,
            }}
            onMouseEnter={(e) => { if (!maxedOut) e.currentTarget.style.backgroundColor = "#18181b"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
            <img src="data:image/svg+xml,%3csvg%20width='100'%20height='100'%20viewBox='0%200%2032%2032'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M6.66663%202.66663C5.60576%202.66663%204.58834%203.08805%203.8382%203.8382C3.08805%204.58834%202.66663%205.60576%202.66663%206.66663V25.3333C2.66663%2026.3942%203.08805%2027.4116%203.8382%2028.1617C4.58834%2028.9119%205.60576%2029.3333%206.66663%2029.3333H25.3333C26.3942%2029.3333%2027.4116%2028.9119%2028.1617%2028.1617C28.9119%2027.4116%2029.3333%2026.3942%2029.3333%2025.3333V6.66663C29.3333%205.60576%2028.9119%204.58834%2028.1617%203.8382C27.4116%203.08805%2026.3942%202.66663%2025.3333%202.66663H6.66663ZM7.99996%207.99996C7.64634%207.99996%207.3072%208.14044%207.05715%208.39048C6.8071%208.64053%206.66663%208.97967%206.66663%209.33329C6.66663%209.68691%206.8071%2010.0261%207.05715%2010.2761C7.3072%2010.5261%207.64634%2010.6666%207.99996%2010.6666H14.6666C15.0202%2010.6666%2015.3594%2010.5261%2015.6094%2010.2761C15.8595%2010.0261%2016%209.68691%2016%209.33329C16%208.97967%2015.8595%208.64053%2015.6094%208.39048C15.3594%208.14044%2015.0202%207.99996%2014.6666%207.99996H7.99996ZM6.66663%2016C6.66663%2015.6463%206.8071%2015.3072%207.05715%2015.0571C7.3072%2014.8071%207.64634%2014.6666%207.99996%2014.6666H24C24.3536%2014.6666%2024.6927%2014.8071%2024.9428%2015.0571C25.1928%2015.3072%2025.3333%2015.6463%2025.3333%2016C25.3333%2016.3536%2025.1928%2016.6927%2024.9428%2016.9428C24.6927%2017.1928%2024.3536%2017.3333%2024%2017.3333H7.99996C7.64634%2017.3333%207.3072%2017.1928%207.05715%2016.9428C6.8071%2016.6927%206.66663%2016.3536%206.66663%2016ZM7.99996%2021.3333C7.64634%2021.3333%207.3072%2021.4738%207.05715%2021.7238C6.8071%2021.9739%206.66663%2022.313%206.66663%2022.6666C6.66663%2023.0202%206.8071%2023.3594%207.05715%2023.6094C7.3072%2023.8595%207.64634%2024%207.99996%2024H24C24.3536%2024%2024.6927%2023.8595%2024.9428%2023.6094C25.1928%2023.3594%2025.3333%2023.0202%2025.3333%2022.6666C25.3333%2022.313%2025.1928%2021.9739%2024.9428%2021.7238C24.6927%2021.4738%2024.3536%2021.3333%2024%2021.3333H7.99996Z'%20fill='%23ABABAB'/%3e%3c/svg%3e" alt="" style={{ width: 16, height: 16 }} />
            Embed
          </button>
          <button type="button" onClick={() => { onAddComponent(); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", textAlign: "left",
              padding: "8px 12px", borderRadius: 6, border: "none",
              backgroundColor: "transparent", cursor: "pointer",
              fontSize: 12, color: C.text,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#18181b"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
            <CoolIcon icon="Navigation" size={16} />
            Action Row
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
