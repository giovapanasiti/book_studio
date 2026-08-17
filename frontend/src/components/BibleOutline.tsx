import { useEffect, useState } from 'react';
import type { Bible, Book, OutlineEntry } from '../types';
import { CHAPTER_STATUSES } from '../types';
import { api } from '../api';

interface Props {
  book: Book;
  bible: Bible;
  onBible: (patch: Partial<Bible>) => void;
  onGoToChapter: (id: string) => void;
}

const EMPTY: OutlineEntry = { synopsis: '', pov: '', status: 'idea', targetWords: 0 };

export function BibleOutline({ book, bible, onBible, onGoToChapter }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<string, number> = {};
      for (const ch of book.chapters) {
        const md = await api.readChapter(ch.file).catch(() => '');
        out[ch.id] = (md.match(/\S+/g) || []).length;
      }
      if (alive) setCounts(out);
    })();
    return () => {
      alive = false;
    };
  }, [book.chapters]);

  const entry = (id: string): OutlineEntry => ({ ...EMPTY, ...(bible.outline[id] ?? {}) });
  const patch = (id: string, p: Partial<OutlineEntry>) =>
    onBible({ outline: { ...bible.outline, [id]: { ...entry(id), ...p } } });

  const totalWords = Object.values(counts).reduce((a, b) => a + b, 0);
  const pct = bible.targetWords > 0 ? Math.min(100, (totalWords / bible.targetWords) * 100) : 0;

  return (
    <div className="bible-stack">
      <div className="panel-section">
        <div className="panel-title">Progress</div>
        <div className="field-row">
          <label>Word target</label>
          <input
            className="text-input num-input"
            style={{ width: 100 }}
            type="number"
            min={0}
            value={bible.targetWords || ''}
            placeholder="e.g. 80000"
            onChange={(e) => onBible({ targetWords: Number(e.target.value) || 0 })}
          />
          <span className="range-val" style={{ minWidth: 160, textAlign: 'left' }}>
            {totalWords.toLocaleString()} words written
            {bible.targetWords > 0 && ` · ${Math.round(pct)}%`}
          </span>
        </div>
        {bible.targetWords > 0 && (
          <div className="progress-track">
            <div className="progress-fill" style={{ width: pct + '%' }} />
          </div>
        )}
      </div>

      <div className="panel-section">
        <div className="panel-title">Chapters</div>
        {book.chapters.map((ch, i) => {
          const e = entry(ch.id);
          const words = counts[ch.id] ?? 0;
          return (
            <div className="outline-row" key={ch.id}>
              <div className="outline-head">
                <button className="outline-title" onClick={() => onGoToChapter(ch.id)} title="Open in the editor">
                  {i + 1}. {ch.title}
                </button>
                <select
                  className="select-input"
                  style={{ flex: '0 0 150px' }}
                  value={e.pov}
                  onChange={(ev) => patch(ch.id, { pov: ev.target.value })}
                >
                  <option value="">POV —</option>
                  {bible.characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="seg-group">
                  {CHAPTER_STATUSES.map(([k, v]) => (
                    <button
                      key={k}
                      className={'seg-btn status-' + k + (e.status === k ? ' active' : '')}
                      onClick={() => patch(ch.id, { status: k })}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <input
                  className="text-input"
                  style={{ flex: '0 0 74px' }}
                  type="number"
                  min={0}
                  title="Word target for this chapter"
                  placeholder="target"
                  value={e.targetWords || ''}
                  onChange={(ev) => patch(ch.id, { targetWords: Number(ev.target.value) || 0 })}
                />
                <span className="word-count" style={{ flex: '0 0 70px', textAlign: 'right' }}>
                  {words.toLocaleString()}
                </span>
              </div>
              <textarea
                className="text-input"
                rows={2}
                value={e.synopsis}
                placeholder="What happens in this chapter — and what changes by its end."
                onChange={(ev) => patch(ch.id, { synopsis: ev.target.value })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
