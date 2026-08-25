export interface Chapter {
  id: string;
  title: string;
  file: string;
  kind?: 'text' | 'image';
  image?: string;
  fit?: 'cover' | 'contain';
  unnumbered?: boolean;
}

export function isImagePage(c: Chapter): boolean {
  return c.kind === 'image';
}

// chapterNumbers assigns the printed chapter number to each numbered text
// chapter; image pages and unnumbered chapters (prologue, epilogue…) get none.
export function chapterNumbers(chapters: Chapter[]): Map<string, number> {
  const out = new Map<string, number>();
  let n = 0;
  for (const c of chapters) {
    if (!isImagePage(c) && !c.unnumbered) {
      n++;
      out.set(c.id, n);
    }
  }
  return out;
}

export interface Styles {
  pageSize: string;
  marginTop: number;
  marginBottom: number;
  marginInner: number;
  marginOuter: number;
  bodyFont: string;
  headingFont: string;
  bodySize: number;
  lineHeight: number;
  paragraphStyle: string;
  justify: boolean;
  hyphenate: boolean;
  columns: number;
  columnGap: number;
  showPageNumbers: boolean;
  showHeader: boolean;
  dropCaps: boolean;
  textColor: string;
  headingColor: string;
  accentColor: string;
  pageColor: string;
  tocEnabled: boolean;
  titlePageEnabled: boolean;
  chapterNumbering: boolean;
  chapterLabel: string;
  tocTitle: string;
  paper?: string;
  kdpManual?: boolean;
}

export interface CoverText {
  text: string;
  font: string;
  size: number;
  color: string;
  y: number;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  letterSpacing: number;
}

export interface CoverElement {
  id: string;
  type: 'text' | 'image' | 'rect';
  x: number; // percent of cover width
  y: number; // percent of cover height
  w: number; // percent of cover width
  h: number; // percent of cover height (0 = auto for text)
  rotation: number;
  opacity: number;
  // text
  text: string;
  font: string; // serif | sans | mono | system family name
  fontPath: string;
  size: number; // pt
  color: string;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  letterSpacing: number; // pt
  align: 'L' | 'C' | 'R';
  lineHeight: number;
  // image
  image: string;
  fit: 'cover' | 'contain';
  // rect
  fill: string;
  radius: number;
}

export interface Cover {
  bgColor: string;
  bgColor2: string;
  gradientOn: boolean;
  bgImage: string;
  overlay: number;
  title: CoverText;
  subtitle: CoverText;
  author: CoverText;
  borderFrame: boolean;
  frameColor: string;
  elements: CoverElement[];
}

export interface SystemFont {
  name: string;
  path: string;
}

export function newCoverElement(type: CoverElement['type']): CoverElement {
  return {
    id: crypto.randomUUID(),
    type,
    x: type === 'rect' ? 20 : 10,
    y: 40,
    w: type === 'text' ? 80 : 40,
    h: type === 'text' ? 0 : 25,
    rotation: 0,
    opacity: 1,
    text: type === 'text' ? 'New text' : '',
    font: 'serif',
    fontPath: '',
    size: 18,
    color: '#f5f1e6',
    bold: false,
    italic: false,
    uppercase: false,
    letterSpacing: 0,
    align: 'C',
    lineHeight: 1.2,
    image: '',
    fit: 'cover',
    fill: '#f5f1e6',
    radius: 0,
  };
}

// coverElements returns the cover's element list, migrating the three fixed
// text slots of older projects into freeform elements.
export function coverElements(cover: Cover): CoverElement[] {
  if (cover.elements && cover.elements.length > 0) return cover.elements;
  const out: CoverElement[] = [];
  const fromText = (t: CoverText): CoverElement => ({
    ...newCoverElement('text'),
    x: 8,
    w: 84,
    y: t.y,
    text: t.text,
    font: t.font,
    size: t.size,
    color: t.color,
    bold: t.bold,
    italic: t.italic,
    uppercase: t.uppercase,
    letterSpacing: t.letterSpacing,
  });
  for (const t of [cover.title, cover.subtitle, cover.author]) {
    if (t && t.text.trim()) out.push(fromText(t));
  }
  return out;
}

export interface Book {
  title: string;
  subtitle: string;
  author: string;
  language: string;
  description: string;
  chapters: Chapter[];
  styles: Styles;
  cover: Cover;
}

export interface RecentProject {
  path: string;
  title: string;
  openedAt: number;
}

export type ViewName = 'write' | 'bible' | 'design' | 'cover' | 'preview';

// ---------- story bible ----------

export interface Relationship {
  withId: string;
  label: string; // "sister", "rival", "love interest", …
}

export interface Character {
  id: string;
  name: string;
  role: string; // protagonist | love-interest | antagonist | mentor | ally | rival | supporting | minor
  age: string;
  pronouns: string;
  occupation: string;
  appearance: string;
  personality: string;
  motivation: string; // what they want
  wound: string; // what holds them back / inner conflict
  secret: string;
  arc: string; // how they change
  backstory: string;
  voice: string; // how they speak
  portrait: string; // image name in the project library
  relationships: Relationship[];
  notes: string;
}

export interface Location {
  id: string;
  name: string;
  kind: string; // city, house, planet, café…
  description: string;
  significance: string; // why it matters to the story
  image: string;
  notes: string;
}

export interface PlotThread {
  id: string;
  title: string;
  kind: string; // main | romance | subplot | mystery | backstory
  premise: string;
  stakes: string;
  resolution: string;
  status: string; // planned | active | resolved
}

export interface TimelineEvent {
  id: string;
  when: string; // free text: "Day 1", "Spring 1913", "Ch. 4"
  title: string;
  description: string;
}

export interface NoteCard {
  id: string;
  category: string; // research | worldbuilding | idea | reminder
  title: string;
  content: string;
}

export interface StyleRule {
  id: string;
  term: string; // spelling, name, hyphenation choice
  rule: string; // how it is written, and why
}

export interface OutlineEntry {
  synopsis: string;
  pov: string; // character id or free text
  status: string; // idea | draft | revising | done
  targetWords: number;
}

export interface Bible {
  logline: string;
  synopsis: string;
  theme: string;
  genre: string;
  audience: string;
  targetWords: number;
  characters: Character[];
  locations: Location[];
  threads: PlotThread[];
  timeline: TimelineEvent[];
  notes: NoteCard[];
  styleSheet: StyleRule[];
  outline: Record<string, OutlineEntry>;
}

export function defaultBible(): Bible {
  return {
    logline: '',
    synopsis: '',
    theme: '',
    genre: '',
    audience: '',
    targetWords: 0,
    characters: [],
    locations: [],
    threads: [],
    timeline: [],
    notes: [],
    styleSheet: [],
    outline: {},
  };
}

export function defaultCharacter(): Character {
  return {
    id: crypto.randomUUID(),
    name: 'New character',
    role: 'supporting',
    age: '',
    pronouns: '',
    occupation: '',
    appearance: '',
    personality: '',
    motivation: '',
    wound: '',
    secret: '',
    arc: '',
    backstory: '',
    voice: '',
    portrait: '',
    relationships: [],
    notes: '',
  };
}

export const CHARACTER_ROLES: [string, string][] = [
  ['protagonist', 'Protagonist'],
  ['love-interest', 'Love interest'],
  ['antagonist', 'Antagonist'],
  ['mentor', 'Mentor'],
  ['ally', 'Ally'],
  ['rival', 'Rival'],
  ['supporting', 'Supporting'],
  ['minor', 'Minor'],
];

export const THREAD_KINDS: [string, string][] = [
  ['main', 'Main plot'],
  ['romance', 'Romance'],
  ['subplot', 'Subplot'],
  ['mystery', 'Mystery'],
  ['backstory', 'Backstory'],
];

export const CHAPTER_STATUSES: [string, string][] = [
  ['idea', 'Idea'],
  ['draft', 'Draft'],
  ['revising', 'Revising'],
  ['done', 'Done'],
];

// Page sizes in millimeters; keep in sync with the Go side.
// group 'kdp' entries are the trim sizes Amazon KDP accepts for paperbacks.
export const PAGE_SIZES: Record<string, { w: number; h: number; label: string; group: 'standard' | 'kdp' }> = {
  Trade: { w: 152.4, h: 228.6, label: 'Trade 6×9″ (KDP)', group: 'standard' },
  Digest: { w: 139.7, h: 215.9, label: 'Digest 5.5×8.5″ (KDP)', group: 'standard' },
  A5: { w: 148, h: 210, label: 'A5', group: 'standard' },
  A4: { w: 210, h: 297, label: 'A4', group: 'standard' },
  Letter: { w: 215.9, h: 279.4, label: 'US Letter 8.5×11″ (KDP)', group: 'standard' },
  Magazine: { w: 209.55, h: 273.05, label: 'Magazine 8.25×10.75″', group: 'standard' },
  Square: { w: 210, h: 210, label: 'Square 210 mm', group: 'standard' },
  'KDP-5x8': { w: 127, h: 203.2, label: '5" x 8" (12.7 x 20.32 cm)', group: 'kdp' },
  'KDP-5.06x7.81': { w: 128.5, h: 198.4, label: '5.06" x 7.81" (12.85 x 19.84 cm)', group: 'kdp' },
  'KDP-5.25x8': { w: 133.35, h: 203.2, label: '5.25" x 8" (13.34 x 20.32 cm)', group: 'kdp' },
  'KDP-5.5x8.5': { w: 139.7, h: 215.9, label: '5.5" x 8.5" (13.97 x 21.59 cm)', group: 'kdp' },
  'KDP-6x9': { w: 152.4, h: 228.6, label: '6" x 9" (15.24 x 22.86 cm) — most common', group: 'kdp' },
  'KDP-6.14x9.21': { w: 156, h: 234, label: '6.14" x 9.21" (15.6 x 23.39 cm)', group: 'kdp' },
  'KDP-6.69x9.61': { w: 169.9, h: 244.1, label: '6.69" x 9.61" (16.99 x 24.41 cm)', group: 'kdp' },
  'KDP-7x10': { w: 177.8, h: 254, label: '7" x 10" (17.78 x 25.4 cm)', group: 'kdp' },
  'KDP-7.44x9.69': { w: 189, h: 246.1, label: '7.44" x 9.69" (18.9 x 24.61 cm)', group: 'kdp' },
  'KDP-7.5x9.25': { w: 190.5, h: 234.95, label: '7.5" x 9.25" (19.05 x 23.5 cm)', group: 'kdp' },
  'KDP-8x10': { w: 203.2, h: 254, label: '8" x 10" (20.32 x 25.4 cm)', group: 'kdp' },
  'KDP-8.25x6': { w: 209.55, h: 152.4, label: '8.25" x 6" (20.96 x 15.24 cm) — landscape', group: 'kdp' },
  'KDP-8.25x8.25': { w: 209.55, h: 209.55, label: '8.25" x 8.25" (20.96 x 20.96 cm) — square', group: 'kdp' },
  'KDP-8.27x11.69': { w: 210.1, h: 296.9, label: '8.27" x 11.69" (21.01 x 29.69 cm) — A4', group: 'kdp' },
  'KDP-8.5x8.5': { w: 215.9, h: 215.9, label: '8.5" x 8.5" (21.59 x 21.59 cm) — square', group: 'kdp' },
  'KDP-8.5x11': { w: 215.9, h: 279.4, label: '8.5" x 11" (21.59 x 27.94 cm)', group: 'kdp' },
};

// KDP paper/ink types with their allowed page counts.
export const KDP_PAPERS: [string, string, number, number][] = [
  // key, label, min pages, max pages
  ['white', 'Black ink, white paper', 24, 828],
  ['cream', 'Black ink, cream paper', 24, 776],
  ['color-standard', 'Standard color, white paper', 72, 600],
  ['color-premium', 'Premium color, white paper', 24, 828],
];

// isKdpTrim: sizes Amazon KDP accepts (KDP-* plus the standard aliases).
export function isKdpTrim(name: string): boolean {
  return name.startsWith('KDP-') || name === 'Trade' || name === 'Digest' || name === 'Letter';
}

export const MM_TO_PX = 96 / 25.4;

// Localized labels for generated book matter; keep in sync with the Go side.
export const BOOK_LANGUAGES: [string, string][] = [
  ['en', 'English'],
  ['it', 'Italiano'],
  ['fr', 'Français'],
  ['es', 'Español'],
  ['pt', 'Português'],
  ['de', 'Deutsch'],
];

export function locTOC(lang: string): string {
  const l = (lang || '').slice(0, 2).toLowerCase();
  return (
    { it: 'Indice', fr: 'Table des matières', es: 'Índice', pt: 'Índice', de: 'Inhalt' }[l] ?? 'Contents'
  );
}

export function locChapter(lang: string): string {
  const l = (lang || '').slice(0, 2).toLowerCase();
  return { it: 'Capitolo', fr: 'Chapitre', es: 'Capítulo', pt: 'Capítulo', de: 'Kapitel' }[l] ?? 'Chapter';
}

// Effective labels: the user's custom text wins over the language default.
export function chapterLabelFor(book: Book): string {
  return book.styles.chapterLabel?.trim() || locChapter(book.language);
}

export function tocTitleFor(book: Book): string {
  return book.styles.tocTitle?.trim() || locTOC(book.language);
}

export function fontStack(name: string): string {
  switch (name) {
    case 'sans':
      return "'Helvetica Neue', Arial, sans-serif";
    case 'mono':
      return "'Courier New', monospace";
    default:
      return "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
  }
}
