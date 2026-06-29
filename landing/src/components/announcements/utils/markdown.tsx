import { type ReactElement, useState } from "react";
import { FONT, FONT_MONO, DISCORD } from "../constants";

type Renderable = string | ReactElement;

interface Rule {
  capture(source: string, state: State, parse: (s: string) => MarkdownNode[]): ({ size: number } & { [key: string]: any }) | undefined;
  render(capture: any, render: (nodes: MarkdownNode[]) => Renderable[]): Renderable;
}

interface MarkdownNode {
  rule: Rule;
  capture: any;
}

type State = { completed: string; inQuote: boolean; listDepth: number; parseParagraphs: boolean };

type Parser = (source: string) => MarkdownNode[];
type Renderer = (nodes: MarkdownNode[]) => Renderable[];

function createMarkdownParser(rules: Rule[]): Parser {
  function parse(content: string, state: State): MarkdownNode[] {
    const nodes: MarkdownNode[] = [];
    let source = content;
    while (source.length > 0) {
      for (const rule of rules) {
        const completed = state.completed;
        const capture = rule.capture(source, state, (s) => parse(s, state));
        if (capture) {
          nodes.push({ rule, capture });
          state.completed = completed + source.slice(0, capture.size);
          source = source.slice(capture.size);
          break;
        }
      }
    }
    return nodes;
  }
  return (content: string) => parse(content, { completed: "", inQuote: false, listDepth: 0, parseParagraphs: false });
}

function renderMarkdownNodes(nodes: MarkdownNode[]): Renderable[] {
  const elements: (ReactElement | string)[] = [];
  for (const node of nodes) {
    const rendered = node.rule.render(node.capture, (ns) => renderMarkdownNodes(ns));
    const last = elements[elements.length - 1];
    if (typeof rendered === "string" && typeof last === "string") {
      elements[elements.length - 1] = last + rendered;
    } else {
      elements.push(rendered);
    }
  }
  return elements;
}

const headingRule: Rule = {
  capture(source, state, parse) {
    if (!/\n$|^$/.test(state.completed)) return;
    const m = /^ *(#{1,3})\s+((?!#+)[^\n]+?)#*\s*(?:\n|$)/.exec(source);
    if (!m) return;
    return { size: m[0]!.length, content: parse(m[2]?.trim() ?? ""), level: m[1]!.length };
  },
  render(c, r) {
    const sizes: Record<number, string> = { 1: "20px", 2: "16px", 3: "14px" };
    const lineHeights: Record<number, string> = { 1: "28px", 2: "22px", 3: "20px" };
    return <div style={{ fontSize: sizes[c.level] || "14px", fontWeight: 700, lineHeight: lineHeights[c.level] || "20px", margin: "8px 0", color: DISCORD.headerPrimary, fontFamily: FONT }}>{r(c.content)}</div>;
  },
};

const footingRule: Rule = {
  capture(source, state, parse) {
    if (!/\n$|^$/.test(state.completed)) return;
    const m = /^-# +((?!(-#)+)[^\n]+?) *(?:\n|$)/.exec(source);
    if (!m) return;
    return { size: m[0]!.length, content: parse((m[1] ?? "").trim()) };
  },
  render(c, r) {
    return <span style={{ display: "block", fontSize: 12, color: DISCORD.textMuted, fontFamily: FONT }}>{r(c.content)}</span>;
  },
};

const codeBlockRule: Rule = {
  capture(source) {
    const m = /^```(?:([\w+.-]+?)\n)?\n*([^\n][^]*?)\n*```/i.exec(source);
    if (!m) return;
    return { size: m[0].length, content: m[2], language: m[1] };
  },
  render(c) {
    return (
      <div style={{ marginTop: 6, border: `1px solid ${DISCORD.codeBorder}`, borderRadius: 4, backgroundColor: DISCORD.codeBg, overflow: "hidden" }}>
        {c.language && (
          <div style={{
            fontSize: 12, fontWeight: 500, lineHeight: "16px", color: DISCORD.textMuted, fontFamily: FONT,
            padding: "4px 12px", borderBottom: `1px solid ${DISCORD.codeBorder}`,
          }}>
            {c.language}
          </div>
        )}
        <pre style={{
          overflowX: "auto", margin: 0,
          padding: "8px 12px",
          fontFamily: FONT_MONO, fontSize: "0.875rem", lineHeight: "1.125rem", color: DISCORD.codeText,
        }}>
          <code>{c.content}</code>
        </pre>
      </div>
    );
  },
};

const blockQuoteRule: Rule = {
  capture(source, state, parse) {
    if (state.inQuote) return;
    if (!/^$|\n *$/.test(state.completed)) return;
    const m = /^(?: *>>> +(.*))|^(?: *>(?!>>) +[^\n]*(?:\n *>(?!>>) +[^\n]*)*\n?)/.exec(source);
    if (!m) return;
    state.inQuote = true;
    const content = parse(m[1] ?? m[0].replaceAll(/^ *> ?/gm, ""));
    state.inQuote = false;
    return { size: m[0].length, content };
  },
  render(c, r) {
    return (
      <blockquote style={{ margin: "4px 0", paddingLeft: 12, borderLeft: `4px solid ${DISCORD.blockquoteBar}`, color: DISCORD.blockquoteText, lineHeight: "20px", fontFamily: FONT }}>{r(c.content)}</blockquote>
    );
  },
};

const listRule: Rule = {
  capture(source, state, parse) {
    if (state.listDepth > 10) return;
    if (!/^$|\n *$/.test(state.completed)) return;
    const m = /^( *)([*-]|\d+\.) .+?(?:\n(?! )(?!\1(?:[*-]|\d+\.) )|$)/.exec(source);
    if (!m) return;

    const bullet = m[2]!;
    const ordered = bullet.length > 1;
    const start = Math.min(1000000000, Math.max(1, Number(bullet)));
    let lastWasParagraph = false;
    const completed = state.completed;
    const items =
      m[0].replace(/\n{2,}$/, "\n").match(/( *)(?:[*-]|\d+\.) +[^\n]*(?:\n(?!\1(?:[*-]|\d+\.) )[^\n]*)*(?:\n|$)/gm)
        ?.map((item, index, arr) => {
          const spaces = /^ *(?:[*-]|\d+\.) +/.exec(item)?.[0]?.length || 1;
          const text = item.replaceAll(new RegExp(`^ {1,${spaces}}`, "gm"), "").replace(/^ *(?:[*-]|\d+\.) +/, "");
          const isParagraph = text.includes("\n\n") || (index === arr.length - 1 && lastWasParagraph);
          lastWasParagraph = isParagraph;
          const currentDepth = state.listDepth;
          state.listDepth += 1;
          state.parseParagraphs = isParagraph;
          state.completed = completed;
          const parsed = parse(text.replace(/ *\n+$/, isParagraph ? "\n\n" : ""));
          state.listDepth = currentDepth;
          state.parseParagraphs = false;
          return parsed;
        }) ?? [];

    return { size: m[0].length, ordered, start, content: items, depth: state.listDepth + 1 };
  },
  render(c, r) {
    const items = c.content.map((item: MarkdownNode[], i: number) => (
      <li key={i} style={{ margin: 0 }}>{r(item)}</li>
    ));
    if (c.ordered) {
      const max = c.start + c.content.length - 1;
      return (
        <ol start={c.start}
          style={{ margin: "0 0 0 24px", paddingLeft: 0, fontFamily: FONT }}>{items}</ol>
      );
    }
    return <ul style={{ margin: "0 0 0 24px", paddingLeft: 0, listStyle: c.depth > 1 ? "circle" : "disc", fontFamily: FONT }}>{items}</ul>;
  },
};

const paragraphRule: Rule = {
  capture(source, state, parse) {
    if (!state.parseParagraphs) return;
    const m = /^((?:[^\n]|\n(?! *\n))+)(?:\n *)+\n/.exec(source);
    if (!m) return;
    state.parseParagraphs = false;
    const content = parse(m[1] ?? "");
    state.parseParagraphs = true;
    return { size: m[0].length, content };
  },
  render(c, r) {
    return <p style={{ margin: 0 }}>{r(c.content)}</p>;
  },
};

const escapeRule: Rule = {
  capture(source) {
    const m = /^\\([^\d\sA-Za-z])/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: m[1] };
  },
  render(c) { return c.content; },
};

const linkRule: Rule = {
  capture(source) {
    const m = /^<([^ :>]+:\/[^ >]+)>/.exec(source);
    if (!m) return;
    try { new URL(m[1]!); } catch { return; }
    return { size: m[0].length, url: new URL(m[1]!).href };
  },
  render(c) {
    return <a href={c.url} target="_blank" rel="noreferrer noopener nofollow ugc" style={{ color: DISCORD.textLink, textDecoration: "none", wordBreak: "break-word", fontFamily: FONT }} onMouseEnter={e => { e.currentTarget.style.textDecoration = "underline"; e.currentTarget.style.color = "#33b5ff"; }} onMouseLeave={e => { e.currentTarget.style.textDecoration = "none"; e.currentTarget.style.color = DISCORD.textLink; }}>{c.url}</a>;
  },
};

const autoLinkRule: Rule = {
  capture(source) {
    const m = /^(?:https?):\/\/[^\s<]+[^\s"'.,:;<\]/]/.exec(source);
    if (!m) return;
    let url = m[0]!;
    let left = 0, right = url.length - 1;
    while (url[right] === ")") {
      const idx = url.indexOf("(", left);
      if (idx === -1) { url = url.slice(0, -1); break; }
      left = idx + 1; right -= 1;
    }
    try { new URL(url); } catch { return; }
    return { size: url.length, url };
  },
  render(c) {
    return <a href={c.url} target="_blank" rel="noreferrer noopener nofollow ugc" style={{ color: DISCORD.textLink, textDecoration: "none", wordBreak: "break-word", fontFamily: FONT }} onMouseEnter={e => { e.currentTarget.style.textDecoration = "underline"; e.currentTarget.style.color = "#33b5ff"; }} onMouseLeave={e => { e.currentTarget.style.textDecoration = "none"; e.currentTarget.style.color = DISCORD.textLink; }}>{c.url}</a>;
  },
};

const maskedLinkRule: Rule = {
  capture(source, _, parse) {
    const m = /^\[((?:\[[^\]]*\]|[^[\]]|\](?=[^[]*\]))*)\]\(\s*<?((?:\([^)]*\)|[^\s\\]|\\.)*?)>?(?:\s+['"](.*?)['"])?\s*\)/.exec(source);
    if (!m) return;
    const invalid = { size: m[0].length, valid: false, raw: m[0], content: parse(m[1] ?? ""), url: m[2] ?? "", title: m[3] };
    if ((m[1] ?? "").trim().length === 0) return invalid;
    try { new URL(m[1]!); return invalid; } catch {}
    try { new URL(m[2]!); } catch { return; }
    return { size: m[0].length, valid: true, raw: m[0], content: parse(m[1] ?? ""), url: new URL(m[2]!).href, title: m[3] };
  },
  render(c, r) {
    if (c.valid) {
      return <a href={c.url} title={c.title} target="_blank" rel="noreferrer noopener nofollow ugc" style={{ color: DISCORD.textLink, textDecoration: "none", fontFamily: FONT }} onMouseEnter={e => { e.currentTarget.style.textDecoration = "underline"; e.currentTarget.style.color = "#33b5ff"; }} onMouseLeave={e => { e.currentTarget.style.textDecoration = "none"; e.currentTarget.style.color = DISCORD.textLink; }}>{r(c.content)}</a>;
    }
    return <span style={{ fontFamily: FONT }}>{c.raw}</span>;
  },
};

const emphasisRule: Rule = {
  capture(source, _, parse) {
    const m = /^\b_((?:__|\\.|[^\\_])+?)_\b|^\*(?=\S)((?:\*\*|\\.|\s+(?:\\.|[^\s*\\]|\*\*)|[^\s*\\])+?)\*(?!\*)/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[2] || m[1]!) };
  },
  render(c, r) { return <em style={{ fontStyle: "italic", fontFamily: FONT }}>{r(c.content)}</em>; },
};

const strongRule: Rule = {
  capture(source, _, parse) {
    const m = /^\*\*((?:\\.|[^\\])+?)\*\*(?!\*)/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[1]!) };
  },
  render(c, r) { return <strong style={{ fontWeight: 700, fontFamily: FONT }}>{r(c.content)}</strong>; },
};

const underlineRule: Rule = {
  capture(source, _, parse) {
    const m = /^__((?:\\.|[^\\])+?)__/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[1]!) };
  },
  render(c, r) { return <u style={{ fontFamily: FONT }}>{r(c.content)}</u>; },
};

const strikethroughRule: Rule = {
  capture(source, _, parse) {
    const m = /^~~(.+?)~~(?!_)/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[1]!) };
  },
  render(c, r) { return <s style={{ fontFamily: FONT }}>{r(c.content)}</s>; },
};

const codeRule: Rule = {
  capture(source) {
    const m = /^(`+)(.*?[^`])\1(?!`)/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: m[2]! };
  },
  render(c) {
    return <code style={{ borderRadius: 4, backgroundColor: DISCORD.inlineCodeBg, padding: "0 4px", fontFamily: FONT_MONO, fontSize: 12, color: DISCORD.codeText, display: "inline-block", verticalAlign: "baseline", transform: "translateY(-1px)" }}>{c.content}</code>;
  },
};

function Spoiler({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <span
      onClick={() => { if (!revealed) setRevealed(true); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 3,
        cursor: revealed ? undefined : "pointer",
        backgroundColor: revealed
          ? "rgba(32,34,37,0.35)"
          : hovered
            ? "#2e3035"
            : DISCORD.spoilerBg,
        transition: "background-color 0.1s ease",
      }}
    >
      <span style={{
        color: revealed ? undefined : "transparent",
        userSelect: revealed ? undefined : "none",
        transition: "color 0.1s ease",
      }}>
        {children}
      </span>
    </span>
  );
}

const spoilerRule: Rule = {
  capture(source, _, parse) {
    const m = /^\|\|(.+?)\|\|/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[1]!) };
  },
  render(c, r) { return <Spoiler>{r(c.content)}</Spoiler>; },
};

function Mention({ children, color: fgOverride, background: bgOverride }: { children: React.ReactNode; color?: string; background?: string }) {
  const [hovered, setHovered] = useState(false);
  const isChannel = fgOverride === DISCORD.blurple;
  const bg = bgOverride ?? DISCORD.mentionBg;
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontWeight: 500,
        fontFamily: FONT,
        borderRadius: 3,
        padding: "0 3px",
        cursor: "pointer",
        transition: "background-color 0.1s, color 0.1s",
        color: hovered ? "#fff" : isChannel ? DISCORD.blurple : "#c9cdfb",
        background: hovered ? DISCORD.blurple : bg,
      }}
    >
      {children}
    </span>
  );
}

const globalMentionRule: Rule = {
  capture(source) {
    const m = /^@everyone|^@here/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: m[0] };
  },
  render(c) { return <Mention>{c.content}</Mention>; },
};

const channelMentionRule: Rule = {
  capture(source) {
    const m = /^<#(\d+)>/.exec(source);
    if (!m) return;
    return { size: m[0].length, id: m[1] };
  },
  render() { return <Mention color={DISCORD.blurple} background="rgba(88,101,242,0.15)">#channel</Mention>; },
};

const memberMentionRule: Rule = {
  capture(source) {
    const m = /^<@!?(\d+)>/.exec(source);
    if (!m) return;
    return { size: m[0].length, id: m[1] };
  },
  render() { return <Mention>@user</Mention>; },
};

const roleMentionRule: Rule = {
  capture(source) {
    const m = /^<@&(\d+)>/.exec(source);
    if (!m) return;
    return { size: m[0].length, id: m[1] };
  },
  render() { return <Mention>@role</Mention>; },
};

const commandMentionRule: Rule = {
  capture(source) {
    const m = /^<\/((?:[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32})(?: [-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}){0,2}):(\d+)>/u.exec(source);
    if (!m) return;
    return { size: m[0].length, name: m[1], id: m[2] };
  },
  render(c) { return <Mention>/{c.name}</Mention>; },
};

const timestampRule: Rule = {
  capture(source) {
    const m = /^<t:(-?\d+)(?::([DFRTdft]))?>/.exec(source);
    if (!m) return;
    const date = new Date(Number(m[1]!) * 1000);
    if (Number.isNaN(date.getTime())) return;
    return { size: m[0].length, date, format: m[2] ?? "f" };
  },
  render(c) {
    const d: Date = c.date;
    const fmt = c.format;
    const locale = "en-US";
    const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true };
    const formatted = fmt === "t" ? d.toLocaleTimeString(locale, timeOpts)
      : fmt === "T" ? d.toLocaleTimeString(locale, { ...timeOpts, second: "2-digit" })
      : fmt === "d" ? d.toLocaleDateString(locale, { month: "numeric", day: "numeric", year: "numeric" })
      : fmt === "D" ? d.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })
      : fmt === "F" ? `${d.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString(locale, timeOpts)}`
      : fmt === "R" ? dateToRelative(d)
      : `${d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString(locale, timeOpts)}`;
    return <span style={{ color: DISCORD.timestamp, fontFamily: FONT, fontSize: 13 }} title={d.toLocaleString(locale)}>{formatted}</span>;
  },
};

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function dateToRelative(d: Date) {
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const sec = Math.floor(diff / 1000);
  if (abs < 60_000) return rtf.format(sec, "second");
  if (abs < 3_600_000) return rtf.format(Math.floor(sec / 60), "minute");
  if (abs < 86_400_000) return rtf.format(Math.floor(sec / 3600), "hour");
  if (abs < 2_592_000_000) return rtf.format(Math.floor(sec / 86400), "day");
  if (abs < 31_536_000_000) return rtf.format(Math.floor(sec / 2592000), "month");
  return rtf.format(Math.floor(sec / 31536000), "year");
}

const customEmojiRule: Rule = {
  capture(source) {
    const m = /^<(a)?:(\w+):(\d+)>/.exec(source);
    if (!m) return;
    return { size: m[0].length, name: m[2], id: m[3], animated: Boolean(m[1]) };
  },
  render(c) {
    return (
      <img
        src={`https://cdn.discordapp.com/emojis/${c.id}.${c.animated ? "gif" : "webp"}?size=48`}
        alt={`:${c.name}:`}
        title={c.name}
        style={{ display: "inline", height: "1.25em", width: "1.25em", objectFit: "contain", verticalAlign: "-0.2em", cursor: "pointer" }}
      />
    );
  },
};

const textRule: Rule = {
  capture(source) {
    const m = /^(?:[\p{L}\p{M}\p{N}\p{Z}]+|¯\\_\(ツ\)_\/¯)/u.exec(source);
    if (!m) return { size: 1, content: source[0] };
    return { size: m[0].length, content: m[0] };
  },
  render(c) { return c.content; },
};

type RuleOptionKey =
  | "headings" | "footings" | "codeBlocks" | "inlineCode" | "blockQuotes"
  | "lists" | "paragraphs" | "escapes" | "links" | "autoLinks"
  | "maskedLinks" | "italic" | "bold" | "underline" | "strikethrough"
  | "spoilers" | "timestamps" | "globalMentions"
  | "channelMentions" | "memberMentions" | "roleMentions" | "commandMentions"
  | "customEmojis" | "text";

const ruleOptions: Record<RuleOptionKey, { rule: Rule; title?: boolean; full?: boolean }> = {
  headings: { rule: headingRule, full: true },
  footings: { rule: footingRule, full: true },
  codeBlocks: { rule: codeBlockRule, full: true },
  inlineCode: { rule: codeRule, title: true, full: true },
  blockQuotes: { rule: blockQuoteRule, full: true },
  lists: { rule: listRule, full: true },
  paragraphs: { rule: paragraphRule, title: true, full: true },
  escapes: { rule: escapeRule, title: true, full: true },
  links: { rule: linkRule, title: true, full: true },
  autoLinks: { rule: autoLinkRule, title: true, full: true },
  maskedLinks: { rule: maskedLinkRule, full: true },
  italic: { rule: emphasisRule, title: true, full: true },
  bold: { rule: strongRule, title: true, full: true },
  underline: { rule: underlineRule, title: true, full: true },
  strikethrough: { rule: strikethroughRule, title: true, full: true },
  spoilers: { rule: spoilerRule, full: true },
  timestamps: { rule: timestampRule, title: true, full: true },
  globalMentions: { rule: globalMentionRule, full: true },
  channelMentions: { rule: channelMentionRule, title: true, full: true },
  memberMentions: { rule: memberMentionRule, full: true },
  roleMentions: { rule: roleMentionRule, full: true },
  commandMentions: { rule: commandMentionRule, full: true },
  customEmojis: { rule: customEmojiRule, title: true, full: true },
  text: { rule: textRule, title: true, full: true },
};

export type MarkdownFeatures = "title" | "full";
export type FeatureConfig = MarkdownFeatures | (Partial<Record<RuleOptionKey, boolean>> & { extend?: MarkdownFeatures });

const extendable: Record<MarkdownFeatures, RuleOptionKey[]> = {
  full: Object.entries(ruleOptions).filter((p) => p[1].full).map((p) => p[0] as RuleOptionKey),
  title: Object.entries(ruleOptions).filter((p) => p[1].title).map((p) => p[0] as RuleOptionKey),
};

function getRules(features: FeatureConfig): Rule[] {
  if (typeof features === "string") return extendable[features].map((key) => ruleOptions[key].rule);
  const { extend, ...ft } = features;
  const enabledKeys = extend
    ? [...extendable[extend].filter((key) => ft[key] !== false),
       ...Object.keys(ruleOptions).filter((key) => ft[key as RuleOptionKey] === true)]
    : Object.entries(ft).filter((p) => p[1]).map((p) => p[0]);
  return Object.entries(ruleOptions).filter((p) => enabledKeys.includes(p[0])).map((p) => p[1].rule);
}

function isEmojiOnly(source: string): number {
  const trimmed = source.trim();
  if (!trimmed) return 0;
  const emojis = trimmed.match(/<(a)?:\w+:\d+>/g);
  if (!emojis) return 0;
  const emojiOnlyPattern = /^(\s*<(a)?:\w+:\d+>\s*)+$/;
  if (!emojiOnlyPattern.test(trimmed)) return 0;
  return emojis.length;
}

export function Markdown({ content, features = "full" }: { content: string; features?: FeatureConfig }) {
  if (!content) return null;
  const parse = createMarkdownParser(getRules(features));
  const rendered = renderMarkdownNodes(parse(content));
  const emojiCount = isEmojiOnly(content);
  if (emojiCount > 0 && emojiCount <= 3) {
    return <span style={{ fontSize: 38, lineHeight: "48px" }}>{rendered}</span>;
  }
  return <>{rendered}</>;
}

export function renderDiscordText(text: string | null | undefined, features?: FeatureConfig) {
  if (!text) return null;
  return <Markdown content={text} features={features} />;
}
