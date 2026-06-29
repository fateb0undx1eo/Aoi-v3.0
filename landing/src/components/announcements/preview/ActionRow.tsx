import { useState, useRef } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { APIComponentInActionRow, APIButtonComponent, APIStringSelectComponent } from "../types";
import { getPlacement } from "../utils/placement";
import { FONT, DISCORD } from "../constants";

const BUTTON_COLORS: Record<number, { bg: string; hover: string; active: string; text: string }> = {
  1: { bg: "#5865F2", hover: "#4752C4", active: "#3C45A5", text: "#fff" },
  2: { bg: "#4E5058", hover: "#5F616A", active: "#6D6F78", text: "#fff" },
  3: { bg: "#23A55A", hover: "#1C8B4A", active: "#15733E", text: "#fff" },
  4: { bg: "#F23F42", hover: "#D8363A", active: "#BD2D30", text: "#fff" },
  5: { bg: "transparent", hover: "transparent", active: "transparent", text: "#00A8FC" },
  6: { bg: "#9B59B6", hover: "#824EA0", active: "#6F4290", text: "#fff" },
};

export function PreviewButton({ data, onClick }: { data: APIButtonComponent; onClick?: () => void }) {
  const isLink = data.style === 5;
  const isPremium = data.style === 6;
  const colors = BUTTON_COLORS[data.style] ?? BUTTON_COLORS[1]!;
  const label = isPremium ? `SKU ${data.sku_id}` : (data.label || (isLink ? "Link" : "Button"));

  const inner = (
    <button
      type="button"
      disabled={data.disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 3,
        padding: "10px 16px",
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.3,
        fontFamily: FONT,
        color: data.disabled ? DISCORD.buttonDisabledText : colors.text,
        backgroundColor: data.disabled ? DISCORD.buttonDisabled : colors.bg,
        border: isLink ? "1px solid #00A8FC" : "none",
        cursor: data.disabled ? "not-allowed" : "pointer",
        opacity: data.disabled ? 0.5 : 1,
        transition: "background-color 0.1s, opacity 0.1s",
        userSelect: "none",
      }}
      onMouseEnter={e => { if (!data.disabled && !isLink) { e.currentTarget.style.backgroundColor = colors.hover; } }}
      onMouseLeave={e => { if (!data.disabled && !isLink) { e.currentTarget.style.backgroundColor = colors.bg; } }}
      onMouseDown={e => { if (!data.disabled && !isLink) { e.currentTarget.style.backgroundColor = colors.active; } }}
      onMouseUp={e => { if (!data.disabled && !isLink) { e.currentTarget.style.backgroundColor = colors.hover; } }}
    >
      {data.emoji?.id ? (
        <img src={`https://cdn.discordapp.com/emojis/${data.emoji.id}.${data.emoji.animated ? "gif" : "png"}?size=32`} alt="" style={{ width: 20, height: 20, objectFit: "contain" }} />
      ) : data.emoji?.name ? <span style={{ fontSize: 18 }}>{data.emoji.name}</span> : null}
      {label}
      {isLink && <ExternalLink style={{ width: 14, height: 14 }} />}
    </button>
  );

  if (isLink && data.url) {
    return <a href={data.url} target="_blank" rel="noreferrer noopener" style={{ display: "contents" }}>{inner}</a>;
  }
  return inner;
}

export function PreviewSelect({ data, onClick }: { data: APIStringSelectComponent; onClick?: () => void }) {
  const [open, setOpen] = useState(false);
  const [selPlacement, setSelPlacement] = useState<"below" | "above">("below");
  const selBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div style={{ position: "relative", fontFamily: FONT }}>
      <button
        ref={selBtnRef}
        type="button"
        disabled={data.disabled}
        onClick={() => {
          if (!open) {
            if (selBtnRef.current) setSelPlacement(getPlacement(selBtnRef.current));
          }
          setOpen(!open); onClick?.();
        }}
        style={{
          display: "inline-flex",
          maxWidth: 400,
          alignItems: "center",
          gap: 8,
          borderRadius: 4,
          background: DISCORD.selectBg,
          padding: 10,
          fontSize: 14,
          fontWeight: 500,
          fontFamily: FONT,
          color: data.disabled ? DISCORD.buttonDisabledText : DISCORD.selectPlaceholder,
          border: `1px solid ${DISCORD.selectBorder}`,
          opacity: data.disabled ? 0.5 : 1,
          cursor: data.disabled ? "not-allowed" : "pointer",
          transition: "border-color 0.1s",
          userSelect: "none",
          width: "100%",
          minWidth: 200,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2, color: data.disabled ? DISCORD.buttonDisabledText : DISCORD.textNormal }}>
          {data.placeholder || "Select an option"}
        </span>
        <ChevronDown style={{ width: 14, height: 14, flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {open && data.options.length > 0 && (
        <div style={{
          position: "absolute",
          left: 0,
          zIndex: 30,
          minWidth: 200,
          overflowY: "auto",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.06)",
          background: DISCORD.selectOptionBg,
          boxShadow: "0 8px 16px rgba(0,0,0,0.24)",
          ...(selPlacement === "below" ? { top: "100%", marginTop: 4 } : { bottom: "100%", marginBottom: 4 }),
        }}>
          {data.options.map((opt, oi) => (
            <div key={oi}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                fontSize: 14,
                fontFamily: FONT,
                color: DISCORD.textNormal,
                cursor: "pointer",
                transition: "background-color 0.05s",
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = DISCORD.selectOptionHover; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              {opt.emoji?.id ? (
                <img src={`https://cdn.discordapp.com/emojis/${opt.emoji.id}.${opt.emoji.animated ? "gif" : "png"}?size=32`} alt="" style={{ width: 22, height: 22, flexShrink: 0, objectFit: "contain" }} />
              ) : opt.emoji?.name ? <span style={{ fontSize: 16 }}>{opt.emoji.name}</span> : null}
              <div style={{ minWidth: 0, overflow: "hidden" }}>
                <p style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500, lineHeight: 1.3, fontFamily: FONT, color: DISCORD.textNormal }}>{opt.label}</p>
                {opt.description && <p style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: DISCORD.selectOptionDesc, fontFamily: FONT }}>{opt.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PreviewActionRow({
  components,
  onEditComponent,
}: {
  components: APIComponentInActionRow[];
  onEditComponent?: (comp: APIComponentInActionRow, ri?: number, ci?: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {components.map((comp, ci) => (
        <div key={ci} style={{ display: "contents" }}>
          {comp.type === 2 ? (
            <PreviewButton data={comp} onClick={() => onEditComponent?.(comp, undefined, ci)} />
          ) : comp.type === 3 ? (
            <PreviewSelect data={comp} onClick={() => onEditComponent?.(comp, undefined, ci)} />
          ) : comp.type >= 5 && comp.type <= 8 ? (
            <button
              type="button"
              onClick={() => onEditComponent?.(comp, undefined, ci)}
              style={{
                display: "inline-flex",
                maxWidth: 400,
                cursor: "pointer",
                alignItems: "center",
                gap: 8,
                borderRadius: 8,
                background: DISCORD.selectBg,
                padding: 10,
                fontSize: 14,
                fontWeight: 500,
                fontFamily: FONT,
                color: DISCORD.selectPlaceholder,
                border: `1px solid ${DISCORD.selectBorder}`,
                userSelect: "none",
                minWidth: 200,
                transition: "border-color 0.15s, opacity 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = DISCORD.textMuted; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = DISCORD.selectBorder; }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
                {comp.placeholder || "Select..."}
              </span>
              <ChevronDown style={{ width: 14, height: 14, flexShrink: 0 }} />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
