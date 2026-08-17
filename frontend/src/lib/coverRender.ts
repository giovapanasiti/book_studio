// Rasterizes the cover design to a PNG. The result is stored in the project
// as cover.png and used verbatim by the PDF and ePub exports, so the exported
// cover is exactly what the editor shows — system fonts included.

import type { Cover, CoverElement } from '../types';
import { PAGE_SIZES, fontStack } from '../types';
import { coverElements } from '../types';
import { imageURLStable } from '../api';
import { loadElementFonts } from './fonts';

const PT_TO_MM = 0.352778;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

function drawCoverFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  fit: 'cover' | 'contain'
) {
  const scale = fit === 'cover'
    ? Math.max(w / img.naturalWidth, h / img.naturalHeight)
    : Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

interface TextLine {
  text: string;
  width: number;
}

function measure(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  const base = ctx.measureText(text).width;
  return base + spacing * Math.max(0, [...text].length - 1);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, spacing: number): TextLine[] {
  const lines: TextLine[] = [];
  for (const hard of text.split('\n')) {
    const words = hard.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push({ text: '', width: 0 });
      continue;
    }
    let cur = '';
    for (const word of words) {
      const attempt = cur ? cur + ' ' + word : word;
      if (cur && measure(ctx, attempt, spacing) > maxW) {
        lines.push({ text: cur, width: measure(ctx, cur, spacing) });
        cur = word;
      } else {
        cur = attempt;
      }
    }
    if (cur) lines.push({ text: cur, width: measure(ctx, cur, spacing) });
  }
  return lines;
}

function drawSpacedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  if (spacing <= 0) {
    ctx.fillText(text, x, y);
    return;
  }
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

// renderCover draws the whole cover and returns a PNG data URL.
// widthPx controls output resolution; ~1800 gives ~300 dpi on a 6in cover.
export async function renderCover(cover: Cover, pageSize: string, widthPx = 1800): Promise<string> {
  const size = PAGE_SIZES[pageSize] ?? PAGE_SIZES.Trade;
  const W = widthPx;
  const H = Math.round(widthPx * (size.h / size.w));
  const pxPerMm = W / size.w;
  const elements = coverElements(cover);

  await loadElementFonts(elements);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background.
  if (cover.gradientOn && !cover.bgImage) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, cover.bgColor);
    g.addColorStop(1, cover.bgColor2);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = cover.bgColor;
  }
  ctx.fillRect(0, 0, W, H);

  if (cover.bgImage) {
    const img = await loadImage(imageURLStable(cover.bgImage));
    if (img) {
      drawCoverFit(ctx, img, 0, 0, W, H, 'cover');
      if (cover.overlay > 0) {
        ctx.fillStyle = `rgba(0,0,0,${cover.overlay})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  if (cover.borderFrame) {
    ctx.strokeStyle = cover.frameColor;
    ctx.lineWidth = Math.max(2, W / 300);
    const inset = W * 0.033;
    ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  }

  // Elements, in order (first = back).
  for (const el of elements) {
    const x = (el.x / 100) * W;
    const y = (el.y / 100) * H;
    const w = (el.w / 100) * W;
    const h = (el.h / 100) * H;
    ctx.save();
    ctx.globalAlpha = el.opacity;
    if (el.rotation) {
      const cx = x + w / 2;
      const cy = y + (el.type === 'text' ? 0 : h / 2);
      ctx.translate(cx, cy);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    if (el.type === 'rect') {
      ctx.fillStyle = el.fill;
      const r = (el.radius / 100) * Math.min(w, h);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    } else if (el.type === 'image' && el.image) {
      const img = await loadImage(imageURLStable(el.image));
      if (img) drawCoverFit(ctx, img, x, y, w, h, el.fit);
    } else if (el.type === 'text' && el.text.trim()) {
      const px = el.size * PT_TO_MM * pxPerMm;
      const spacing = el.letterSpacing * PT_TO_MM * pxPerMm;
      const family = el.fontPath ? `"${el.font}"` : fontStack(el.font);
      ctx.font = `${el.italic ? 'italic ' : ''}${el.bold ? '700 ' : '400 '}${px}px ${family}`;
      ctx.fillStyle = el.color;
      ctx.textBaseline = 'alphabetic';
      const content = el.uppercase ? el.text.toUpperCase() : el.text;
      const lines = wrapText(ctx, content, w, spacing);
      const lineH = px * el.lineHeight;
      let ty = y + px * 0.85;
      for (const line of lines) {
        let tx = x;
        if (el.align === 'C') tx = x + (w - line.width) / 2;
        else if (el.align === 'R') tx = x + w - line.width;
        drawSpacedText(ctx, line.text, tx, ty, spacing);
        ty += lineH;
      }
    }
    ctx.restore();
  }

  return canvas.toDataURL('image/png');
}
