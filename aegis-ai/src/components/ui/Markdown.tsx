import { Fragment, type ReactNode } from "react";

/** Inline: **bold**, *italic*, `code`. Escaped by construction — we build React nodes, never HTML. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean);
  return tokens.map((tok, i) => {
    const key = `${keyPrefix}-${i}`;
    if (tok.startsWith("**") && tok.endsWith("**")) return <strong key={key} className="font-semibold text-fg">{tok.slice(2, -2)}</strong>;
    if (tok.startsWith("*") && tok.endsWith("*") && tok.length > 2) return <em key={key}>{tok.slice(1, -1)}</em>;
    if (tok.startsWith("`") && tok.endsWith("`")) return (
      <code key={key} className="rounded-md bg-white/8 px-1.5 py-0.5 font-mono text-[0.85em] text-cyan">{tok.slice(1, -1)}</code>
    );
    return <Fragment key={key}>{tok}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`l-${blocks.length}`} className={list.ordered
        ? "ml-4 list-decimal space-y-1 marker:text-cyan/70"
        : "ml-4 list-disc space-y-1 marker:text-cyan/70"}>
        {list.items.map((item, i) => <li key={i}>{inline(item, `li-${blocks.length}-${i}`)}</li>)}
      </Tag>,
    );
    list = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);

    if (bullet) {
      if (!list || list.ordered) { flush(); list = { ordered: false, items: [] }; }
      list.items.push(bullet[1]);
    } else if (numbered) {
      if (!list || !list.ordered) { flush(); list = { ordered: true, items: [] }; }
      list.items.push(numbered[1]);
    } else {
      flush();
      if (line.trim()) blocks.push(<p key={`p-${idx}`}>{inline(line, `p-${idx}`)}</p>);
    }
  });
  flush();

  return <div className="space-y-2 text-sm leading-relaxed">{blocks}</div>;
}
