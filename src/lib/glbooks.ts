/**
 * The books as a WebGL stage reads them: one plain object per book, embedded in the page as JSON
 * (GlPayload.astro) and read by scripts/books/gl/payload.ts. Sizes are in centimetres;
 * colours are hex, since three.js cannot read the site's oklch; covers come at two sizes.
 */
import path from 'node:path';
import { getImage } from 'astro:assets';
import raw from '../data/books.json';
import type { Book } from './books';
import { blurb, byLanguage, ean13, look, spineTitle } from './library';
import { paletteOf } from './palette';

export type GlBook = {
  id: string;
  i: number; /* place on the page: English, then Arabic, then Somali */
  lang: 'en' | 'ar' | 'so';
  rtl: boolean; /* bound on the right */
  title: string;
  spine: string;
  publisher: string | null;
  size: { w: number; h: number; t: number };
  pages: number;
  cover: { sm: string; lg: string };
  ground: string;
  ink: string; /* a CSS colour, for canvas text only */
  accent: string;
  light: boolean;
  dark: boolean;
  palette: string[];
  blurb: { text: string; lang: string; dir: 'ltr' | 'rtl' };
  praise: { quote: string; name: string } | null;
  ean: { runs: [number, number][]; guards: number[]; digits: string } | null;
};

const hexOf = (css: string) => {
  const m = css.match(/rgb\((\d+)\s+(\d+)\s+(\d+)\)/);
  return m ? '#' + m.slice(1, 4).map((v) => Number(v).toString(16).padStart(2, '0')).join('') : css;
};

const coverFile = (id: string) => {
  const entry = raw.find((r) => r.id === id);
  if (!entry) throw new Error(`No book ${id}`);
  return path.join(process.cwd(), 'src/assets/covers', path.basename(entry.cover));
};

/* The order on the page: English, Arabic, Somali. */
export const ordered = (all: Book[]) => byLanguage(all).flatMap((g) => g.books);

const cache = new Map<string, GlBook>();

export async function glBooks(all: Book[]): Promise<GlBook[]> {
  return Promise.all(
    ordered(all).map(async (b, i) => {
      const hit = cache.get(b.id);
      if (hit) return hit;
      const d = b.data;
      const L = await look(b);
      const [sm, lg, palette] = await Promise.all([
        getImage({ src: d.cover, width: 420, format: 'webp', quality: 86 }),
        getImage({ src: d.cover, width: Math.min(1024, d.coverWidth), format: 'webp', quality: 88 }),
        paletteOf(coverFile(b.id)),
      ]);
      const bars = ean13(d.ean);
      const first = d.endorsements?.[0];
      const value: GlBook = {
        id: b.id,
        i,
        lang: d.language,
        rtl: d.language === 'ar',
        title: d.title,
        spine: spineTitle(b),
        publisher: d.publisher,
        size: d.size,
        pages: d.pages,
        cover: { sm: sm.src, lg: lg.src },
        ground: hexOf(L.ground),
        ink: L.ink,
        accent: hexOf(L.accent),
        light: L.light,
        dark: L.dark,
        palette,
        blurb: blurb(b),
        praise: first ? { quote: first.quote.split('. ')[0].replace(/\.$/, '') + '.', name: first.name } : null,
        ean: bars ? { runs: bars.runs, guards: [...bars.guards], digits: bars.digits } : null,
      };
      cache.set(b.id, value);
      return value;
    })
  );
}
