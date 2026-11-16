import React from 'react';

/**
 * Tiny Markdown renderer for tutorial text (`body_md`): paragraphs, numbered and bulleted lists, **bold**,
 * *italic* and `code`. It builds React elements, never HTML strings, so tutorial text can never inject markup.
 */

export type MdBlock =
  | { type: 'p'; text: string }
  | { type: 'ol'; items: string[] }
  | { type: 'ul'; items: string[] };

const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;

/** Splits Markdown text into paragraphs and lists. */
export function parseBlocks(source: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let paragraph: string[] = [];
  let list: { type: 'ol' | 'ul'; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'p', text: paragraph.join(' ') });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const line of lines) {
    const ordered = ORDERED.exec(line);
    const bullet = ordered ? null : BULLET.exec(line);
    if (ordered || bullet) {
      flushParagraph();
      const type = ordered ? 'ol' : 'ul';
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((ordered ?? bullet)![1].trim());
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (list && /^\s+\S/.test(line)) {
      // A wrapped continuation line of the previous list item.
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

/** Inline formatting of one line of text. */
export function renderInline(text: string): React.ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-slate-100 text-[0.92em] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    if ((part.startsWith('*') && part.endsWith('*') && part.length > 2) || (part.startsWith('_') && part.endsWith('_') && part.length > 2)) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export const MiniMarkdown: React.FC<{ source: string; className?: string }> = ({ source, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {parseBlocks(source).map((block, i) => {
      if (block.type === 'p') return <p key={i}>{renderInline(block.text)}</p>;
      const Tag = block.type === 'ol' ? 'ol' : 'ul';
      return (
        <Tag key={i} className={`${block.type === 'ol' ? 'list-decimal' : 'list-disc'} pl-5 space-y-1`}>
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </Tag>
      );
    })}
  </div>
);
