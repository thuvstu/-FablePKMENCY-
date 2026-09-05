import Link from "next/link";
import type { ReactNode } from "react";
import { slugify } from "@/lib/wiki";

export type LinkResolver = (title: string) => string | null;

// ---------------------------------------------------------------------------
// Inline parsing: [[wiki]], **bold**, *italic*, `code`, [text](url), ==mark==
// ---------------------------------------------------------------------------
function renderInline(text: string, resolve: LinkResolver, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re =
    /(\[\[([^\]|]+)(?:\|([^\]]*))?\]\])|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))|(==([^=]+)==)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const k = `${keyBase}-${i++}`;
    if (m[1]) {
      const target = m[2].trim();
      const label = (m[3] ?? target).trim();
      const slug = resolve(target);
      nodes.push(
        slug ? (
          <Link key={k} href={`/wiki/${slug}`} className="wikilink">
            {label}
          </Link>
        ) : (
          <Link
            key={k}
            href={`/new?title=${encodeURIComponent(target)}`}
            className="wikilink-missing"
            title={`Create "${target}"`}
          >
            {label}
          </Link>
        ),
      );
    } else if (m[4]) nodes.push(<strong key={k}>{m[5]}</strong>);
    else if (m[6]) nodes.push(<em key={k}>{m[7]}</em>);
    else if (m[8]) nodes.push(<code key={k}>{m[9]}</code>);
    else if (m[10])
      nodes.push(
        <a key={k} href={m[12]} target="_blank" rel="noreferrer" className="extlink">
          {m[11]}
        </a>,
      );
    else if (m[13]) nodes.push(<mark key={k}>{m[14]}</mark>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// ---------------------------------------------------------------------------
// Block parsing
// ---------------------------------------------------------------------------
export function Markdown({
  content,
  resolve = (t) => slugify(t),
  compact = false,
}: {
  content: string;
  resolve?: LinkResolver;
  compact?: boolean;
}) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const flushParagraph = (buf: string[]) => {
    if (!buf.length) return;
    const text = buf.join(" ").trim();
    if (text) blocks.push(<p key={key++}>{renderInline(text, resolve, `p${key}`)}</p>);
    buf.length = 0;
  };

  const para: string[] = [];
  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      flushParagraph(para);
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key++}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flushParagraph(para);
      const level = h[1].length;
      const inner = renderInline(h[2], resolve, `h${key}`);
      const id = slugify(h[2]);
      if (level === 1) blocks.push(<h1 key={key++} id={id}>{inner}</h1>);
      else if (level === 2) blocks.push(<h2 key={key++} id={id}>{inner}</h2>);
      else if (level === 3) blocks.push(<h3 key={key++} id={id}>{inner}</h3>);
      else blocks.push(<h4 key={key++} id={id}>{inner}</h4>);
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph(para);
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      blocks.push(
        <ul key={key++}>
          {items.map((it, n) => (
            <li key={n}>{renderInline(it, resolve, `li${key}-${n}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph(para);
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s+/, ""));
      blocks.push(
        <ol key={key++}>
          {items.map((it, n) => (
            <li key={n}>{renderInline(it, resolve, `ol${key}-${n}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushParagraph(para);
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={key++}>{renderInline(q.join(" "), resolve, `q${key}`)}</blockquote>);
      continue;
    }

    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      flushParagraph(para);
      blocks.push(<hr key={key++} />);
      i++;
      continue;
    }

    if (line.trim() === "") {
      flushParagraph(para);
      i++;
      continue;
    }

    para.push(line);
    i++;
  }
  flushParagraph(para);

  return <div className={compact ? "prose-codex prose-compact" : "prose-codex"}>{blocks}</div>;
}
