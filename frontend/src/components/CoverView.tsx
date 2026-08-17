import { useEffect, useMemo, useRef, useState } from 'react';
import type { Book, Cover, CoverElement, SystemFont } from '../types';
import { PAGE_SIZES, coverElements, newCoverElement } from '../types';
import { api } from '../api';
import { useCtxMenu } from './ContextMenu';
import { useToast } from './Toast';
import { CoverCanvas } from './CoverCanvas';
import { ensureFontLoaded } from '../lib/fonts';

interface Props {
  book: Book;
  images: string[];
  onCover: (patch: Partial<Cover>) => void;
  onImagesChanged: () => void;
}

let fontsCache: SystemFont[] | null = null;

export function CoverView({ book, images, onCover, onImagesChanged }: Props) {
  const c = book.cover;
  const s = book.styles;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fonts, setFonts] = useState<SystemFont[]>(fontsCache ?? []);
  const ctx = useCtxMenu();
  const toast = useToast();
  const migrated = useRef(false);

  const elements = useMemo(() => coverElements(c), [c]);
  const sel = elements.find((e) => e.id === selectedId) ?? null;

  // Persist the migration of older three-slot covers into elements.
  useEffect(() => {
    if (!migrated.current && (!c.elements || c.elements.length === 0) && elements.length > 0) {
      migrated.current = true;
      onCover({ elements });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fontsCache) return;
    api.listSystemFonts().then((f) => {
      fontsCache = f;
      setFonts(f);
    }).catch(() => {});
  }, []);

  // Delete key removes the selected element when no field has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (selectedId) removeElement(selectedId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, elements]);

  const setElements = (els: CoverElement[]) => onCover({ elements: els });

  const patchEl = (id: string, patch: Partial<CoverElement>) =>
    setElements(elements.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const addElement = (el: CoverElement) => {
    setElements([...elements, el]);
    setSelectedId(el.id);
  };

  const removeElement = (id: string) => {
    setElements(elements.filter((e) => e.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const moveLayer = (id: string, to: 'front' | 'back' | 'up' | 'down') => {
    const i = elements.findIndex((e) => e.id === id);
    if (i < 0) return;
    const els = [...elements];
    const [el] = els.splice(i, 1);
    if (to === 'front') els.push(el);
    else if (to === 'back') els.unshift(el);
    else if (to === 'up') els.splice(Math.min(els.length, i + 1), 0, el);
    else els.splice(Math.max(0, i - 1), 0, el);
    setElements(els);
  };

  const uploadImages = async (): Promise<string[]> => {
    try {
      const added = await api.importImages();
      if (added.length) {
        onImagesChanged();
        toast('success', `Imported ${added.length} image${added.length > 1 ? 's' : ''}`);
      }
      return added;
    } catch (e) {
      toast('error', String(e));
      return [];
    }
  };

  const elementMenu = (e: React.MouseEvent, el: CoverElement) => {
    setSelectedId(el.id);
    ctx(e, [
      { header: el.type === 'text' ? el.text.slice(0, 24) || 'Text' : el.type },
      { label: 'Duplicate', onClick: () => addElement({ ...el, id: crypto.randomUUID(), x: el.x + 3, y: el.y + 3 }) },
      { sep: true },
      { label: 'Bring to front', onClick: () => moveLayer(el.id, 'front') },
      { label: 'Bring forward', onClick: () => moveLayer(el.id, 'up') },
      { label: 'Send backward', onClick: () => moveLayer(el.id, 'down') },
      { label: 'Send to back', onClick: () => moveLayer(el.id, 'back') },
      { sep: true },
      { label: 'Delete', danger: true, hint: 'Del', onClick: () => removeElement(el.id) },
    ]);
  };

  const bgMenu = (e: React.MouseEvent) =>
    ctx(e, [
      { header: 'Cover background' },
      ...(c.bgImage ? [{ label: 'Remove background image', onClick: () => onCover({ bgImage: '' }) }] : []),
      { label: c.borderFrame ? 'Remove frame' : 'Add frame', onClick: () => onCover({ borderFrame: !c.borderFrame }) },
      { label: c.gradientOn ? 'Solid color' : 'Gradient', onClick: () => onCover({ gradientOn: !c.gradientOn }) },
    ]);

  const H = Math.min(660, window.innerHeight - 210);
  const W = H * ((PAGE_SIZES[s.pageSize] ?? PAGE_SIZES.Trade).w / (PAGE_SIZES[s.pageSize] ?? PAGE_SIZES.Trade).h);

  const num = (label: string, key: keyof CoverElement, min: number, max: number, step = 1, unit = '') =>
    sel && (
      <div className="field-row" key={key}>
        <label>{label}</label>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={sel[key] as number}
          onChange={(e) => patchEl(sel.id, { [key]: Number(e.target.value) } as Partial<CoverElement>)}
        />
        <span className="range-val">
          {sel[key] as number}
          {unit}
        </span>
      </div>
    );

  return (
    <div className="cover-grid">
      <div className="design-forms">
        <div className="panel-section">
          <div className="panel-title">Background</div>
          <div className="field-row">
            <label>Style</label>
            <div className="seg-group">
              <button className={'seg-btn' + (!c.gradientOn ? ' active' : '')} onClick={() => onCover({ gradientOn: false })}>
                Solid
              </button>
              <button className={'seg-btn' + (c.gradientOn ? ' active' : '')} onClick={() => onCover({ gradientOn: true })}>
                Gradient
              </button>
            </div>
          </div>
          <div className="field-row">
            <label>Color</label>
            <input type="color" value={c.bgColor} onChange={(e) => onCover({ bgColor: e.target.value })} />
            {c.gradientOn && (
              <>
                <span style={{ color: 'var(--faint)' }}>→</span>
                <input type="color" value={c.bgColor2} onChange={(e) => onCover({ bgColor2: e.target.value })} />
              </>
            )}
          </div>
          <div className="field-row">
            <label>Image</label>
            <select className="select-input grow" value={c.bgImage} onChange={(e) => onCover({ bgImage: e.target.value })}>
              <option value="">None</option>
              {images.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              className="btn btn-sm"
              title="Upload an image from your computer"
              onClick={() => void uploadImages().then((a) => a[0] && onCover({ bgImage: a[0] }))}
            >
              Upload…
            </button>
          </div>
          {c.bgImage && (
            <div className="field-row">
              <label>Darken image</label>
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.05}
                value={c.overlay}
                onChange={(e) => onCover({ overlay: Number(e.target.value) })}
              />
              <span className="range-val">{Math.round(c.overlay * 100)}%</span>
            </div>
          )}
          <label className="check-row">
            <input type="checkbox" checked={c.borderFrame} onChange={(e) => onCover({ borderFrame: e.target.checked })} />
            Thin frame
          </label>
          {c.borderFrame && (
            <div className="field-row">
              <label>Frame color</label>
              <input type="color" value={c.frameColor} onChange={(e) => onCover({ frameColor: e.target.value })} />
            </div>
          )}
        </div>

        {sel && (
          <div className="panel-section">
            <div className="panel-title">
              {sel.type === 'text' ? 'Text element' : sel.type === 'image' ? 'Image element' : 'Shape'}
            </div>
            {sel.type === 'text' && (
              <>
                <div className="field-row" style={{ alignItems: 'flex-start' }}>
                  <label style={{ paddingTop: 6 }}>Text</label>
                  <textarea
                    className="text-input grow"
                    rows={2}
                    value={sel.text}
                    onChange={(e) => patchEl(sel.id, { text: e.target.value })}
                  />
                </div>
                <div className="field-row">
                  <label>Font</label>
                  <select
                    className="select-input grow"
                    value={sel.fontPath ? 'path:' + sel.fontPath : sel.font}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.startsWith('path:')) {
                        const path = v.slice(5);
                        const f = fonts.find((x) => x.path === path);
                        if (f) {
                          void ensureFontLoaded(f.name, f.path);
                          patchEl(sel.id, { font: f.name, fontPath: f.path });
                        }
                      } else {
                        patchEl(sel.id, { font: v, fontPath: '' });
                      }
                    }}
                  >
                    <optgroup label="Built-in">
                      <option value="serif">Serif (Georgia)</option>
                      <option value="sans">Sans (Helvetica)</option>
                      <option value="mono">Mono (Courier)</option>
                    </optgroup>
                    <optgroup label={`System fonts (${fonts.length})`}>
                      {fonts.map((f) => (
                        <option key={f.path} value={'path:' + f.path}>
                          {f.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                {num('Size', 'size', 6, 96, 1, ' pt')}
                <div className="field-row">
                  <label>Color</label>
                  <input type="color" value={sel.color} onChange={(e) => patchEl(sel.id, { color: e.target.value })} />
                  <div className="seg-group" style={{ marginLeft: 'auto' }}>
                    {(['L', 'C', 'R'] as const).map((a) => (
                      <button key={a} className={'seg-btn' + (sel.align === a ? ' active' : '')} onClick={() => patchEl(sel.id, { align: a })}>
                        {a === 'L' ? '⟸' : a === 'C' ? '≡' : '⟹'}
                      </button>
                    ))}
                  </div>
                </div>
                {num('Tracking', 'letterSpacing', 0, 12, 0.5, ' pt')}
                {num('Line height', 'lineHeight', 0.8, 2, 0.05)}
                <div className="field-row">
                  <label>Style</label>
                  <div className="seg-group">
                    <button className={'seg-btn' + (sel.bold ? ' active' : '')} onClick={() => patchEl(sel.id, { bold: !sel.bold })}>
                      <b>B</b>
                    </button>
                    <button className={'seg-btn' + (sel.italic ? ' active' : '')} onClick={() => patchEl(sel.id, { italic: !sel.italic })}>
                      <i>I</i>
                    </button>
                    <button
                      className={'seg-btn' + (sel.uppercase ? ' active' : '')}
                      onClick={() => patchEl(sel.id, { uppercase: !sel.uppercase })}
                    >
                      AA
                    </button>
                  </div>
                </div>
              </>
            )}
            {sel.type === 'image' && (
              <>
                <div className="field-row">
                  <label>Image</label>
                  <select className="select-input grow" value={sel.image} onChange={(e) => patchEl(sel.id, { image: e.target.value })}>
                    <option value="">Choose…</option>
                    {images.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-sm" onClick={() => void uploadImages().then((a) => a[0] && patchEl(sel.id, { image: a[0] }))}>
                    Upload…
                  </button>
                </div>
                <div className="field-row">
                  <label>Fit</label>
                  <div className="seg-group">
                    <button className={'seg-btn' + (sel.fit === 'cover' ? ' active' : '')} onClick={() => patchEl(sel.id, { fit: 'cover' })}>
                      Fill
                    </button>
                    <button className={'seg-btn' + (sel.fit === 'contain' ? ' active' : '')} onClick={() => patchEl(sel.id, { fit: 'contain' })}>
                      Fit
                    </button>
                  </div>
                </div>
              </>
            )}
            {sel.type === 'rect' && (
              <>
                <div className="field-row">
                  <label>Fill</label>
                  <input type="color" value={sel.fill} onChange={(e) => patchEl(sel.id, { fill: e.target.value })} />
                </div>
                {num('Corner radius', 'radius', 0, 50, 1, '%')}
              </>
            )}
            {num('Opacity', 'opacity', 0.05, 1, 0.05)}
            {num('Rotation', 'rotation', -180, 180, 1, '°')}
            <div className="field-row">
              <button className="btn btn-sm btn-danger" onClick={() => removeElement(sel.id)}>
                Delete element
              </button>
            </div>
          </div>
        )}

        <div className="panel-section">
          <div className="panel-title">Layers</div>
          {elements.length === 0 && <div className="empty-hint">Add text, images or shapes from the toolbar above the cover.</div>}
          {[...elements].reverse().map((el) => (
            <button
              key={el.id}
              className={'card-item' + (el.id === selectedId ? ' active' : '')}
              style={{ padding: '5px 8px' }}
              onClick={() => setSelectedId(el.id)}
              onContextMenu={(e) => elementMenu(e, el)}
            >
              <span className="card-item-title" style={{ fontFamily: 'var(--ui)', fontSize: 12.5 }}>
                {el.type === 'text' ? `T · ${el.text.slice(0, 26) || 'empty'}` : el.type === 'image' ? `▣ · ${el.image || 'image'}` : '■ · shape'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="stage" style={{ paddingTop: 16 }}>
        <div className="cover-toolbar">
          <button className="btn btn-sm" onClick={() => addElement(newCoverElement('text'))}>
            + Text
          </button>
          <button
            className="btn btn-sm"
            onClick={() => {
              const el = newCoverElement('image');
              if (images[0]) el.image = images[0];
              addElement(el);
            }}
          >
            + Image
          </button>
          <button className="btn btn-sm" onClick={() => addElement(newCoverElement('rect'))}>
            + Shape
          </button>
          <button
            className="btn btn-sm"
            onClick={() =>
              void uploadImages().then((a) => {
                if (a[0]) {
                  const el = newCoverElement('image');
                  el.image = a[0];
                  addElement(el);
                }
              })
            }
          >
            ⬆ Upload image…
          </button>
          <span className="preview-meta" style={{ margin: '0 0 0 12px' }}>
            Front cover — {PAGE_SIZES[s.pageSize]?.label ?? s.pageSize}
          </span>
        </div>
        <CoverCanvas
          cover={{ ...c, elements }}
          pageSize={s.pageSize}
          width={W}
          interactive={{
            selectedId,
            onSelect: setSelectedId,
            onPatch: patchEl,
            onElementMenu: elementMenu,
            onBgMenu: bgMenu,
          }}
        />
      </div>
    </div>
  );
}
