import type { Chapter } from '../types';
import { imageURLStable } from '../api';

interface Props {
  chapter: Chapter;
  images: string[];
  onPatch: (patch: Partial<Chapter>) => void;
  onImportImages: () => Promise<string[]>;
}

// ImagePageView edits a full-page image plate: pick the image and how it
// fills the page. The plate prints full screen, with no header or number,
// and stays out of the table of contents.
export function ImagePageView({ chapter, images, onPatch, onImportImages }: Props) {
  return (
    <div className="editor-wrap">
      <div className="editor-toolbar">
        <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>Image page</span>
        <div className="tool-sep" />
        <select
          className="select-input"
          style={{ width: 220 }}
          value={chapter.image ?? ''}
          onChange={(e) => onPatch({ image: e.target.value })}
        >
          <option value="">Choose an image…</option>
          {images.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button
          className="btn btn-sm"
          onClick={() => {
            void onImportImages().then((added) => {
              if (added[0]) onPatch({ image: added[0] });
            });
          }}
        >
          Upload…
        </button>
        <div className="tool-sep" />
        <div className="seg-group">
          <button
            className={'seg-btn' + ((chapter.fit ?? 'cover') === 'cover' ? ' active' : '')}
            title="Fill the whole page; the image may be cropped"
            onClick={() => onPatch({ fit: 'cover' })}
          >
            Full bleed
          </button>
          <button
            className={'seg-btn' + (chapter.fit === 'contain' ? ' active' : '')}
            title="Show the whole image; the page may show borders"
            onClick={() => onPatch({ fit: 'contain' })}
          >
            Fit inside
          </button>
        </div>
        <div className="tool-spacer" />
        <span className="word-count">full page · no number · not in the contents</span>
      </div>
      <div className="stage" style={{ justifyContent: 'center' }}>
        {chapter.image ? (
          <img
            src={imageURLStable(chapter.image)}
            alt={chapter.title}
            style={{
              maxWidth: 'min(92%, 900px)',
              maxHeight: '86%',
              objectFit: 'contain',
              boxShadow: '0 3px 8px rgba(0,0,0,0.5), 0 22px 60px rgba(0,0,0,0.35)',
              borderRadius: 2,
            }}
          />
        ) : (
          <div className="empty-hint" style={{ marginTop: 60 }}>
            Choose an image from the library, or upload one.
            <br />
            It prints as a full page before the next chapter.
          </div>
        )}
      </div>
    </div>
  );
}
