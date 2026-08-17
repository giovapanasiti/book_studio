import { useEffect, useMemo, useState } from 'react';
import type { Book } from '../types';
import { PAGE_SIZES, MM_TO_PX, fontStack, locTOC, locChapter } from '../types';
import { api } from '../api';
import { renderMarkdown } from '../lib/markdown';
import { paginate } from '../lib/paginate';
import { CoverCanvas } from './CoverCanvas';

interface PageData {
  kind: 'cover' | 'title' | 'toc' | 'body';
  html?: string;
  header?: string;
  folio?: number;
  dropcap?: boolean;
}

export function PreviewView({ book }: { book: Book }) {
  const [pages, setPages] = useState<PageData[] | null>(null);
  const [tocFolios, setTocFolios] = useState<Record<string, number>>({});
  const [zoom, setZoom] = useState(0.68);

  const s = book.styles;
  const size = PAGE_SIZES[s.pageSize] ?? PAGE_SIZES.Trade;
  const pageW = size.w * MM_TO_PX * zoom;
  const pageH = size.h * MM_TO_PX * zoom;
  const padT = s.marginTop * MM_TO_PX * zoom;
  const padB = s.marginBottom * MM_TO_PX * zoom;
  const padL = s.marginInner * MM_TO_PX * zoom;
  const padR = s.marginOuter * MM_TO_PX * zoom;
  const innerW = pageW - padL - padR;
  const innerH = pageH - padT - padB;
  const cols = s.columns === 2 ? 2 : 1;
  const gapPx = s.columnGap * MM_TO_PX * zoom;
  const colW = (innerW - (cols - 1) * gapPx) / cols;

  const cssVars = useMemo(
    () =>
      ({
        '--bt-body': fontStack(s.bodyFont),
        '--bt-heading': fontStack(s.headingFont),
        '--bt-size': s.bodySize * 1.333 * zoom + 'px',
        '--bt-lh': String(s.lineHeight),
        '--bt-text': s.textColor,
        '--bt-headcolor': s.headingColor,
        '--bt-accent': s.accentColor,
        '--bt-align': s.justify ? 'justify' : 'left',
        '--bt-indent': s.paragraphStyle === 'indent' ? '1.5em' : '0',
        '--bt-pmargin': s.paragraphStyle === 'indent' ? '0' : '0 0 0.7em 0',
      }) as Record<string, string>,
    [s, zoom]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setPages(null);
      const out: PageData[] = [];
      out.push({ kind: 'cover' });
      if (s.titlePageEnabled) out.push({ kind: 'title' });
      const tocIndex = out.length;
      if (s.tocEnabled) out.push({ kind: 'toc' });

      const folios: Record<string, number> = {};
      let folio = 1;
      for (let i = 0; i < book.chapters.length; i++) {
        const ch = book.chapters[i];
        const md = await api.readChapter(ch.file).catch(() => '');
        let html = renderMarkdown(md);
        // Remove a leading H1 that repeats the chapter title.
        html = html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>/, '');
        const open =
          `<div class="chapter-open">` +
          (s.chapterNumbering ? `<p class="num">${locChapter(book.language)} ${i + 1}</p>` : '') +
          `<h1>${escapeHTML(ch.title)}</h1><div class="rule"></div></div>`;
        const chunks = await paginate(open + html, {
          colWidthPx: colW,
          pageHeightPx: innerH,
          columns: cols,
          cssVars,
        });
        if (!alive) return;
        folios[ch.id] = folio;
        chunks.forEach((chunk, pi) => {
          out.push({
            kind: 'body',
            html: chunk,
            header: ch.title,
            folio: folio++,
            dropcap: s.dropCaps && pi === 0,
          });
        });
      }
      if (!alive) return;
      setTocFolios(folios);
      setPages(out);
      void tocIndex;
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, zoom]);

  return (
    <>
      <div className="stage-toolbar">
        <span>Zoom</span>
        {[0.5, 0.68, 0.85, 1].map((z) => (
          <button
            key={z}
            className={'seg-btn' + (zoom === z ? ' active' : '')}
            style={{ padding: '3px 9px' }}
            onClick={() => setZoom(z)}
          >
            {Math.round(z * 100)}%
          </button>
        ))}
        <span style={{ marginLeft: 'auto' }}>
          {pages ? `${pages.length} pages — as they will print` : 'Paginating…'}
        </span>
      </div>
      <div className="stage">
        {!pages && <div className="empty-hint">Setting your book, one moment…</div>}
        {pages && (
          <div className="preview-pages">
            {pages.map((pg, i) => (
              <div key={i} className="paper-page" style={{ width: pageW, height: pageH }}>
                {pg.kind === 'cover' && (
                  <div style={{ position: 'absolute', inset: 0 }}>
                    <CoverCanvas cover={book.cover} pageSize={s.pageSize} width={pageW} />
                  </div>
                )}
                {pg.kind === 'title' && (
                  <div
                    className="book-typo"
                    style={{ ...(cssVars as React.CSSProperties), position: 'absolute', inset: `${padT}px ${padR}px ${padB}px ${padL}px`, textAlign: 'center' }}
                  >
                    <div style={{ marginTop: '34%', fontFamily: 'var(--bt-heading)', fontSize: '2.2em', fontWeight: 700, color: 'var(--bt-headcolor)' }}>
                      {book.title}
                    </div>
                    {book.subtitle && <div style={{ marginTop: '1.2em', fontStyle: 'italic', fontSize: '1.2em' }}>{book.subtitle}</div>}
                    <div style={{ marginTop: '38%', letterSpacing: '0.22em', textTransform: 'uppercase', fontSize: '0.95em' }}>
                      {book.author}
                    </div>
                  </div>
                )}
                {pg.kind === 'toc' && (
                  <div
                    className="book-typo"
                    style={{ ...(cssVars as React.CSSProperties), position: 'absolute', inset: `${padT}px ${padR}px ${padB}px ${padL}px` }}
                  >
                    <h1 style={{ margin: '8% 0 1.4em' }}>{locTOC(book.language)}</h1>
                    {book.chapters.map((ch) => (
                      <div key={ch.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: '0.6em' }}>
                        <span>{ch.title}</span>
                        <span style={{ flex: 1, borderBottom: '1px dotted currentColor', opacity: 0.4, transform: 'translateY(-3px)' }} />
                        <span>{tocFolios[ch.id] ?? '·'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {pg.kind === 'body' && (
                  <>
                    {s.showHeader && <div className="page-header-label">{(pg.folio ?? 0) % 2 === 0 ? book.title : pg.header}</div>}
                    <div
                      className={'book-typo' + (pg.dropcap ? ' dropcaps' : '')}
                      style={{ ...(cssVars as React.CSSProperties), position: 'absolute', inset: `${padT}px ${padR}px ${padB}px ${padL}px`, overflow: 'hidden' }}
                    >
                      <div
                        className={'chapter-body' + (cols === 2 ? ' page-columns' : '')}
                        style={cols === 2 ? { columnCount: 2, columnGap: gapPx } : { height: '100%' }}
                        dangerouslySetInnerHTML={{ __html: pg.html || '' }}
                      />
                    </div>
                    {s.showPageNumbers && <div className="page-num-label">{pg.folio}</div>}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function escapeHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
