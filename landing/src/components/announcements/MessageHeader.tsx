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
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

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
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 48" style={{ width: 22, height: 22, display: "block" }}>
          <g id="horizontal-menu-circle--navigation-dots-three-circle-button-horizontal-menu">
            <path id="Union" fill="#ababab" d="M24 1.5C11.574 1.5 1.5 11.574 1.5 24S11.574 46.5 24 46.5 46.5 36.426 46.5 24 36.426 1.5 24 1.5Z" stroke-width="1"></path>
            <path id="Subtract" fill="#4a4a4b" fill-rule="evenodd" d="M24 27.5a3.5 3.5 0 1 0 0 -7 3.5 3.5 0 0 0 0 7ZM16 24a3.5 3.5 0 1 1 -7 0 3.5 3.5 0 0 1 7 0Zm19.5 3.5a3.5 3.5 0 1 0 0 -7 3.5 3.5 0 0 0 0 7Z" clip-rule="evenodd" stroke-width="1"></path>
          </g>
        </svg>
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{
          position: "fixed", zIndex: 99999, top: menuPos.top, left: menuPos.left,
          width: 130, borderRadius: 8, border: "1px solid #1a1a1a",
          backgroundColor: "#111111", padding: 3,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}>
          <button type="button" disabled={maxedOut} onClick={() => { onAddEmbed(); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              width: "100%", textAlign: "left",
              padding: "6px 10px", borderRadius: 6, border: "none",
              backgroundColor: "transparent", cursor: maxedOut ? "not-allowed" : "pointer",
              opacity: maxedOut ? 0.4 : 1, fontSize: 11, color: C.text,
            }}
            onMouseEnter={(e) => { if (!maxedOut) e.currentTarget.style.backgroundColor = "#18181b"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 48" style={{ width: 14, height: 14, display: "block" }}>
              <g id="notepad-text--content-notes-book-notepad-notebook">
                <path id="Union" fill="#ababab" d="M24 5.531c-7.4 0 -12.588 0.252 -15.855 0.492 -3.277 0.241 -5.853 2.735 -6.135 6.033 -0.256 2.984 -0.51 7.566 -0.51 13.975 0 6.41 0.254 10.991 0.51 13.976 0.282 3.297 2.858 5.791 6.135 6.032 3.267 0.24 8.455 0.492 15.855 0.492s12.588 -0.251 15.855 -0.492c3.277 -0.24 5.853 -2.735 6.135 -6.032 0.256 -2.985 0.51 -7.567 0.51 -13.976 0 -6.409 -0.254 -10.99 -0.51 -13.975 -0.282 -3.298 -2.858 -5.792 -6.135 -6.033 -3.267 -0.24 -8.455 -0.492 -15.855 -0.492Z" stroke-width="1"></path>
                <path id="Subtract" fill="#4a4a4b" fill-rule="evenodd" d="M12.75 24A2.25 2.25 0 0 1 15 21.75h18a2.25 2.25 0 0 1 0 4.5H15A2.25 2.25 0 0 1 12.75 24ZM15 32.75a2.25 2.25 0 0 0 0 4.5h9a2.25 2.25 0 0 0 0 -4.5h-9Z" clip-rule="evenodd" stroke-width="1"></path>
                <path id="Union_2" fill="#4a4a4b" d="M13 12.531c-0.35 0 -0.665 -0.009 -0.944 -0.025 -1.58 -0.09 -2.465 -1.399 -2.513 -2.83a79.157 79.157 0 0 1 0 -5.29c0.048 -1.43 0.933 -2.74 2.513 -2.83a17.564 17.564 0 0 1 1.888 0c1.58 0.09 2.465 1.4 2.513 2.83a78.983 78.983 0 0 1 0 5.29c-0.048 1.431 -0.933 2.74 -2.513 2.83 -0.28 0.016 -0.593 0.025 -0.944 0.025Z" stroke-width="1"></path>
                <path id="Union_3" fill="#4a4a4b" d="M24 12.531c-0.35 0 -0.665 -0.009 -0.944 -0.025 -1.58 -0.09 -2.465 -1.399 -2.513 -2.83a78.983 78.983 0 0 1 0 -5.29c0.048 -1.43 0.933 -2.74 2.513 -2.83a17.564 17.564 0 0 1 1.888 0c1.58 0.09 2.465 1.4 2.513 2.83a78.983 78.983 0 0 1 0 5.29c-0.048 1.431 -0.933 2.74 -2.513 2.83 -0.28 0.016 -0.593 0.025 -0.944 0.025Z" stroke-width="1"></path>
                <path id="Union_4" fill="#4a4a4b" d="M35 12.531c-0.35 0 -0.665 -0.009 -0.944 -0.025 -1.58 -0.09 -2.465 -1.399 -2.513 -2.83a78.983 78.983 0 0 1 0 -5.29c0.048 -1.43 0.933 -2.74 2.513 -2.83a17.564 17.564 0 0 1 1.888 0c1.58 0.09 2.465 1.4 2.513 2.83a78.983 78.983 0 0 1 0 5.29c-0.048 1.431 -0.933 2.74 -2.513 2.83 -0.28 0.016 -0.593 0.025 -0.944 0.025Z" stroke-width="1"></path>
              </g>
            </svg>
            Embed
          </button>
          <button type="button" onClick={() => { onAddComponent(); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              width: "100%", textAlign: "left",
              padding: "6px 10px", borderRadius: 6, border: "none",
              backgroundColor: "transparent", cursor: "pointer",
              fontSize: 11, color: C.text,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#18181b"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14" style={{ width: 14, height: 14, display: "block" }}>
              <g id="arrow-cursor-2--mouse-select-cursor">
                <path id="Union" fill="#ababab" fill-rule="evenodd" d="m1.972 0.08 -0.002 0A1.49 1.49 0 0 0 0.08 1.97l0.473 -0.162 -0.473 0.163 0.001 0.002 0.002 0.006 0.008 0.024 0.032 0.092 0.12 0.35L0.675 3.7a30731.61 30731.61 0 0 1 3.07 8.944l0.128 0.373 0.035 0.104 0.01 0.03a0.995 0.995 0 0 0 1.73 0.56 0.989 0.989 0 0 0 0.193 -0.26c0.045 -0.088 0.078 -0.187 0.11 -0.279l0.001 -0.004 0.995 -2.87 0.65 -1.876 0.213 -0.613 0.002 -0.005 0.007 -0.002 0.617 -0.218 1.885 -0.667a322.95 322.95 0 0 0 2.878 -1.027l0.046 -0.018c0.11 -0.043 0.307 -0.118 0.465 -0.276a0.994 0.994 0 0 0 0 -1.406l-0.01 -0.01a1.276 1.276 0 0 0 -0.182 -0.164 1.221 1.221 0 0 0 -0.373 -0.169l-0.002 0 -0.035 -0.012L13 3.8l-0.382 -0.127 -1.298 -0.436A5548.437 5548.437 0 0 1 3.687 0.66L2.441 0.24 2.093 0.12 2 0.091l-0.023 -0.01L1.972 0.08Z" clip-rule="evenodd" stroke-width="1"></path>
              </g>
            </svg>
            Action Row
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
