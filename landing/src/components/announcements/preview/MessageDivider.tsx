import { EMBED_BG, FONT, DISCORD } from "../constants";

export default function MessageDivider({ children }: React.PropsWithChildren) {
  return (
    <div style={{ position: "relative", margin: "24px 0", display: "flex", height: 0, alignItems: "center", borderTop: `1px solid ${DISCORD.divider}`, opacity: 0.5, fontFamily: FONT }}>
      <span style={{ marginTop: -1, marginLeft: "auto", marginRight: "auto", borderRadius: 8, background: EMBED_BG, padding: "2px 8px", fontSize: 12, fontWeight: 600, lineHeight: "13px", color: DISCORD.dividerText, fontFamily: FONT }}>
        {children}
      </span>
    </div>
  );
}
