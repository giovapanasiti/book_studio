// Matches the app chrome to the desktop theme. On Omarchy the backend exposes
// the active theme palette; this module maps it onto the app's CSS tokens and
// follows theme switches live. On other systems the built-in look stays.

import * as App from '../../wailsjs/go/main/App';

interface SystemTheme {
  found: boolean;
  stamp: number;
  colors: Record<string, string>;
}

function hexToRGB(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

function mix(a: string, b: string, t: number): string {
  const ca = hexToRGB(a);
  const cb = hexToRGB(b);
  if (!ca || !cb) return a;
  return toHex(ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t);
}

function lighten(hex: string, t: number): string {
  return mix(hex, '#ffffff', t);
}

function alpha(hex: string, a: number): string {
  const c = hexToRGB(hex);
  if (!c) return hex;
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

const THEMED_PROPS = [
  '--ink-950', '--ink-900', '--ink-850', '--ink-800', '--ink-750', '--ink-700',
  '--line', '--text', '--muted', '--faint',
  '--brass', '--brass-bright', '--brass-dim', '--danger', '--ok',
];

function applyPalette(c: Record<string, string>) {
  const root = document.documentElement;
  const bg = c.background;
  const lighter = c.lighter_background ?? bg;
  if (!bg || !c.foreground || !c.accent) return;

  const set = (k: string, v: string) => root.style.setProperty(k, v);
  set('--ink-950', c.dark_background ?? mix(bg, '#000000', 0.25));
  set('--ink-900', bg);
  set('--ink-850', mix(bg, lighter, 0.4));
  set('--ink-800', lighter);
  set('--ink-750', lighten(lighter, 0.05));
  set('--ink-700', c.selection ?? lighten(lighter, 0.1));
  set('--line', mix(bg, lighter, 0.7));
  set('--text', c.foreground);
  set('--muted', c.dark_foreground ?? mix(c.foreground, bg, 0.4));
  set('--faint', c.muted ?? mix(c.foreground, bg, 0.55));
  set('--brass', c.accent);
  set('--brass-bright', lighten(c.accent, 0.15));
  set('--brass-dim', alpha(c.accent, 0.14));
  if (c.red) set('--danger', c.red);
  if (c.green) set('--ok', c.green);
  root.style.colorScheme = c.mode === 'light' ? 'light' : 'dark';
}

function clearPalette() {
  const root = document.documentElement;
  for (const p of THEMED_PROPS) root.style.removeProperty(p);
  root.style.removeProperty('color-scheme');
}

let lastStamp = -1;

async function sync() {
  try {
    const theme: SystemTheme = JSON.parse(await App.GetSystemTheme());
    if (!theme.found) {
      if (lastStamp !== 0) clearPalette();
      lastStamp = 0;
      return;
    }
    if (theme.stamp === lastStamp) return;
    lastStamp = theme.stamp;
    applyPalette(theme.colors);
  } catch {
    // Backend not ready or unavailable: keep the built-in look.
  }
}

// startSystemThemeSync applies the desktop palette and follows changes.
export function startSystemThemeSync() {
  void sync();
  window.setInterval(() => void sync(), 4000);
}
