// Amazon KDP paperback requirements (no-bleed interiors), used by the
// PDF settings page to check and apply print-safe margins.
//
// Source: KDP "Set trim size, bleed, and margins" specifications.

import type { Styles } from '../types';
import { isKdpTrim } from '../types';

const IN = 25.4; // mm

// requiredGutterMM returns the minimum inside (gutter) margin for a page count.
export function requiredGutterMM(pages: number): number {
  if (pages <= 150) return 0.375 * IN;
  if (pages <= 300) return 0.5 * IN;
  if (pages <= 500) return 0.625 * IN;
  if (pages <= 700) return 0.75 * IN;
  return 0.875 * IN; // up to KDP's 828-page maximum
}

export const MIN_OUTSIDE_MM = 0.25 * IN; // outside, top and bottom, no bleed
export const MAX_KDP_PAGES = 828;

export interface KdpIssue {
  ok: boolean;
  text: string;
}

// checkKdp evaluates the current styles against KDP's rules.
// Running headers and folios are printed inside the top/bottom margin, so
// those margins need extra room to keep them out of Amazon's danger zone.
export function checkKdp(styles: Styles, pages: number): KdpIssue[] {
  const gutter = requiredGutterMM(pages);
  const topMin = styles.showHeader ? MIN_OUTSIDE_MM + 9 : MIN_OUTSIDE_MM;
  const botMin = styles.showPageNumbers ? MIN_OUTSIDE_MM + 9 : MIN_OUTSIDE_MM;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return [
    {
      ok: isKdpTrim(styles.pageSize),
      text: isKdpTrim(styles.pageSize)
        ? 'Trim size is a KDP size'
        : 'The page size is not one of the KDP trim sizes',
    },
    {
      ok: pages <= MAX_KDP_PAGES,
      text: pages <= MAX_KDP_PAGES ? `${pages} pages (KDP allows up to ${MAX_KDP_PAGES})` : `${pages} pages — over KDP's ${MAX_KDP_PAGES}-page maximum`,
    },
    {
      ok: styles.marginInner >= gutter - 0.05,
      text: `Inside margin ${r1(styles.marginInner)} mm (needs ≥ ${r1(gutter)} mm at ${pages} pages)`,
    },
    {
      ok: styles.marginOuter >= MIN_OUTSIDE_MM - 0.05,
      text: `Outside margin ${r1(styles.marginOuter)} mm (needs ≥ ${r1(MIN_OUTSIDE_MM)} mm)`,
    },
    {
      ok: styles.marginTop >= topMin - 0.05,
      text: `Top margin ${r1(styles.marginTop)} mm (needs ≥ ${r1(topMin)} mm${styles.showHeader ? ' with the running header' : ''})`,
    },
    {
      ok: styles.marginBottom >= botMin - 0.05,
      text: `Bottom margin ${r1(styles.marginBottom)} mm (needs ≥ ${r1(botMin)} mm${styles.showPageNumbers ? ' with page numbers' : ''})`,
    },
  ];
}

// kdpMargins returns margins that satisfy the rules, keeping the current
// values when they are already generous enough.
export function kdpMargins(styles: Styles, pages: number): Partial<Styles> {
  const gutter = requiredGutterMM(pages);
  const topMin = styles.showHeader ? MIN_OUTSIDE_MM + 9 : MIN_OUTSIDE_MM;
  const botMin = styles.showPageNumbers ? MIN_OUTSIDE_MM + 9 : MIN_OUTSIDE_MM;
  const up = (v: number, min: number) => Math.max(v, Math.ceil(min * 2) / 2);
  return {
    marginInner: up(styles.marginInner, gutter),
    marginOuter: up(styles.marginOuter, MIN_OUTSIDE_MM),
    marginTop: up(styles.marginTop, topMin),
    marginBottom: up(styles.marginBottom, botMin),
  };
}
