import { type ReactNode } from "react";
import { Clock } from "lucide-react";
import type { Token } from "../types";
import { DISCORD_BLUE, TIMESTAMP_STYLES } from "../constants";

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] === "\n") {
      tokens.push({ type: "br" });
      i++;
      continue;
    }

    if (text.slice(i, i + 3) === "```") {
      const end = text.indexOf("```", i + 3);
      if (end !== -1) {
        const inner = text.slice(i + 3, end);
        const firstLineBreak = inner.indexOf("\n");
        let lang = "";
        let code = inner;
        if (firstLineBreak !== -1) {
          lang = inner.slice(0, firstLineBreak).trim();
          code = inner.slice(firstLineBreak + 1);
        }
        tokens.push({ type: "codeBlock", lang, code });
        i = end + 3;
        continue;
      }
    }

    if (text[i] === "`" && text[i + 1] !== "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1 && text[end - 1] !== "`") {
        tokens.push({ type: "inlineCode", code: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if ((i === 0 || text[i - 1] === "\n") && text[i] === ">" && (text[i + 1] === " " || text[i + 1] === "\n" || text[i + 1] === undefined)) {
      let content = "";
      i += 2;
      while (i < text.length && text[i] !== "\n") {
        content += text[i];
        i++;
      }
      tokens.push({ type: "blockQuote", children: tokenize(content.trim()) });
      if (i < text.length && text[i] === "\n") { i++; }
      continue;
    }

    const animEmoji = text.slice(i).match(/^<a:([a-zA-Z0-9_]+):(\d+)>/);
    if (animEmoji) {
      tokens.push({ type: "emoji", name: animEmoji[1]!, id: animEmoji[2]!, animated: true });
      i += animEmoji[0]!.length;
      continue;
    }

    const staticEmoji = text.slice(i).match(/^<:([a-zA-Z0-9_]+):(\d+)>/);
    if (staticEmoji) {
      tokens.push({ type: "emoji", name: staticEmoji[1]!, id: staticEmoji[2]!, animated: false });
      i += staticEmoji[0]!.length;
      continue;
    }

    const userMention = text.slice(i).match(/^<@!?(\d+)>/);
    if (userMention) {
      tokens.push({ type: "mention", id: userMention[1]! });
      i += userMention[0]!.length;
      continue;
    }

    const nickMention = text.slice(i).match(/^<@!(\d+)>/);
    if (nickMention) {
      tokens.push({ type: "nickMention", id: nickMention[1]! });
      i += nickMention[0]!.length;
      continue;
    }

    const roleMention = text.slice(i).match(/^<@&(\d+)>/);
    if (roleMention) {
      tokens.push({ type: "roleMention", id: roleMention[1]! });
      i += roleMention[0]!.length;
      continue;
    }

    const channelMention = text.slice(i).match(/^<#(\d+)>/);
    if (channelMention) {
      tokens.push({ type: "channelMention", id: channelMention[1]! });
      i += channelMention[0]!.length;
      continue;
    }

    const ts = text.slice(i).match(/^<t:(-?\d+):([tTdDfFR])>/);
    if (ts) {
      tokens.push({ type: "timestamp", ts: ts[1]!, style: ts[2]! });
      i += ts[0]!.length;
      continue;
    }

    if (text.slice(i, i + 10) === "@everyone") {
      tokens.push({ type: "everyone" });
      i += 10;
      continue;
    }

    if (text.slice(i, i + 5) === "@here") {
      tokens.push({ type: "here" });
      i += 5;
      continue;
    }

    const maskedLink = text.slice(i).match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (maskedLink) {
      tokens.push({ type: "maskedLink", text: maskedLink[1]!, url: maskedLink[2]! });
      i += maskedLink[0]!.length;
      continue;
    }

    if (text.slice(i, i + 2) === "~~") {
      const end = text.indexOf("~~", i + 2);
      if (end !== -1) {
        tokens.push({ type: "strikethrough", children: tokenize(text.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    if (text.slice(i, i + 2) === "**") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1 && text.slice(i + 2, end).indexOf("**") === -1) {
        tokens.push({ type: "bold", children: tokenize(text.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1) {
        tokens.push({ type: "italic", children: tokenize(text.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    if (text.slice(i, i + 2) === "__") {
      const end = text.indexOf("__", i + 2);
      if (end !== -1) {
        tokens.push({ type: "underline", children: tokenize(text.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    let accum = "";
    while (i < text.length) {
      const ch = text[i];
      if (ch === "\n" || ch === "`" || ch === "*" || ch === "_" || ch === "~" || ch === "[" || ch === "<" || ch === "@" || ch === ">" || (ch === "-" && i + 1 < text.length && text[i + 1] === " ") || (ch === ">" && (i === 0 || text[i - 1] === "\n"))) break;
      if (ch === "\\" && i + 1 < text.length) {
        accum += text[i + 1];
        i += 2;
        continue;
      }
      accum += ch;
      i++;
    }
    if (accum) tokens.push({ type: "text", text: accum });
    else i++;
  }

  return tokens;
}

function renderTokens(tokens: Token[], keyPrefix = ""): ReactNode[] {
  const els: ReactNode[] = [];
  let idx = 0;

  for (const t of tokens) {
    const k = `${keyPrefix}-${idx++}`;
    switch (t.type) {
      case "text":
        els.push(<span key={k}>{t.text}</span>);
        break;
      case "br":
        els.push(<br key={k} />);
        break;
      case "codeBlock":
        els.push(
          <div key={k} className="my-1.5 overflow-x-auto rounded-lg border border-zinc-700/50 bg-black/60">
            {t.lang && <div className="border-b border-zinc-800 px-3 py-1 text-[10px] text-zinc-500">{t.lang}</div>}
            <pre className="p-3 text-[13px] leading-relaxed"><code>{t.code}</code></pre>
          </div>
        );
        break;
      case "inlineCode":
        els.push(<code key={k} className="rounded bg-zinc-800/70 px-1 text-[13px] text-amber-200/90">{t.code}</code>);
        break;
      case "bold":
        els.push(<strong key={k} className="font-semibold">{renderTokens(t.children, k)}</strong>);
        break;
      case "italic":
        els.push(<em key={k}>{renderTokens(t.children, k)}</em>);
        break;
      case "underline":
        els.push(<u key={k}>{renderTokens(t.children, k)}</u>);
        break;
      case "strikethrough":
        els.push(<s key={k} className="line-through opacity-70">{renderTokens(t.children, k)}</s>);
        break;
      case "maskedLink":
        els.push(
          <a key={k} href={t.url} target="_blank" rel="noreferrer" className="underline decoration-blue-400/40 hover:decoration-blue-400" style={{ color: "#00AFF4" }}>
            {renderTokens(tokenize(t.text), k)}
          </a>
        );
        break;
      case "emoji":
        els.push(
          <img key={k} src={`https://cdn.discordapp.com/emojis/${t.id}.${t.animated ? "gif" : "png"}`} alt={`:${t.name}:`}
            className="inline h-[1.2em] w-[1.2em] -translate-y-[1px] object-contain" loading="lazy" />
        );
        break;
      case "mention":
        els.push(
          <span key={k} className="rounded bg-blue-500/20 px-1 text-[14px] font-medium" style={{ color: DISCORD_BLUE }}>
            @{t.id}
          </span>
        );
        break;
      case "nickMention":
        els.push(
          <span key={k} className="rounded bg-blue-500/20 px-1 text-[14px] font-medium" style={{ color: DISCORD_BLUE }}>
            @!{t.id}
          </span>
        );
        break;
      case "roleMention":
        els.push(
          <span key={k} className="rounded bg-blue-500/20 px-1 text-[14px] font-medium" style={{ color: DISCORD_BLUE }}>
            @&{t.id}
          </span>
        );
        break;
      case "channelMention":
        els.push(
          <span key={k} className="rounded bg-blue-500/20 px-1 text-[14px] font-medium" style={{ color: DISCORD_BLUE }}>
            #{t.id}
          </span>
        );
        break;
      case "everyone":
        els.push(
          <span key={k} className="rounded bg-yellow-500/20 px-1 text-[14px] font-medium" style={{ color: "#F0B232" }}>@everyone</span>
        );
        break;
      case "here":
        els.push(
          <span key={k} className="rounded bg-yellow-500/20 px-1 text-[14px] font-medium" style={{ color: "#F0B232" }}>@here</span>
        );
        break;
      case "timestamp":
        els.push(
          <span key={k} className="cursor-default rounded bg-zinc-800/60 px-1 text-[13px] text-zinc-400" title={TIMESTAMP_STYLES[t.style] || "Unknown"}>
            <Clock className="mr-0.5 inline h-3 w-3" />{new Date(Number(t.ts) * 1000).toLocaleString()}
          </span>
        );
        break;
      case "blockQuote":
        els.push(
          <div key={k} className="my-0.5 border-l-4 pl-3 text-zinc-400" style={{ borderColor: DISCORD_BLUE }}>
            {renderTokens(t.children, k)}
          </div>
        );
        break;
      case "customEmoji":
        els.push(<span key={k} className="text-sm">{t.emoji}</span>);
        break;
      default:
        els.push(<span key={k}>{JSON.stringify(t)}</span>);
    }
  }

  return els;
}

export function renderDiscordText(text: string | null | undefined): ReactNode[] {
  const val = text || "";
  if (!val) return [val];
  const tokens = tokenize(val);
  return renderTokens(tokens);
}

export function renderUnicodeEmoji(text: string): ReactNode {
  return <span>{text}</span>;
}
