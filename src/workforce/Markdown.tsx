import React from 'react';

// Minimal Markdown renderer for workforce reports: headings, paragraphs, lists,
// tables, code blocks and inline bold/italic/code. Renders through React text
// nodes only, so model output can never inject HTML.

function inline(text: string, key = 0): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${key}-${i++}`;
    if (tok.startsWith('**')) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) out.push(<code key={k} className="rounded bg-slate-100 px-1 text-[0.9em]">{tok.slice(1, -1)}</code>);
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, '').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const k = blocks.length;
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      blocks.push(<pre key={k} className="my-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{body.join('\n')}</pre>);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      const level = h[1].length;
      const cls = level === 1 ? 'text-xl font-bold mt-2 mb-3' : level === 2 ? 'text-base font-bold mt-6 mb-2 text-slate-900' : 'text-sm font-semibold mt-4 mb-1';
      blocks.push(React.createElement(`h${Math.min(level + 1, 6)}`, { key: k, className: cls }, inline(h[2], k)));
      i++;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++]);
      const body = rows.filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r));
      const [head, ...rest] = body;
      blocks.push(
        <div key={k} className="my-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr>{cells(head).map((c, j) => <th key={j} className="border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-semibold">{inline(c, j)}</th>)}</tr></thead>
            <tbody>{rest.map((r, ri) => <tr key={ri}>{cells(r).map((c, j) => <td key={j} className="border-b border-slate-100 px-2 py-1.5">{inline(c, j)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''));
      const Tag = ordered ? 'ol' : 'ul';
      blocks.push(
        <Tag key={k} className={`my-2 space-y-1 pl-5 text-sm ${ordered ? 'list-decimal' : 'list-disc'}`}>
          {items.map((it, j) => <li key={j}>{inline(it, j)}</li>)}
        </Tag>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*\||\s*([-*]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]); // never stall on an unrecognised line
    blocks.push(<p key={k} className="my-2 text-sm leading-relaxed text-slate-700">{inline(para.join(' '), k)}</p>);
  }
  return <div>{blocks}</div>;
}
