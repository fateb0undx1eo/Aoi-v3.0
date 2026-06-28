import { type ReactElement, useState } from "react";

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
    const cls = "mx-0 mb-1.5 mt-2 font-semibold leading-snug text-zinc-100";
    if (c.level === 1) return <h4 className={`${cls} text-lg`}>{r(c.content)}</h4>;
    if (c.level === 2) return <h5 className={`${cls} text-base`}>{r(c.content)}</h5>;
    return <h6 className={`${cls} text-sm`}>{r(c.content)}</h6>;
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
    return <span className="block text-xs text-zinc-500">{r(c.content)}</span>;
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
      <pre className="mt-1 max-w-[90%] overflow-x-auto rounded border border-zinc-700 bg-black p-3">
        <code className="font-mono text-inherit text-zinc-200">{c.content}</code>
      </pre>
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
      <div className="my-1 flex">
        <div className="w-1 shrink-0 rounded bg-zinc-600" />
        <blockquote className="ml-2 max-w-[90%] text-zinc-300">{r(c.content)}</blockquote>
      </div>
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
      <li key={i} className="mb-1 whitespace-break-spaces">{r(item)}</li>
    ));
    if (c.ordered) {
      const max = c.start + c.content.length - 1;
      return (
        <ol className="ml-[calc(0.4em+var(--max-digits)*0.6em)] mt-1 list-outside list-decimal"
          style={{ "--max-digits": String(max).length } as React.CSSProperties}
          start={c.start}>{items}</ol>
      );
    }
    return <ul className={`ml-4 mt-1 list-outside ${c.depth > 1 ? "list-[circle]" : "list-disc"}`}>{items}</ul>;
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
    return <p>{r(c.content)}</p>;
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
    return <a href={c.url} target="_blank" rel="noreferrer noopener nofollow ugc" className="text-[#5865F2] hover:underline break-words">{c.url}</a>;
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
    return <a href={c.url} target="_blank" rel="noreferrer noopener nofollow ugc" className="text-[#5865F2] hover:underline break-words">{c.url}</a>;
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
      return <a href={c.url} title={c.title} target="_blank" rel="noreferrer noopener nofollow ugc" className="text-[#5865F2] hover:underline">{r(c.content)}</a>;
    }
    return <span>{c.raw}</span>;
  },
};

const emphasisRule: Rule = {
  capture(source, _, parse) {
    const m = /^\b_((?:__|\\.|[^\\_])+?)_\b|^\*(?=\S)((?:\*\*|\\.|\s+(?:\\.|[^\s*\\]|\*\*)|[^\s*\\])+?)\*(?!\*)/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[2] || m[1]!) };
  },
  render(c, r) { return <em className="italic">{r(c.content)}</em>; },
};

const strongRule: Rule = {
  capture(source, _, parse) {
    const m = /^\*\*((?:\\.|[^\\])+?)\*\*(?!\*)/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[1]!) };
  },
  render(c, r) { return <strong className="font-bold">{r(c.content)}</strong>; },
};

const superStrongRule: Rule = {
  capture(source, _, parse) {
    const m = /^\*{4}((?:\\.|[^*])+?)\*{4}(?!\*)/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[1]!) };
  },
  render(c, r) { return <strong className="font-black">{r(c.content)}</strong>; },
};

const superStrongItalicRule: Rule = {
  capture(source, _, parse) {
    const m = /^\*{5}((?:\\.|[^*])+?)\*{5}(?!\*)/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[1]!) };
  },
  render(c, r) { return <em className="font-black italic">{r(c.content)}</em>; },
};

const underlineRule: Rule = {
  capture(source, _, parse) {
    const m = /^__((?:\\.|[^\\])+?)__(?!_)/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[1]!) };
  },
  render(c, r) { return <u>{r(c.content)}</u>; },
};

const strikethroughRule: Rule = {
  capture(source, _, parse) {
    const m = /^~~(.+?)~~(?!_)/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[1]!) };
  },
  render(c, r) { return <s>{r(c.content)}</s>; },
};

const codeRule: Rule = {
  capture(source) {
    const m = /^(`+)(.*?[^`])\1(?!`)/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: m[2]! };
  },
  render(c) {
    return <code className="rounded bg-zinc-800 px-1 py-px font-mono text-inherit text-zinc-200">{c.content}</code>;
  },
};

const breakRule: Rule = {
  capture(source) {
    const m = /^ {2,}\n/.exec(source);
    if (!m) return;
    return { size: m[0].length };
  },
  render() { return <br />; },
};

function Spoiler({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      onClick={() => setRevealed(true)}
      className="relative inline-flex cursor-pointer rounded"
      style={{
        backgroundColor: revealed ? 'transparent' : 'rgba(32, 34, 37, 0.9)',
        transition: 'background-color 0.25s ease',
      }}
    >
      <span style={{
        color: revealed ? undefined : 'transparent',
        transition: 'color 0.25s ease',
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

const mentionCyan = "font-medium text-cyan-400";
const mentionBurg = "font-medium text-[#8B1538]";

const globalMentionRule: Rule = {
  capture(source) {
    const m = /^@everyone|^@here/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: m[0] };
  },
  render(c) { return <span className={mentionCyan}>{c.content}</span>; },
};

const channelMentionRule: Rule = {
  capture(source) {
    const m = /^<#(\d+)>/.exec(source);
    if (!m) return;
    return { size: m[0].length, id: m[1] };
  },
  render() { return <span className={mentionCyan}>#channel</span>; },
};

const memberMentionRule: Rule = {
  capture(source) {
    const m = /^<@!?(\d+)>/.exec(source);
    if (!m) return;
    return { size: m[0].length, id: m[1] };
  },
  render() { return <span className={mentionBurg}>@user</span>; },
};

const roleMentionRule: Rule = {
  capture(source) {
    const m = /^<@&(\d+)>/.exec(source);
    if (!m) return;
    return { size: m[0].length, id: m[1] };
  },
  render() { return <span className={mentionCyan}>@role</span>; },
};

const commandMentionRule: Rule = {
  capture(source) {
    const m = /^<\/((?:[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32})(?: [-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}){0,2}):(\d+)>/u.exec(source);
    if (!m) return;
    return { size: m[0].length, name: m[1], id: m[2] };
  },
  render(c) { return <span className={mentionCyan}>/{c.name}</span>; },
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
    const formatted = fmt === "t" ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : fmt === "T" ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })
      : fmt === "d" ? d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" })
      : fmt === "D" ? d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
      : fmt === "F" ? `${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
      : fmt === "R" ? dateToRelative(d)
      : `${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    return <span className="rounded bg-zinc-700/30 px-1 text-zinc-400" title={d.toLocaleString()}>{formatted}</span>;
  },
};

function dateToRelative(d: Date) {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
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
        className="inline h-[1.375em] w-[1.375em] align-bottom object-contain"
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
  | "maskedLinks" | "italic" | "superBoldItalic" | "superBold" | "bold" | "underline" | "strikethrough"
  | "breaks" | "spoilers" | "timestamps" | "globalMentions"
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
  superBoldItalic: { rule: superStrongItalicRule, full: true },
  superBold: { rule: superStrongRule, full: true },
  italic: { rule: emphasisRule, title: true, full: true },
  bold: { rule: strongRule, title: true, full: true },
  underline: { rule: underlineRule, title: true, full: true },
  strikethrough: { rule: strikethroughRule, title: true, full: true },
  breaks: { rule: breakRule, title: true, full: true },
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

export function Markdown({ content, features = "full" }: { content: string; features?: FeatureConfig }) {
  if (!content) return null;
  const parse = createMarkdownParser(getRules(features));
  return <>{renderMarkdownNodes(parse(content.trim()))}</>;
}

export function renderDiscordText(text: string | null | undefined, features?: FeatureConfig) {
  if (!text) return null;
  return <Markdown content={text} features={features} />;
}
