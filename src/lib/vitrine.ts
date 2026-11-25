/**
 * What the vitrine shows of each book (the books page and each book's own page): its spine's size
 * and colours, the ink that reads on them, its pool of light, the opening of its description, the
 * whole description and its colophon. Sizes follow the books (lib/spines.ts).
 */
import type { Book } from './books';
import { languageName } from './books';
import { paragraphs } from './library';
import { spineInfo } from './spines';

/* Colour arithmetic on the spine colours ("rgb(r g b)"). */
const rgbOf = (c: string) => c.match(/\d+/g)!.slice(0, 3).map(Number);
const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a: number[], b: number[]) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const INK = [22, 18, 12];
const PAPER = [250, 246, 237];
const inkOn = (c: string) => (ratio(rgbOf(c), INK) >= ratio(rgbOf(c), PAPER) ? 'rgb(22 18 12)' : 'rgb(250 246 237)');
const warm = (c: string) => `rgb(${rgbOf(c).map((v, i) => Math.round(v * 0.65 + [255, 236, 200][i] * 0.35)).join(' ')})`;

export async function vitrine(books: Book[]) {
  const infos = await Promise.all(books.map(spineInfo));
  const info = (id: string) => infos.find((s) => s.id === id)!;
  const groups = (['en', 'ar', 'so'] as const).map((k) => ({ k, name: languageName[k], books: books.filter((b) => b.data.language === k) }));
  const order = groups.flatMap((g) => g.books);
  const view = order.map((b, i) => {
    const d = b.data;
    const s = info(b.id);
    const rtl = d.language === 'ar';
    const all = paragraphs(b);
    const own = rtl ? all.filter((p) => p.dir === 'rtl') : all.filter((p) => p.dir === 'ltr');
    const pool = own.length ? own : all;
    const long = pool.filter((p) => p.text.length > 70);
    const w = 9 + s.t * 6.5; /* the reading room's spine thickness, px */
    return {
      b,
      i,
      rtl,
      colour: s.colour,
      ink: inkOn(s.colour),
      glow: warm(s.colour),
      h: Math.round(s.h * 4.6 * 2.35),
      w: Math.round(Math.max(w * 2.35 * 0.72, rtl ? 48 : 40)),
      depth: Math.round(Math.max(44, w * 2.9)),
      desc: (long.length ? long : pool)[0],
      all,
      sub: d.subtitle,
      en: d.language !== 'en' && d.titleEn && d.titleEn !== d.subtitle ? d.titleEn : null,
      role: d.role !== 'Author' ? d.role : null,
      colo:
        d.badge === 'Coming soon'
          ? [d.badge, d.publisher].filter(Boolean).join(' · ')
          : [d.publisher, d.year, d.pages && `${d.pages} pages`].filter(Boolean).join(' · ') + (d.badge ? '. New in 2026' : ''),
    };
  });
  return { groups, order, view, v: (id: string) => view.find((x) => x.b.id === id)! };
}

export type VitrineBook = Awaited<ReturnType<typeof vitrine>>['view'][number];

/* A book's own page. */
export const bookHref = (id: string) => `/books/${id}`;
