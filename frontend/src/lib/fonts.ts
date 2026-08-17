import { sysFontURL } from '../api';
import { fontStack } from '../types';
import type { CoverElement } from '../types';

const loaded = new Set<string>();

// ensureFontLoaded registers a system font face with the document so DOM and
// canvas can render it. Safe to call repeatedly.
export async function ensureFontLoaded(family: string, path: string): Promise<void> {
  if (!path || loaded.has(family)) return;
  try {
    const face = new FontFace(family, `url("${sysFontURL(path)}")`);
    await face.load();
    document.fonts.add(face);
    loaded.add(family);
  } catch {
    // Missing or unreadable font: the generic stack takes over.
  }
}

// elementFontFamily returns the CSS font-family for a cover element.
export function elementFontFamily(el: CoverElement): string {
  if (el.fontPath) return `"${el.font}", ${fontStack('serif')}`;
  return fontStack(el.font);
}

// loadElementFonts loads every system font used by the given elements.
export async function loadElementFonts(elements: CoverElement[]): Promise<void> {
  await Promise.all(
    elements.filter((e) => e.type === 'text' && e.fontPath).map((e) => ensureFontLoaded(e.font, e.fontPath))
  );
}
