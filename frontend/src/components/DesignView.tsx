import { useMemo, useState } from 'react';
import type { Book, Styles } from '../types';
import { PAGE_SIZES, MM_TO_PX, fontStack, BOOK_LANGUAGES, locChapter, locTOC } from '../types';
import { checkKdp, kdpMargins, requiredGutterMM } from '../lib/kdp';
import type { KdpIssue } from '../lib/kdp';
import { useToast } from './Toast';

interface Props {
  book: Book;
  onBook: (patch: Partial<Book>) => void;
  onStyles: (patch: Partial<Styles>) => void;
  onCountPages: () => Promise<number>;
}

const SAMPLE = `It was a bright cold day in the workshop, and the type cases were full. The compositor pulled a line of brass spacers and set the first paragraph the way it had been set for five hundred years, one letter at a time, mirror-backwards and beautiful.

She read the proof twice before she trusted it. Ink tells the truth slowly, her teacher had said; paper keeps whatever you give it.`;

export function DesignView({ book, onBook, onStyles, onCountPages }: Props) {
  const s = book.styles;
  const [tab, setTab] = useState<'book' | 'pdf'>('pdf');
  const [kdpPages, setKdpPages] = useState<number | null>(null);
  const [kdpIssues, setKdpIssues] = useState<KdpIssue[] | null>(null);
  const [checking, setChecking] = useState(false);
  const toast = useToast();

  const sampleVars = useMemo(() => {
    const scale = 1.05;
    return {
      '--bt-body': fontStack(s.bodyFont),
      '--bt-heading': fontStack(s.headingFont),
      '--bt-size': s.bodySize * 1.333 * scale + 'px',
      '--bt-lh': String(s.lineHeight),
      '--bt-text': s.textColor,
      '--bt-headcolor': s.headingColor,
      '--bt-accent': s.accentColor,
      '--bt-align': s.justify ? 'justify' : 'left',
      '--bt-indent': s.paragraphStyle === 'indent' ? '1.5em' : '0',
      '--bt-pmargin': s.paragraphStyle === 'indent' ? '0' : '0 0 0.7em 0',
    } as React.CSSProperties;
  }, [s]);

  const size = PAGE_SIZES[s.pageSize] ?? PAGE_SIZES.Trade;
  const pageW = size.w * MM_TO_PX * 0.62;
  const pageH = size.h * MM_TO_PX * 0.62;
  const inches = (mm: number) => (mm / 25.4).toFixed(2);

  const runKdpCheck = async () => {
    setChecking(true);
    try {
      const pages = await onCountPages();
      setKdpPages(pages);
      setKdpIssues(checkKdp(s, pages));
    } catch (e) {
      toast('error', 'Could not count pages', String(e));
    } finally {
      setChecking(false);
    }
  };

  const applyKdpMargins = () => {
    if (kdpPages === null) return;
    onStyles(kdpMargins(s, kdpPages));
    // Margins changed: page count can shift, so re-check against the result.
    setKdpIssues(null);
    toast('success', 'KDP margins applied', 'Run the check again to confirm the final page count');
  };

  const num = (label: string, key: keyof Styles, min: number, max: number, step = 1, unit = '') => (
    <div className="field-row" key={key}>
      <label>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={s[key] as number}
        onChange={(e) => onStyles({ [key]: Number(e.target.value) } as Partial<Styles>)}
      />
      <span className="range-val">
        {s[key] as number}
        {unit}
      </span>
    </div>
  );

  const check = (label: string, key: keyof Styles) => (
    <label className="check-row" key={key}>
      <input
        type="checkbox"
        checked={Boolean(s[key])}
        onChange={(e) => onStyles({ [key]: e.target.checked } as Partial<Styles>)}
      />
      {label}
    </label>
  );

  const color = (label: string, key: keyof Styles) => (
    <div className="field-row" key={key}>
      <label>{label}</label>
      <input
        type="color"
        value={s[key] as string}
        onChange={(e) => onStyles({ [key]: e.target.value } as Partial<Styles>)}
      />
      <span className="range-val">{s[key] as string}</span>
    </div>
  );

  const fontSelect = (label: string, key: 'bodyFont' | 'headingFont') => (
    <div className="field-row" key={key}>
      <label>{label}</label>
      <div className="seg-group">
        {(['serif', 'sans', 'mono'] as const).map((f) => (
          <button
            key={f}
            className={'seg-btn' + (s[key] === f ? ' active' : '')}
            style={{ fontFamily: fontStack(f) }}
            onClick={() => onStyles({ [key]: f } as Partial<Styles>)}
          >
            {f === 'serif' ? 'Serif' : f === 'sans' ? 'Sans' : 'Mono'}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="design-grid">
      <div className="design-forms">
        <div className="seg-group" style={{ marginBottom: 20 }}>
          <button className={'seg-btn' + (tab === 'book' ? ' active' : '')} onClick={() => setTab('book')}>
            Book
          </button>
          <button className={'seg-btn' + (tab === 'pdf' ? ' active' : '')} onClick={() => setTab('pdf')}>
            PDF settings
          </button>
        </div>

        {tab === 'book' && (
          <div className="panel-section">
            <div className="panel-title">Book</div>
            <div className="field-row">
              <label>Title</label>
              <input className="text-input grow" value={book.title} onChange={(e) => onBook({ title: e.target.value })} />
            </div>
            <div className="field-row">
              <label>Subtitle</label>
              <input className="text-input grow" value={book.subtitle} onChange={(e) => onBook({ subtitle: e.target.value })} />
            </div>
            <div className="field-row">
              <label>Author</label>
              <input className="text-input grow" value={book.author} onChange={(e) => onBook({ author: e.target.value })} />
            </div>
            <div className="field-row">
              <label>Language</label>
              <select
                className="select-input grow"
                value={BOOK_LANGUAGES.some(([c]) => c === book.language) ? book.language : 'en'}
                onChange={(e) => onBook({ language: e.target.value })}
              >
                {BOOK_LANGUAGES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-row">
              <label>Description</label>
              <textarea
                className="text-input grow"
                value={book.description}
                placeholder="Back-cover text, used in the ePub metadata"
                onChange={(e) => onBook({ description: e.target.value })}
              />
            </div>
          </div>
        )}

        {tab === 'pdf' && (
          <>
            <div className="panel-section">
              <div className="panel-title">Trim size</div>
              <div className="field-row">
                <label>Page size</label>
                <select
                  className="select-input grow"
                  value={s.pageSize}
                  onChange={(e) => onStyles({ pageSize: e.target.value })}
                >
                  <optgroup label="Standard">
                    {Object.entries(PAGE_SIZES)
                      .filter(([, v]) => v.group === 'standard')
                      .map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Amazon KDP trim sizes">
                    {Object.entries(PAGE_SIZES)
                      .filter(([, v]) => v.group === 'kdp')
                      .map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
              <p className="empty-hint" style={{ textAlign: 'left', padding: '0 0 8px' }}>
                {size.w} × {size.h} mm · {inches(size.w)} × {inches(size.h)} inches
              </p>
              <div className="field-row">
                <label>Columns</label>
                <div className="seg-group">
                  <button className={'seg-btn' + (s.columns <= 1 ? ' active' : '')} onClick={() => onStyles({ columns: 1 })}>
                    Book · 1
                  </button>
                  <button className={'seg-btn' + (s.columns === 2 ? ' active' : '')} onClick={() => onStyles({ columns: 2 })}>
                    Magazine · 2
                  </button>
                </div>
              </div>
            </div>

            <div className="panel-section">
              <div className="panel-title">Amazon KDP check</div>
              <p className="empty-hint" style={{ textAlign: 'left', padding: '0 0 10px' }}>
                KDP's required inside margin grows with the page count
                (0.375″ up to 150 pages, then 0.5″, 0.625″, 0.75″, 0.875″).
                The check typesets your book and verifies every rule.
              </p>
              <div className="field-row">
                <button className="btn btn-sm" disabled={checking} onClick={() => void runKdpCheck()}>
                  {checking ? 'Typesetting…' : 'Check for KDP'}
                </button>
                {kdpPages !== null && (
                  <span className="range-val" style={{ textAlign: 'left', minWidth: 0 }}>
                    {kdpPages} pages · gutter ≥ {(requiredGutterMM(kdpPages)).toFixed(1)} mm
                  </span>
                )}
              </div>
              {kdpIssues && (
                <>
                  {kdpIssues.map((issue, i) => (
                    <div key={i} className="field-row" style={{ marginBottom: 4 }}>
                      <span style={{ color: issue.ok ? 'var(--ok)' : 'var(--danger)', width: 16 }}>
                        {issue.ok ? '✓' : '✗'}
                      </span>
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>{issue.text}</span>
                    </div>
                  ))}
                  {kdpIssues.some((i) => !i.ok) && (
                    <div className="field-row" style={{ marginTop: 6 }}>
                      <button className="btn btn-sm btn-primary" onClick={applyKdpMargins}>
                        Apply KDP margins
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="panel-section">
              <div className="panel-title">Margins</div>
              {num('Top margin', 'marginTop', 6, 40, 0.5, ' mm')}
              {num('Bottom margin', 'marginBottom', 6, 40, 0.5, ' mm')}
              {num('Inner margin', 'marginInner', 6, 40, 0.5, ' mm')}
              {num('Outer margin', 'marginOuter', 6, 40, 0.5, ' mm')}
            </div>

            <div className="panel-section">
              <div className="panel-title">Typography</div>
              {fontSelect('Body font', 'bodyFont')}
              {fontSelect('Heading font', 'headingFont')}
              {num('Body size', 'bodySize', 8, 16, 0.5, ' pt')}
              {num('Line height', 'lineHeight', 1.1, 2.2, 0.05)}
              <div className="field-row">
                <label>Paragraphs</label>
                <div className="seg-group">
                  <button
                    className={'seg-btn' + (s.paragraphStyle === 'indent' ? ' active' : '')}
                    onClick={() => onStyles({ paragraphStyle: 'indent' })}
                  >
                    Indented
                  </button>
                  <button
                    className={'seg-btn' + (s.paragraphStyle === 'space' ? ' active' : '')}
                    onClick={() => onStyles({ paragraphStyle: 'space' })}
                  >
                    Spaced
                  </button>
                </div>
              </div>
              {check('Justify text', 'justify')}
              {check('Drop caps at chapter start', 'dropCaps')}
            </div>

            <div className="panel-section">
              <div className="panel-title">Front &amp; running matter</div>
              {check('Title page', 'titlePageEnabled')}
              {check('Table of contents', 'tocEnabled')}
              {check('Chapter numbering', 'chapterNumbering')}
              {check('Page numbers', 'showPageNumbers')}
              {check('Running header', 'showHeader')}
              <div className="field-row">
                <label>Chapter label</label>
                <input
                  className="text-input grow"
                  value={s.chapterLabel ?? ''}
                  placeholder={locChapter(book.language)}
                  title="The word before the chapter number. Empty = follow the language."
                  onChange={(e) => onStyles({ chapterLabel: e.target.value })}
                />
              </div>
              <div className="field-row">
                <label>Contents title</label>
                <input
                  className="text-input grow"
                  value={s.tocTitle ?? ''}
                  placeholder={locTOC(book.language)}
                  title="The heading of the table of contents. Empty = follow the language."
                  onChange={(e) => onStyles({ tocTitle: e.target.value })}
                />
              </div>
            </div>

            <div className="panel-section">
              <div className="panel-title">Colors</div>
              {color('Text', 'textColor')}
              {color('Headings', 'headingColor')}
              {color('Accent', 'accentColor')}
            </div>
          </>
        )}
      </div>

      <div className="stage">
        <div className="preview-meta">
          Live specimen — {size.label} · {size.w}×{size.h} mm
        </div>
        <div className="paper-page" style={{ width: pageW, height: pageH }}>
          <div
            className={'book-typo' + (s.dropCaps ? ' dropcaps' : '')}
            style={{
              ...sampleVars,
              position: 'absolute',
              inset: `${s.marginTop * MM_TO_PX * 0.62}px ${s.marginOuter * MM_TO_PX * 0.62}px ${
                s.marginBottom * MM_TO_PX * 0.62
              }px ${s.marginInner * MM_TO_PX * 0.62}px`,
              overflow: 'hidden',
            }}
          >
            <div className="chapter-open" style={{ margin: '6% 0 1.6em' }}>
              {s.chapterNumbering && <p className="num">{(s.chapterLabel?.trim() || locChapter(book.language)) + ' 1'}</p>}
              <h1>The Specimen Page</h1>
              <div className="rule" />
            </div>
            <div
              className="chapter-body"
              style={s.columns === 2 ? { columnCount: 2, columnGap: s.columnGap * MM_TO_PX * 0.62 } : undefined}
            >
              {SAMPLE.split('\n\n').map((t, i) => (
                <p key={i}>{t}</p>
              ))}
            </div>
          </div>
          {s.showPageNumbers && <div className="page-num-label">3</div>}
          {s.showHeader && <div className="page-header-label">{book.title || 'Book title'}</div>}
        </div>
      </div>
    </div>
  );
}
