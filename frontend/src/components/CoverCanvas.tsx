import { useEffect, useRef } from 'react';
import type { Cover, CoverElement } from '../types';
import { PAGE_SIZES, coverElements } from '../types';
import { imageURLStable } from '../api';
import { elementFontFamily, loadElementFonts } from '../lib/fonts';

const PT_TO_MM = 0.352778;

export interface CoverInteractive {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPatch: (id: string, patch: Partial<CoverElement>) => void;
  onElementMenu: (e: React.MouseEvent, el: CoverElement) => void;
  onBgMenu: (e: React.MouseEvent) => void;
}

interface Props {
  cover: Cover;
  pageSize: string;
  width: number; // display width in px
  interactive?: CoverInteractive;
}

export function CoverCanvas({ cover, pageSize, width, interactive }: Props) {
  const size = PAGE_SIZES[pageSize] ?? PAGE_SIZES.Trade;
  const H = width * (size.h / size.w);
  const pxPerMm = width / size.w;
  const elements = coverElements(cover);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadElementFonts(elements);
  }, [elements]);

  const startDrag = (el: CoverElement) => (e: React.MouseEvent) => {
    if (!interactive) return;
    e.preventDefault();
    e.stopPropagation();
    interactive.onSelect(el.id);
    const rect = rootRef.current!.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = el.x;
    const oy = el.y;
    const move = (ev: MouseEvent) => {
      const dx = ((ev.clientX - sx) / rect.width) * 100;
      const dy = ((ev.clientY - sy) / rect.height) * 100;
      interactive.onPatch(el.id, {
        x: Math.round((ox + dx) * 10) / 10,
        y: Math.round((oy + dy) * 10) / 10,
      });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const startResize = (el: CoverElement) => (e: React.MouseEvent) => {
    if (!interactive) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = rootRef.current!.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const ow = el.w;
    const oh = el.h;
    const move = (ev: MouseEvent) => {
      const dw = ((ev.clientX - sx) / rect.width) * 100;
      const dh = ((ev.clientY - sy) / rect.height) * 100;
      const patch: Partial<CoverElement> = { w: Math.max(4, Math.round((ow + dw) * 10) / 10) };
      if (el.type !== 'text') patch.h = Math.max(3, Math.round((oh + dh) * 10) / 10);
      interactive.onPatch(el.id, patch);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div
      ref={rootRef}
      className="cover-canvas"
      style={{
        width,
        height: H,
        background: cover.gradientOn && !cover.bgImage
          ? `linear-gradient(180deg, ${cover.bgColor}, ${cover.bgColor2})`
          : cover.bgColor,
        cursor: interactive ? 'default' : undefined,
      }}
      onMouseDown={(e) => {
        if (interactive && e.target === e.currentTarget) interactive.onSelect(null);
      }}
      onContextMenu={(e) => {
        if (interactive && e.target === e.currentTarget) interactive.onBgMenu(e);
      }}
    >
      {cover.bgImage && <img className="bg-img" src={imageURLStable(cover.bgImage)} alt="" draggable={false} />}
      {cover.bgImage && cover.overlay > 0 && <div className="overlay" style={{ opacity: cover.overlay }} />}
      {cover.borderFrame && <div className="frame" style={{ borderColor: cover.frameColor, inset: width * 0.033 }} />}

      {elements.map((el) => {
        const style: React.CSSProperties = {
          position: 'absolute',
          left: el.x + '%',
          top: el.y + '%',
          width: el.w + '%',
          height: el.type === 'text' ? 'auto' : el.h + '%',
          opacity: el.opacity,
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          transformOrigin: el.type === 'text' ? '50% 0' : '50% 50%',
        };
        const selected = interactive?.selectedId === el.id;
        return (
          <div
            key={el.id}
            className={'cover-el' + (selected ? ' selected' : '') + (interactive ? ' editable' : '')}
            style={style}
            onMouseDown={startDrag(el)}
            onContextMenu={(e) => interactive?.onElementMenu(e, el)}
          >
            {el.type === 'text' && (
              <div
                style={{
                  fontFamily: elementFontFamily(el),
                  fontSize: el.size * PT_TO_MM * pxPerMm,
                  color: el.color,
                  fontWeight: el.bold ? 700 : 400,
                  fontStyle: el.italic ? 'italic' : 'normal',
                  textTransform: el.uppercase ? 'uppercase' : 'none',
                  letterSpacing: el.letterSpacing * PT_TO_MM * pxPerMm + 'px',
                  textAlign: el.align === 'L' ? 'left' : el.align === 'R' ? 'right' : 'center',
                  lineHeight: el.lineHeight,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {el.text}
              </div>
            )}
            {el.type === 'image' &&
              (el.image ? (
                <img
                  src={imageURLStable(el.image)}
                  alt=""
                  draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: el.fit, display: 'block' }}
                />
              ) : (
                <div className="cover-el-placeholder">image</div>
              ))}
            {el.type === 'rect' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: el.fill,
                  borderRadius: `${el.radius}%`,
                }}
              />
            )}
            {selected && interactive && <div className="resize-handle" onMouseDown={startResize(el)} />}
          </div>
        );
      })}
    </div>
  );
}
