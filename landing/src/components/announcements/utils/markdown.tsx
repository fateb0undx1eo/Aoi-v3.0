type Renderable = string | JSX.Element;

interface Capture {
  size: number;
  [key: string]: any;
}

interface Rule<C extends Capture = Capture> {
  capture(source: string, parse: Parser): C | undefined;
  render(capture: C, render: Renderer): Renderable;
}

type Parser = (source: string) => Node[];
type Renderer = (nodes: Node[]) => Renderable[];

interface Node<C extends Capture = Capture> {
  rule: Rule<C>;
  capture: C;
}

function createParser(rules: Rule[]): Parser {
  function parse(source: string): Node[] {
    const nodes: Node[] = [];
    let remaining = source;
    while (remaining.length > 0) {
      let matched = false;
      for (const rule of rules) {
        const capture = rule.capture(remaining, (s) => parse(s));
        if (capture) {
          nodes.push({ rule, capture } as Node);
          remaining = remaining.slice(capture.size);
          matched = true;
          break;
        }
      }
      if (!matched) {
        nodes.push({ rule: textRule, capture: { size: 1, content: remaining[0] } });
        remaining = remaining.slice(1);
      }
    }
    return nodes;
  }
  return parse;
}

function renderNodes(nodes: Node[]): Renderable[] {
  const out: Renderable[] = [];
  for (const node of nodes) {
    const rendered = node.rule.render(node.capture, (children) => renderNodes(children));
    const last = out[out.length - 1];
    if (typeof rendered === "string" && typeof last === "string") {
      out[out.length - 1] = last + rendered;
    } else {
      out.push(rendered);
    }
  }
  return out;
}

function def<C extends Capture>(rule: Rule<C>): Rule<C> {
  return rule;
}

const headingRule = def({
  capture(source, parse) {
    const m = /^ *(#{1,3})\s+((?!#+)[^\n]+?)#*\s*(?:\n|$)/.exec(source);
    if (!m) return;
    return { size: m[0].length, level: m[1].length, content: parse(m[2].trim()) };
  },
  render(c, r) {
    const cls = "mx-0 mb-1.5 mt-2 font-bold leading-relaxed text-zinc-100";
    if (c.level === 1) return <h4 className={`${cls} text-lg`}>{r(c.content)}</h4>;
    if (c.level === 2) return <h5 className={`${cls} text-base`}>{r(c.content)}</h5>;
    return <h6 className={`${cls} text-sm`}>{r(c.content)}</h6>;
  },
});

const footingRule = def({
  capture(source, parse) {
    const m = /^-# +((?!(-#)+)[^\n]+?) *(?:\n|$)/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[1].trim()) };
  },
  render(c, r) {
    return <span className="block text-xs text-zinc-500">{r(c.content)}</span>;
  },
});

const codeBlockRule = def({
  capture(source) {
    const m = /^```(?:([\w+.-]+?)\n)?\n*([^\n][^]*?)\n*```/i.exec(source);
    if (!m) return;
    return { size: m[0].length, content: m[2], lang: m[1] };
  },
  render(c) {
    return (
      <pre className="mt-1 overflow-x-auto rounded border border-zinc-800 bg-black p-3">
        <code className="font-mono text-xs leading-relaxed text-zinc-200">{c.content}</code>
      </pre>
    );
  },
});

const blockQuoteRule = def({
  capture(source, parse) {
    const m = /^(?: *>>> +(.*))|^(?: *>(?!>>) +[^\n]*(?:\n *>(?!>>) +[^\n]*)*\n?)/su.exec(source);
    if (!m) return;
    const content = parse(m[1] ?? m[0].replaceAll(/^ *> ?/gm, ""));
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
});

const escapeRule = def({
  capture(source) {
    const m = /^\\([^\d\sA-Za-z])/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: m[1] };
  },
  render(c) {
    return c.content;
  },
});

const linkRule = def({
  capture(source) {
    const m = /^<([^ :>]+:\/[^ >]+)>/.exec(source);
    if (!m) return;
    try { new URL(m[1]); } catch { return; }
    return { size: m[0].length, url: new URL(m[1]).href };
  },
  render(c) {
    return <a href={c.url} target="_blank" rel="noreferrer noopener" className="text-cyan-400 hover:underline break-words">{c.url}</a>;
  },
});

const autoLinkRule = def({
  capture(source) {
    const m = /^(?:https?):\/\/[^\s<]+[^\s"',.:;<\]]/.exec(source);
    if (!m) return;
    let url = m[0];
    let left = 0, right = url.length - 1;
    while (url[right] === ")") {
      const idx = url.indexOf("(", left);
      if (idx === -1) { url = url.slice(0, -1); break; }
      left = idx + 1;
      right -= 1;
    }
    try { new URL(url); } catch { return; }
    return { size: url.length, url };
  },
  render(c) {
    return <a href={c.url} target="_blank" rel="noreferrer noopener" className="text-cyan-400 hover:underline break-words">{c.url}</a>;
  },
});

const maskedLinkRule = def({
  capture(source, parse) {
    const m = /^\[((?:\[[^\]]*\]|[^[\]]|\](?=[^[]*\]))*)\]\(\s*<?((?:\([^)]*\)|[^\s\\]|\\.)*?)>?(?:\s+['"](.*?)['"])?\s*\)/su.exec(source);
    if (!m) return;
    if (m[1].trim().length === 0) return;
    try { new URL(m[1]); return; } catch {}
    try { new URL(m[2]); } catch { return; }
    const url = new URL(m[2]).href;
    return { size: m[0].length, content: parse(m[1]), url, title: m[3] };
  },
  render(c, r) {
    return <a href={c.url} title={c.title} target="_blank" rel="noreferrer noopener" className="text-cyan-400 hover:underline">{r(c.content)}</a>;
  },
});

const italicRule = def({
  capture(source, parse) {
    const m = /^\b_((?:__|\\.|[^\\_])+?)_\b|^\*(?=\S)((?:\*\*|\\.|\s+(?:\\.|[^\s*\\]|\*\*)|[^\s*\\])+?)\*(?!\*)/su.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[2] || m[1]) };
  },
  render(c, r) {
    return <em className="italic">{r(c.content)}</em>;
  },
});

const boldRule = def({
  capture(source, parse) {
    const m = /^\*\*((?:\\.|[^\\])+?)\*\*(?!\*)/su.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[1]) };
  },
  render(c, r) {
    return <strong className="font-semibold">{r(c.content)}</strong>;
  },
});

const underlineRule = def({
  capture(source, parse) {
    const m = /^__((?:\\.|[^\\])+?)__(?!_)/su.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[1]) };
  },
  render(c, r) {
    return <u>{r(c.content)}</u>;
  },
});

const strikethroughRule = def({
  capture(source, parse) {
    const m = /^~~(.+?)~~(?!_)/su.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[1]) };
  },
  render(c, r) {
    return <s>{r(c.content)}</s>;
  },
});

const codeRule = def({
  capture(source) {
    const m = /^(`+)(.*?[^`])\1(?!`)/su.exec(source);
    if (!m) return;
    return { size: m[0].length, content: m[2] };
  },
  render(c) {
    return <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-xs text-zinc-200">{c.content}</code>;
  },
});

const breakRule = def({
  capture(source) {
    const m = /^ {2,}\n/.exec(source);
    if (!m) return;
    return { size: m[0].length };
  },
  render() {
    return <br />;
  },
});

const spoilerRule = def({
  capture(source, parse) {
    const m = /^\|\|(.+?)\|\|/su.exec(source);
    if (!m) return;
    return { size: m[0].length, content: parse(m[1]) };
  },
  render(c, r) {
    return <span className="rounded bg-zinc-700/40 box-decoration-clone">{r(c.content)}</span>;
  },
});

const mentionStyle = "rounded bg-cyan-500/15 px-1 py-0.5 font-medium text-cyan-400";

const channelMentionRule = def({
  capture(source) {
    const m = /^<#(\d+)>/.exec(source);
    if (!m) return;
    return { size: m[0].length, id: m[1] };
  },
  render(c) {
    return <span className={mentionStyle}>#{c.id}</span>;
  },
});

const userMentionRule = def({
  capture(source) {
    const m = /^<@!?(\d+)>/.exec(source);
    if (!m) return;
    return { size: m[0].length, id: m[1] };
  },
  render(c) {
    return <span className={mentionStyle}>@{c.id}</span>;
  },
});

const roleMentionRule = def({
  capture(source) {
    const m = /^<@&(\d+)>/.exec(source);
    if (!m) return;
    return { size: m[0].length, id: m[1] };
  },
  render(c) {
    return <span className={mentionStyle}>@{c.id}</span>;
  },
});

const commandMentionRule = def({
  capture(source) {
    const m = /^<\/((?:[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32})(?: [-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}){0,2}):(\d+)>/u.exec(source);
    if (!m) return;
    return { size: m[0].length, name: m[1], id: m[2] };
  },
  render(c) {
    return <span className={mentionStyle}>/{c.name}</span>;
  },
});

const globalMentionRule = def({
  capture(source) {
    const m = /^@everyone|^@here/.exec(source);
    if (!m) return;
    return { size: m[0].length, content: m[0] };
  },
  render(c) {
    return <span className={mentionStyle}>{c.content}</span>;
  },
});

const timestampRule = def({
  capture(source) {
    const m = /^<t:(-?\d+)(?::([DFRTdft]))?>/.exec(source);
    if (!m) return;
    const date = new Date(Number(m[1]) * 1000);
    if (Number.isNaN(date.getTime())) return;
    return { size: m[0].length, date, format: m[2] || "f" };
  },
  render(c) {
    const styles: Record<string, string> = {
      t: dateToTime, T: dateToTimeLong, d: dateToDate, D: dateToDateLong,
      f: dateToShort, F: dateToLong, R: dateToRelative,
    };
    const fmt = styles[c.format] ?? dateToShort;
    return <span className="rounded bg-zinc-700/30 px-1 text-zinc-400" title={c.date.toLocaleString()}>{fmt(c.date)}</span>;
  },
});

const customEmojiRule = def({
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
});

const textRule = def({
  capture(source) {
    const m = /^(?:[\p{L}\p{M}\p{N}\p{Z}]+|¯\\_\(ツ\)_\/¯)/su.exec(source);
    if (!m) return;
    return { size: m[0].length, content: m[0] };
  },
  render(c) {
    return c.content;
  },
});

function dateToTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function dateToTimeLong(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
}
function dateToDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" });
}
function dateToDateLong(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}
function dateToShort(d: Date) {
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}
function dateToLong(d: Date) {
  return `${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}
function dateToRelative(d: Date) {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}

interface MarkdownProps {
  content: string;
  features?: "full" | "title";
}

const fullRules = [
  headingRule, footingRule, codeBlockRule, blockQuoteRule,
  escapeRule, linkRule, autoLinkRule, maskedLinkRule,
  italicRule, boldRule, underlineRule, strikethroughRule,
  codeRule, breakRule, spoilerRule,
  customEmojiRule,
  channelMentionRule, userMentionRule, roleMentionRule, commandMentionRule, globalMentionRule,
  timestampRule,
];

const titleRules = [
  escapeRule, linkRule, autoLinkRule, maskedLinkRule,
  italicRule, boldRule, underlineRule, strikethroughRule,
  codeRule, breakRule,
  customEmojiRule,
  channelMentionRule, userMentionRule, roleMentionRule,
];

export function Markdown({ content, features = "full" }: MarkdownProps) {
  if (!content) return null;
  const rules = features === "title" ? titleRules : fullRules;
  const parse = createParser(rules);
  const nodes = parse(content.trim());
  return <>{renderNodes(nodes)}</>;
}

export function renderDiscordText(text: string | null | undefined, features?: "full" | "title") {
  if (!text) return null;
  return <Markdown content={text} features={features} />;
}
