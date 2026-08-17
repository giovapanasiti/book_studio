import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { renderMarkdown } from '../lib/markdown';
import { useCtxMenu } from './ContextMenu';
import type { CtxItem } from './ContextMenu';

export interface EditorHandle {
  insertAtCursor: (text: string) => void;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export const Editor = forwardRef<EditorHandle, Props>(function Editor({ value, onChange }, ref) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(true);
  const ctx = useCtxMenu();

  const apply = (fn: (text: string, selStart: number, selEnd: number) => { text: string; selStart: number; selEnd: number }) => {
    const el = ta.current;
    if (!el) return;
    const r = fn(el.value, el.selectionStart, el.selectionEnd);
    onChange(r.text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(r.selStart, r.selEnd);
    });
  };

  const wrap = (before: string, after = before, placeholder = 'text') =>
    apply((text, s, e) => {
      const sel = text.slice(s, e) || placeholder;
      const out = text.slice(0, s) + before + sel + after + text.slice(e);
      return { text: out, selStart: s + before.length, selEnd: s + before.length + sel.length };
    });

  const linePrefix = (prefix: string) =>
    apply((text, s, e) => {
      const ls = text.lastIndexOf('\n', s - 1) + 1;
      const le = text.indexOf('\n', e);
      const end = le === -1 ? text.length : le;
      const block = text.slice(ls, end);
      const lines = block.split('\n');
      const allHave = lines.every((l) => l.startsWith(prefix));
      const newBlock = lines
        .map((l) => (allHave ? l.slice(prefix.length) : prefix + l.replace(/^(#{1,4} |> |- |\d+\. )/, '')))
        .join('\n');
      const out = text.slice(0, ls) + newBlock + text.slice(end);
      return { text: out, selStart: ls, selEnd: ls + newBlock.length };
    });

  const insertBlock = (block: string) =>
    apply((text, s, e) => {
      const needsNL = s > 0 && text[s - 1] !== '\n';
      const ins = (needsNL ? '\n\n' : '') + block + '\n\n';
      const out = text.slice(0, s) + ins + text.slice(e);
      const pos = s + ins.length;
      return { text: out, selStart: pos, selEnd: pos };
    });

  useImperativeHandle(ref, () => ({
    insertAtCursor: (text: string) => insertBlock(text.trim()),
  }));

  const words = useMemo(() => (value.match(/\S+/g) || []).length, [value]);
  const html = useMemo(() => (showPreview ? renderMarkdown(value) : ''), [value, showPreview]);

  const formatItems: CtxItem[] = [
    { label: 'Bold', hint: 'Ctrl+B', onClick: () => wrap('**') },
    { label: 'Italic', hint: 'Ctrl+I', onClick: () => wrap('*') },
    { label: 'Inline code', onClick: () => wrap('`') },
    { sep: true },
    { label: 'Heading', onClick: () => linePrefix('## ') },
    { label: 'Sub-heading', onClick: () => linePrefix('### ') },
    { label: 'Quotation', onClick: () => linePrefix('> ') },
    { label: 'Bullet list', onClick: () => linePrefix('- ') },
    { sep: true },
    { label: 'Link…', onClick: () => wrap('[', '](https://)', 'link text') },
    { label: 'Scene break', onClick: () => insertBlock('---') },
  ];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') {
        e.preventDefault();
        wrap('**');
      } else if (e.key === 'i') {
        e.preventDefault();
        wrap('*');
      }
    }
  };

  return (
    <div className="editor-wrap">
      <div className="editor-toolbar">
        <button className="tool-btn" title="Bold (Ctrl+B)" onClick={() => wrap('**')}>
          <b>B</b>
        </button>
        <button className="tool-btn" title="Italic (Ctrl+I)" onClick={() => wrap('*')}>
          <i>I</i>
        </button>
        <button className="tool-btn" title="Inline code" onClick={() => wrap('`')}>
          {'‹›'}
        </button>
        <div className="tool-sep" />
        <button className="tool-btn" title="Chapter heading" onClick={() => linePrefix('# ')}>
          H1
        </button>
        <button className="tool-btn" title="Heading" onClick={() => linePrefix('## ')}>
          H2
        </button>
        <button className="tool-btn" title="Sub-heading" onClick={() => linePrefix('### ')}>
          H3
        </button>
        <div className="tool-sep" />
        <button className="tool-btn" title="Quotation" onClick={() => linePrefix('> ')}>
          ❝
        </button>
        <button className="tool-btn" title="Bullet list" onClick={() => linePrefix('- ')}>
          ••
        </button>
        <button className="tool-btn" title="Numbered list" onClick={() => linePrefix('1. ')}>
          1.
        </button>
        <div className="tool-sep" />
        <button className="tool-btn" title="Link" onClick={() => wrap('[', '](https://)', 'link text')}>
          🔗
        </button>
        <button className="tool-btn" title="Scene break" onClick={() => insertBlock('---')}>
          ✳
        </button>
        <div className="tool-spacer" />
        <span className="word-count">{words.toLocaleString()} words</span>
        <div className="tool-sep" />
        <button
          className={'tool-btn' + (showPreview ? '' : '')}
          style={showPreview ? { color: 'var(--brass)' } : undefined}
          title="Toggle preview"
          onClick={() => setShowPreview((v) => !v)}
        >
          ⬓
        </button>
      </div>
      <div className={'editor-split' + (showPreview ? ' with-preview' : '')}>
        <textarea
          ref={ta}
          className="md-input"
          value={value}
          spellCheck={false}
          placeholder="Write this chapter in markdown…"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onContextMenu={(e) => ctx(e, formatItems)}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('text/x-book-image')) e.preventDefault();
          }}
          onDrop={(e) => {
            const name = e.dataTransfer.getData('text/x-book-image');
            if (name) {
              e.preventDefault();
              insertBlock(`![${name.replace(/\.[^.]+$/, '')}](images/${name})`);
            }
          }}
        />
        {showPreview && (
          <div className="md-preview">
            <div className="md-render" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        )}
      </div>
    </div>
  );
});
