/**
 * The books page: each book as an object. Its colours are read from the cover with sharp at
 * build time (the ground of the spine and back is the cover's colour at the bound edge, which
 * is the right edge for an Arabic book), its text is split into paragraphs that know their
 * own language, and its back cover carries a blurb and a barcode drawn from the ISBN.
 */
import path from 'node:path';
import sharp from 'sharp';
import raw from '../data/books.json';
import type { Book } from './books';

export type Look = {
  ground: string; /* spine, back cover and jacket: the cover's colour at the bound edge */
  ink: string; /* text on the ground */
  accent: string; /* the cover's most telling colour, for glows and tints */
  light: boolean; /* the ground is light, so the ink is dark */
  dark: boolean; /* the cover as a whole is dark: a blurred copy of it would only grey the room */
};

const INK_DARK = 'oklch(22% 0.012 60)';
const INK_LIGHT = 'oklch(96% 0.006 85)';

const coverFile = (id: string) => {
  const entry = raw.find((r) => r.id === id);
  if (!entry) throw new Error(`No book ${id}`);
  return path.join(process.cwd(), 'src/assets/covers', path.basename(entry.cover));
};

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const luminance = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const rgb = ([r, g, b]: number[]) => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;

/* The mean colour of a strip of the cover. */
async function strip(file: string, side: 'left' | 'right') {
  const meta = await sharp(file).metadata();
  const w = meta.width!;
  const h = meta.height!;
  const sw = Math.max(2, Math.round(w * 0.035));
  const { data } = await sharp(file)
    .extract({ left: side === 'left' ? 0 : w - sw, top: 0, width: sw, height: h })
    .resize(1, 1, { kernel: 'cubic' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return [data[0], data[1], data[2]];
}

/* The cover's most telling colour: of the saturated, not-too-dark pixels, the hue that is
   both common and vivid. Falls back to the dominant colour for covers without one. */
async function accentOf(file: string) {
  const { data, info } = await sharp(file).resize(48, 72, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const bins = Array.from({ length: 18 }, () => ({ n: 0, r: 0, g: 0, b: 0, s: 0, v: 0 }));
  const total = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const v = max / 255;
    const s = max === 0 ? 0 : (max - min) / max;
    if (s < 0.3 || v < 0.24) continue;
    let hue = 0;
    if (max === r) hue = ((g - b) / (max - min)) % 6;
    else if (max === g) hue = (b - r) / (max - min) + 2;
    else hue = (r - g) / (max - min) + 4;
    const bin = bins[Math.floor(((hue * 60 + 360) % 360) / 20)];
    bin.n++;
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bin.s += s;
    bin.v += v;
  }
  const best = bins
    .filter((x) => x.n > total * 0.012)
    .map((x) => ({ ...x, score: x.n * Math.pow(x.s / x.n, 1.4) * Math.sqrt(x.v / x.n) }))
    .sort((a, b) => b.score - a.score)[0];
  if (best) return [best.r / best.n, best.g / best.n, best.b / best.n];
  const { dominant } = await sharp(file).resize(64, 96).stats();
  return [dominant.r, dominant.g, dominant.b];
}

const looks = new Map<string, Look>();

export async function look(b: Book): Promise<Look> {
  const hit = looks.get(b.id);
  if (hit) return hit;
  const file = coverFile(b.id);
  const edge = await strip(file, b.data.language === 'ar' ? 'right' : 'left');
  const light = luminance(edge) > 0.36;
  const { channels } = await sharp(file).resize(64, 96).stats();
  const value: Look = {
    ground: rgb(edge),
    ink: light ? INK_DARK : INK_LIGHT,
    accent: rgb(await accentOf(file)),
    light,
    dark: luminance(channels.slice(0, 3).map((c) => c.mean)) < 0.1,
  };
  looks.set(b.id, value);
  return value;
}

/* The CSS custom properties a book object reads: its proportions and colours. */
export async function bookStyle(b: Book) {
  const L = await look(b);
  const { w, h, t } = b.data.size;
  return [
    `--ar:${(w / h).toFixed(4)}`,
    `--tr:${(t / h).toFixed(4)}`,
    `--ground:${L.ground}`,
    `--ground-ink:${L.ink}`,
    `--accent:${L.accent}`,
    `--glow-o:${L.dark ? 0.2 : 0.5}`,
  ].join(';');
}

/* ---------- text ---------- */

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;

export const scriptOf = (text: string): 'ar' | 'latin' => {
  const ar = (text.match(ARABIC) || []).length;
  return ar > text.replace(/\s/g, '').length * 0.3 ? 'ar' : 'latin';
};

export type Para = { text: string; lang: string; dir: 'rtl' | 'ltr'; lead?: string };

/* The description as paragraphs, each marked with its own language: some Arabic books carry an
   English summary too. A list item like "Custody made clear: ..." keeps its lead-in apart. */
export function paragraphs(b: Book): Para[] {
  return b.data.description.map((text) => {
    const ar = scriptOf(text) === 'ar';
    const lang = ar ? 'ar' : b.data.language === 'ar' ? 'en' : b.data.language;
    const m = !ar && text.match(/^([A-Z][^:.]{2,42}):\s+(.+)$/);
    return m
      ? { text: m[2], lead: m[1], lang, dir: 'ltr' as const }
      : { text, lang, dir: ar ? ('rtl' as const) : ('ltr' as const) };
  });
}

/* The opening of the description in the book's own language, cut at a sentence, for a back cover. */
export function blurb(b: Book, words = 48) {
  const first = paragraphs(b).find((p) => (b.data.language === 'ar' ? p.dir === 'rtl' : p.dir === 'ltr')) ?? paragraphs(b)[0];
  const sentences = first.text.match(/[^.!?؟]+[.!?؟]+["”’)]?\s*/g) ?? [first.text];
  let out = '';
  for (const s of sentences) {
    if (out && (out + s).split(/\s+/).length > words) break;
    out += s;
  }
  return { text: out.trim(), lang: first.lang, dir: first.dir };
}

export const wordCount = (b: Book) => b.data.description.join(' ').split(/\s+/).length;

/* What goes on the spine: the title as the book itself prints it. */
export const spineTitle = (b: Book) => b.data.title;

/* How a book is read: the title in its own script, and a line a reader of English can follow. */
export function titles(b: Book) {
  const d = b.data;
  return {
    title: d.title,
    latin: d.titleLatin,
    english: d.language === 'en' ? d.subtitle : d.titleEn,
    subtitle: d.subtitle,
  };
}

export const amazonLabel = (label: string) => `${label} on Amazon`;

/* ---------- groups ---------- */

export const LANGUAGES = [
  { lang: 'en', label: 'In English' },
  { lang: 'ar', label: 'In Arabic' },
  { lang: 'so', label: 'In Somali' },
] as const;

export function byLanguage(all: Book[]) {
  return LANGUAGES.map((l) => ({ ...l, books: all.filter((b) => b.data.language === l.lang) }));
}

/* ---------- barcode ---------- */

const L_CODE = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G_CODE = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R_CODE = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/* The EAN-13 bars for an ISBN-13, as [x, width] runs over 95 modules. */
export function ean13(code: string) {
  const d = code.replace(/\D/g, '');
  if (d.length !== 13) return null;
  const n = d.split('').map(Number);
  const parity = PARITY[n[0]];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? L_CODE : G_CODE)[n[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R_CODE[n[i]];
  bits += '101';
  const runs: [number, number][] = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue;
    let j = i;
    while (bits[j + 1] === '1') j++;
    runs.push([i, j - i + 1]);
    i = j;
  }
  /* Guard bars run long, as on a printed barcode. */
  const guards = new Set([0, 2, 46, 48, 92, 94]);
  return { runs, guards, digits: d };
}
