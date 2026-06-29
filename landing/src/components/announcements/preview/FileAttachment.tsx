import { FileText } from "lucide-react";
import type { APIAttachment } from "../types";
import { fileSize } from "../utils/files";
import { FONT, DISCORD } from "../constants";

function isAudioType(type: string | undefined): boolean {
  return type !== undefined && (type.startsWith("audio/") || type === "application/ogg");
}

function GenericFileCard({ attachment }: { attachment: APIAttachment }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 8, border: `1px solid ${DISCORD.attachmentBorder}`, background: DISCORD.fileCardBg, padding: 8, fontFamily: FONT }}>
      <FileText style={{ width: 36, height: 36, flexShrink: 0, color: DISCORD.fileCardIcon }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <a href={attachment.url} target="_blank" rel="noreferrer" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 16, fontWeight: 400, color: DISCORD.textLink, textDecoration: "none", fontFamily: FONT, lineHeight: 1.25 }}>
          {attachment.filename}
        </a>
        <p style={{ margin: 0, fontSize: 12, color: DISCORD.textMuted, fontFamily: FONT, lineHeight: 1.25 }}>
          {fileSize(attachment.size)}
        </p>
      </div>
    </div>
  );
}

function VoiceMemo({ attachment }: { attachment: APIAttachment }) {
  const duration = attachment.duration_secs ?? 0;
  const fmt = (s: number) => {
    const sec = Math.round(s);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    const parts = h > 0 ? [`${h}`.padStart(2, "0")] : [];
    parts.push(`${m}`.padStart(2, "0"), `${secs}`.padStart(2, "0"));
    return parts.join(":").replace(/^0:/, "");
  };

  return (
    <div style={{ display: "flex", height: 48, width: "fit-content", alignItems: "center", gap: 12, borderRadius: 9999, border: "1px solid rgba(78,80,88,0.48)", background: DISCORD.bgAlt, padding: "0 8px", fontFamily: FONT }}>
      <div style={{ width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: DISCORD.voicePlayBtn, transition: "background-color 0.15s" }}>
        <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, color: "#fff" }} fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ width: 2, height: 2, borderRadius: "50%", background: DISCORD.voiceWaveform }} />
        ))}
      </div>
      <p style={{ margin: 0, padding: "0 4px", fontSize: 14, fontWeight: 400, color: DISCORD.voiceTimer, fontFamily: FONT }}>{duration ? fmt(duration) : "--:--"}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 4 }}>
        <div style={{ cursor: "pointer", borderRadius: 4, background: DISCORD.voiceSpeedBtn, padding: "1px 10px", fontSize: 12, fontWeight: 500, color: "#c4c5c9", fontFamily: FONT, transition: "color 0.15s" }}>
          1X
        </div>
        <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, cursor: "pointer", color: DISCORD.voiceTimer, transition: "color 0.15s" }} fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.5v7a4.47 4.47 0 0 0 2.5-3.5zm2.5 0A7.5 7.5 0 0 0 14 5.5v2a5.5 5.5 0 0 1 0 9v2a7.5 7.5 0 0 0 5-3.5z" />
        </svg>
      </div>
    </div>
  );
}

export default function FileAttachmentPreview({ attachment, isVoiceMessage }: { attachment: APIAttachment; isVoiceMessage?: boolean }) {
  const isImage = attachment.content_type?.startsWith("image/");
  const isVideo = attachment.content_type?.startsWith("video/");

  if (isImage) {
    return (
      <div style={{ fontFamily: FONT }}>
        <img src={attachment.url} alt={attachment.filename} style={{ maxHeight: 320, maxWidth: "100%", borderRadius: 8, objectFit: "cover", display: "block" }} />
        <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: DISCORD.textMuted, fontFamily: FONT }}>
          <span style={{ fontFamily: FONT }}>{attachment.filename}</span>
          <span style={{ fontFamily: FONT }}>&middot;</span>
          <span style={{ fontFamily: FONT }}>{fileSize(attachment.size)}</span>
        </div>
      </div>
    );
  }

  if (isAudioType(attachment.content_type) && isVoiceMessage) {
    return <VoiceMemo attachment={attachment} />;
  }

  if (isVideo) {
    return <video src={attachment.url} controls style={{ maxHeight: 160, borderRadius: 8, maxWidth: "100%" }} />;
  }

  return <GenericFileCard attachment={attachment} />;
}
