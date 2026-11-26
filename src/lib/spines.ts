/* A book's spine, built from the data: the colour of its cover's left
   edge, its true thickness and height in cm (books.json size). The shelf (Shelf.astro) and the
   home page's small shelf (Works.astro) stand them up. */
import path from 'node:path';
import sharp from 'sharp';
import { languageName, type Book } from './books';
import { volumeMark } from './library';
import raw from '../data/books.json';

export interface SpineInfo {
  id: string;
  order: number;
  lang: 'en' | 'ar' | 'so';
  title: string;
  short: string;
  colour: string;
  ink: string;
  t: number;
  h: number;
  w: number;
}

const cache = new Map<number, SpineInfo>();


export async function spineInfo(b: Book): Promise<SpineInfo> {
  const hit = cache.get(b.data.order);
  if (hit) return hit;
  const entry = raw.find((r) => r.order === b.data.order)!;
  const file = path.join(process.cwd(), 'src/assets/covers', path.basename(entry.cover));
  const img = sharp(file);
  const { height = 1000 } = await img.metadata();
  const px = await sharp(file).extract({ left: 0, top: 0, width: 40, height }).resize(1, 1).raw().toBuffer();
  const [r, g, bl] = [px[0], px[1], px[2]];
  /* Relative luminance; the title takes whichever of the two inks reads better on it (they cross
     at about 0.19). */
  const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
  const d = b.data;
  const info: SpineInfo = {
    id: b.id,
    order: d.order,
    lang: d.language,
    title: d.title,
    short: [d.language === 'ar' ? d.title.split(' ').slice(0, 3).join(' ') : d.title.replace(/\s*ﷺ/, ''), volumeMark(d)].filter(Boolean).join(' · '),
    colour: `rgb(${r} ${g} ${bl})`,
    ink: lum < 0.19 ? 'rgb(250 246 236)' : 'rgb(12 11 9)',
    t: d.size.t,
    h: d.size.h,
    w: d.size.w,
  };
  cache.set(d.order, info);
  return info;
}

/* The shelf's order, each language in its own words. */
export const LANGS = (['en', 'ar', 'so'] as const).map((k) => ({ k, name: languageName[k] }));
