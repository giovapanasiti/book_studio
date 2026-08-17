import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { imageURL } from '../api';

interface Props {
  name: string;
  onSave: (dataURL: string) => void;
  onClose: () => void;
}

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function ImageEditor({ name, onSave, onClose }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [rot, setRot] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [sepia, setSepia] = useState(0);
  const [scalePct, setScalePct] = useState(100);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [dragRect, setDragRect] = useState<CropRect | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const im = new Image();
    im.onload = () => setImg(im);
    im.src = imageURL(name);
  }, [name]);

  // Draw the transformed + filtered image (before crop) onto a canvas.
  const drawBase = useCallback(
    (target: HTMLCanvasElement) => {
      if (!img) return;
      const rad = (rot * Math.PI) / 180;
      const swap = rot % 180 !== 0;
      const w = swap ? img.naturalHeight : img.naturalWidth;
      const h = swap ? img.naturalWidth : img.naturalHeight;
      target.width = w;
      target.height = h;
      const ctx = target.getContext('2d')!;
      ctx.save();
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) grayscale(${grayscale}%) sepia(${sepia}%)`;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rad);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();
      // Dim everything outside the crop.
      if (crop) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.rect(crop.x, crop.y, crop.w, crop.h);
        ctx.fill('evenodd');
        ctx.strokeStyle = '#c8a24b';
        ctx.lineWidth = Math.max(2, w / 400);
        ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
        ctx.restore();
      }
    },
    [img, rot, flipH, flipV, brightness, contrast, saturate, grayscale, sepia, crop]
  );

  useEffect(() => {
    if (canvasRef.current) drawBase(canvasRef.current);
  }, [drawBase]);

  const canvasPoint = (e: React.MouseEvent): { x: number; y: number } => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * cv.width,
      y: ((e.clientY - r.top) / r.height) * cv.height,
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    dragStart.current = canvasPoint(e);
    setDragRect(null);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragStart.current) return;
    const p = canvasPoint(e);
    const s = dragStart.current;
    setDragRect({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  };
  const onMouseUp = (e: React.MouseEvent) => {
    if (dragStart.current && canvasRef.current) {
      const p = canvasPoint(e);
      const s = dragStart.current;
      const rect = {
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        w: Math.abs(p.x - s.x),
        h: Math.abs(p.y - s.y),
      };
      if (rect.w > 12 && rect.h > 12) {
        const cv = canvasRef.current;
        const x = Math.max(0, Math.round(rect.x));
        const y = Math.max(0, Math.round(rect.y));
        setCrop({
          x,
          y,
          w: Math.min(cv.width - x, Math.round(rect.w)),
          h: Math.min(cv.height - y, Math.round(rect.h)),
        });
      }
    }
    dragStart.current = null;
    setDragRect(null);
  };

  const save = () => {
    if (!img) return;
    const base = document.createElement('canvas');
    const noCrop = { ...{ x: 0, y: 0, w: 0, h: 0 } };
    // Redraw without the crop dimming.
    const savedCrop = crop;
    setCrop(null);
    void noCrop;
    // Draw synchronously with crop removed.
    const rad = (rot * Math.PI) / 180;
    const swap = rot % 180 !== 0;
    const w = swap ? img.naturalHeight : img.naturalWidth;
    const h = swap ? img.naturalWidth : img.naturalHeight;
    base.width = w;
    base.height = h;
    const ctx = base.getContext('2d')!;
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) grayscale(${grayscale}%) sepia(${sepia}%)`;
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rad);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    const region = savedCrop ?? { x: 0, y: 0, w, h };
    const scale = scalePct / 100;
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(region.w * scale));
    out.height = Math.max(1, Math.round(region.h * scale));
    const octx = out.getContext('2d')!;
    octx.drawImage(base, region.x, region.y, region.w, region.h, 0, 0, out.width, out.height);
    onSave(out.toDataURL('image/png'));
  };

  const slider = (label: string, val: number, set: (n: number) => void, min: number, max: number) => (
    <div className="field-row">
      <label style={{ flexBasis: 76 }}>{label}</label>
      <input type="range" min={min} max={max} value={val} onChange={(e) => set(Number(e.target.value))} />
      <span className="range-val">{val}</span>
    </div>
  );

  const outSize = (() => {
    if (!img) return '';
    const swap = rot % 180 !== 0;
    const w = crop ? crop.w : swap ? img.naturalHeight : img.naturalWidth;
    const h = crop ? crop.h : swap ? img.naturalWidth : img.naturalHeight;
    return `${Math.round((w * scalePct) / 100)} × ${Math.round((h * scalePct) / 100)} px`;
  })();

  return (
    <Modal
      title={`Edit image — ${name}`}
      onClose={onClose}
      wide
      footer={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--faint)', fontSize: 12 }}>
            Saves as a new PNG · {outSize}
          </span>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!img} onClick={save}>
            Save copy
          </button>
        </>
      }
    >
      <div className="imged-layout">
        <div
          className="imged-stage"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {!img && <div className="empty-hint">Loading image…</div>}
          <canvas ref={canvasRef} style={{ cursor: 'crosshair' }} />
          {dragRect && canvasRef.current && (
            <DragOverlay rect={dragRect} canvas={canvasRef.current} />
          )}
        </div>
        <div className="imged-controls">
          <div className="panel-title">Transform</div>
          <div className="imged-row">
            <button className="btn btn-sm" onClick={() => { setRot((r) => (r + 270) % 360); setCrop(null); }}>⟲ Rotate</button>
            <button className="btn btn-sm" onClick={() => { setRot((r) => (r + 90) % 360); setCrop(null); }}>⟳ Rotate</button>
            <button className="btn btn-sm" onClick={() => setFlipH((v) => !v)}>⇋ Flip</button>
            <button className="btn btn-sm" onClick={() => setFlipV((v) => !v)}>⇵ Flip</button>
          </div>
          <div className="panel-title" style={{ marginTop: 16 }}>Adjust</div>
          {slider('Brightness', brightness, setBrightness, 30, 180)}
          {slider('Contrast', contrast, setContrast, 30, 180)}
          {slider('Saturation', saturate, setSaturate, 0, 200)}
          {slider('Grayscale', grayscale, setGrayscale, 0, 100)}
          {slider('Sepia', sepia, setSepia, 0, 100)}
          <div className="panel-title" style={{ marginTop: 16 }}>Crop &amp; size</div>
          <p className="empty-hint" style={{ textAlign: 'left', padding: '0 0 8px' }}>
            Drag on the image to select a crop.
          </p>
          {crop && (
            <button className="btn btn-sm" style={{ marginBottom: 8 }} onClick={() => setCrop(null)}>
              Clear crop
            </button>
          )}
          {slider('Scale %', scalePct, setScalePct, 10, 100)}
          <div className="imged-row" style={{ marginTop: 10 }}>
            <button
              className="btn btn-sm"
              onClick={() => {
                setRot(0); setFlipH(false); setFlipV(false);
                setBrightness(100); setContrast(100); setSaturate(100);
                setGrayscale(0); setSepia(0); setCrop(null); setScalePct(100);
              }}
            >
              Reset all
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function DragOverlay({ rect, canvas }: { rect: CropRect; canvas: HTMLCanvasElement }) {
  const r = canvas.getBoundingClientRect();
  const parent = canvas.parentElement!.getBoundingClientRect();
  const sx = r.width / canvas.width;
  const sy = r.height / canvas.height;
  return (
    <div
      className="crop-rect"
      style={{
        left: r.left - parent.left + rect.x * sx,
        top: r.top - parent.top + rect.y * sy,
        width: rect.w * sx,
        height: rect.h * sy,
      }}
    />
  );
}
