import { Fragment, type ReactNode } from 'react';

/**
 * Mise en forme simple et sûre (aucun HTML injecté) :
 * # Titre · ## Sous-titre · - liste · 1. liste numérotée · - [ ] / - [x] case
 * > citation · --- séparateur · **gras** · *italique* · [texte](lien) · liens nus.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\((https?:\/\/[^)\s]+)\)|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith('**')) out.push(<strong key={k} className="font-semibold">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('[')) {
      const label = tok.slice(1, tok.indexOf(']'));
      out.push(<a key={k} href={m[2]} target="_blank" rel="noreferrer" className="font-medium text-mab-aqua-texte underline underline-offset-2">{label}</a>);
    } else if (tok.startsWith('http')) out.push(<a key={k} href={tok} target="_blank" rel="noreferrer" className="break-all text-mab-aqua-texte underline underline-offset-2">{tok}</a>);
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    const k = `b${key++}`;
    if (!line.trim()) { i++; continue; }
    if (/^---+$/.test(line.trim())) { blocks.push(<hr key={k} className="my-4 border-mab-filet" />); i++; continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const cls = h[1].length === 1 ? 'mt-6 mb-2 text-xl font-semibold' : h[1].length === 2 ? 'mt-5 mb-1.5 text-lg font-semibold' : 'mt-4 mb-1 font-semibold';
      blocks.push(<p key={k} role="heading" aria-level={h[1].length + 1} className={`${cls} text-mab-encre first:mt-0`}>{inline(h[2], k)}</p>);
      i++; continue;
    }
    if (line.startsWith('> ')) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) q.push(lines[i++].slice(2));
      blocks.push(<blockquote key={k} className="my-3 rounded-r-mab-champ border-l-4 border-mab-aqua bg-mab-wash-2 px-4 py-2 text-mab-encre">{q.map((l, j) => <p key={j}>{inline(l, `${k}${j}`)}</p>)}</blockquote>);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]) && /^\s*\d+\./.test(lines[i]) === ordered) {
        const raw = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '');
        const box = /^\[( |x|X)\]\s+(.*)$/.exec(raw);
        items.push(
          <li key={i} className={box ? 'flex list-none items-start gap-2 -ml-5' : ''}>
            {box ? <><input type="checkbox" readOnly checked={box[1] !== ' '} className="mt-1.5 h-4 w-4 accent-mab-aqua" /><span className={box[1] !== ' ' ? 'text-mab-gris-doux line-through' : ''}>{inline(box[2], `${k}${i}`)}</span></> : inline(raw, `${k}${i}`)}
          </li>,
        );
        i++;
      }
      blocks.push(ordered
        ? <ol key={k} className="my-2 list-decimal space-y-1 pl-6">{items}</ol>
        : <ul key={k} className="my-2 list-disc space-y-1 pl-6 marker:text-mab-aqua">{items}</ul>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|> |---+$|\s*([-*]|\d+\.)\s+)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={k} className="my-2">{para.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, `${k}${j}`)}</Fragment>)}</p>);
  }
  return <div className={`text-[15px] leading-relaxed text-mab-encre ${className}`}>{blocks}</div>;
}
