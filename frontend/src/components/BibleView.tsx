import { useState } from 'react';
import type { Bible, Book, NoteCard, StyleRule } from '../types';
import { useCtxMenu } from './ContextMenu';
import { BibleCharacters } from './BibleCharacters';
import { BibleWorld } from './BibleWorld';
import { BibleThreads, BibleTimeline } from './BiblePlot';
import { BibleOutline } from './BibleOutline';

interface Props {
  book: Book;
  bible: Bible;
  images: string[];
  onBible: (patch: Partial<Bible>) => void;
  onGoToChapter: (id: string) => void;
}

type Section = 'premise' | 'characters' | 'world' | 'threads' | 'timeline' | 'outline' | 'notes' | 'style';

const SECTIONS: [Section, string, string][] = [
  ['premise', 'Premise', 'Logline, synopsis, theme'],
  ['characters', 'Characters', 'The cast and their arcs'],
  ['world', 'World', 'Places and settings'],
  ['threads', 'Plot threads', 'Main plot, romance, subplots'],
  ['timeline', 'Timeline', 'Events in story order'],
  ['outline', 'Outline', 'Chapter plan and progress'],
  ['notes', 'Notes', 'Research and ideas'],
  ['style', 'Style sheet', 'Spellings and choices'],
];

const NOTE_CATEGORIES = ['research', 'worldbuilding', 'idea', 'reminder'];

export function BibleView({ book, bible, images, onBible, onGoToChapter }: Props) {
  const [section, setSection] = useState<Section>('premise');
  const ctx = useCtxMenu();

  const counts: Partial<Record<Section, number>> = {
    characters: bible.characters.length,
    world: bible.locations.length,
    threads: bible.threads.length,
    timeline: bible.timeline.length,
    notes: bible.notes.length,
    style: bible.styleSheet.length,
  };

  const premiseArea = (label: string, key: 'logline' | 'synopsis' | 'theme', placeholder: string, rows = 3) => (
    <div className="field-row" style={{ alignItems: 'flex-start' }}>
      <label style={{ paddingTop: 6 }}>{label}</label>
      <textarea
        className="text-input grow"
        rows={rows}
        value={bible[key]}
        placeholder={placeholder}
        onChange={(e) => onBible({ [key]: e.target.value } as Partial<Bible>)}
      />
    </div>
  );

  const patchNote = (id: string, p: Partial<NoteCard>) =>
    onBible({ notes: bible.notes.map((n) => (n.id === id ? { ...n, ...p } : n)) });

  const patchRule = (id: string, p: Partial<StyleRule>) =>
    onBible({ styleSheet: bible.styleSheet.map((r) => (r.id === id ? { ...r, ...p } : r)) });

  return (
    <div className="bible-grid">
      <nav className="bible-nav">
        {SECTIONS.map(([key, label, hint]) => (
          <button
            key={key}
            className={'bible-nav-item' + (section === key ? ' active' : '')}
            onClick={() => setSection(key)}
          >
            <span className="bn-label">
              {label}
              {counts[key] ? <span className="bn-count">{counts[key]}</span> : null}
            </span>
            <span className="bn-hint">{hint}</span>
          </button>
        ))}
      </nav>

      <div className="bible-content">
        {section === 'premise' && (
          <div className="bible-stack" style={{ maxWidth: 720 }}>
            <div className="panel-section">
              <div className="panel-title">The book in one breath</div>
              {premiseArea('Logline', 'logline', 'One or two sentences: protagonist, goal, obstacle, stakes.', 2)}
              <div className="field-grid-2">
                <div className="field-row">
                  <label>Genre</label>
                  <input
                    className="text-input grow"
                    value={bible.genre}
                    placeholder="romance · thriller · memoir…"
                    onChange={(e) => onBible({ genre: e.target.value })}
                  />
                </div>
                <div className="field-row">
                  <label>Audience</label>
                  <input
                    className="text-input grow"
                    value={bible.audience}
                    placeholder="adult · YA · readers of…"
                    onChange={(e) => onBible({ audience: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="panel-section">
              <div className="panel-title">Foundation</div>
              {premiseArea('Theme', 'theme', 'What the story is really about, under the plot.', 2)}
              {premiseArea('Synopsis', 'synopsis', 'The whole story in a page: beginning, middle, end — spoilers included.', 10)}
            </div>
          </div>
        )}

        {section === 'characters' && <BibleCharacters bible={bible} images={images} onBible={onBible} />}
        {section === 'world' && <BibleWorld bible={bible} images={images} onBible={onBible} />}
        {section === 'threads' && <BibleThreads bible={bible} onBible={onBible} />}
        {section === 'timeline' && <BibleTimeline bible={bible} onBible={onBible} />}
        {section === 'outline' && (
          <BibleOutline book={book} bible={bible} onBible={onBible} onGoToChapter={onGoToChapter} />
        )}

        {section === 'notes' && (
          <div className="bible-stack">
            {bible.notes.length === 0 && (
              <div className="empty-hint">
                No notes yet. Research, world rules, stray ideas — put them on cards so they are
                there when you write.
              </div>
            )}
            <div className="notes-grid">
              {bible.notes.map((n) => (
                <div
                  className="note-card"
                  key={n.id}
                  onContextMenu={(e) =>
                    ctx(e, [
                      { header: n.title || 'Note' },
                      { label: 'Delete note', danger: true, onClick: () => onBible({ notes: bible.notes.filter((x) => x.id !== n.id) }) },
                    ])
                  }
                >
                  <div className="field-row" style={{ marginBottom: 6 }}>
                    <input
                      className="text-input grow"
                      value={n.title}
                      placeholder="Note title"
                      onChange={(e) => patchNote(n.id, { title: e.target.value })}
                    />
                    <select className="select-input" style={{ flex: '0 0 130px' }} value={n.category} onChange={(e) => patchNote(n.id, { category: e.target.value })}>
                      {NOTE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    className="text-input"
                    rows={5}
                    value={n.content}
                    placeholder="The note itself."
                    onChange={(e) => patchNote(n.id, { content: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <button
              className="sidebar-add"
              style={{ margin: 0 }}
              onClick={() =>
                onBible({ notes: [...bible.notes, { id: crypto.randomUUID(), category: 'research', title: '', content: '' }] })
              }
            >
              + New note
            </button>
          </div>
        )}

        {section === 'style' && (
          <div className="bible-stack" style={{ maxWidth: 760 }}>
            <p className="empty-hint" style={{ textAlign: 'left', padding: 0 }}>
              The editorial style sheet: every spelling, hyphenation and naming decision, recorded
              once so the whole book agrees with itself.
            </p>
            {bible.styleSheet.map((r) => (
              <div
                className="field-row"
                key={r.id}
                onContextMenu={(e) =>
                  ctx(e, [
                    { header: r.term || 'Entry' },
                    { label: 'Delete entry', danger: true, onClick: () => onBible({ styleSheet: bible.styleSheet.filter((x) => x.id !== r.id) }) },
                  ])
                }
              >
                <input
                  className="text-input"
                  style={{ flex: '0 0 220px', fontFamily: 'var(--mono)', fontSize: 12.5 }}
                  value={r.term}
                  placeholder="term"
                  onChange={(e) => patchRule(r.id, { term: e.target.value })}
                />
                <input
                  className="text-input grow"
                  value={r.rule}
                  placeholder='the decision — e.g. "always lower-case; her nickname only in dialogue"'
                  onChange={(e) => patchRule(r.id, { rule: e.target.value })}
                />
              </div>
            ))}
            <button
              className="sidebar-add"
              style={{ margin: 0 }}
              onClick={() => onBible({ styleSheet: [...bible.styleSheet, { id: crypto.randomUUID(), term: '', rule: '' }] })}
            >
              + New entry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
