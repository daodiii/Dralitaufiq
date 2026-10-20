/* A book's spine, built from the data: the colour of its cover's left
   edge, its true thickness and height in cm (books.json size). The shelf (Shelf.astro) and the
   home page's small shelf (Works.astro) stand them up. */
import path from 'node:path';
import sharp from 'sharp';
import { languageName, type Book } from './books';
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

/* The thinnest books (0.8-0.9 cm) are drawn at least this thick, so their titles can be read. */
const MIN_T = 1.3;

export async function spineInfo(b: Book): Promise<SpineInfo> {
  const hit = cache.get(b.data.order);
  if (hit) return hit;
  const entry = raw.find((r) => r.order === b.data.order)!;
  const file = path.join(process.cwd(), 'src/assets/covers', path.basename(entry.cover));
  const img = sharp(file);
  const { height = 1000 } = await img.metadata();
  const px = await sharp(file).extract({ left: 0, top: 0, width: 40, height }).resize(1, 1).raw().toBuffer();
  const [r, g, bl] = [px[0], px[1], px[2]];
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * bl) / 255;
  const d = b.data;
  const info: SpineInfo = {
    id: b.id,
    order: d.order,
    lang: d.language,
    title: d.title,
    short: d.language === 'ar' ? d.title.split(' ').slice(0, 3).join(' ') : d.title.replace(/\s*ﷺ/, ''),
    colour: `rgb(${r} ${g} ${bl})`,
    ink: lum < 0.55 ? 'rgb(250 246 236 / .92)' : 'rgb(30 24 18 / .86)',
    t: Math.max(d.size.t, MIN_T),
    h: d.size.h,
    w: d.size.w,
  };
  cache.set(d.order, info);
  return info;
}

/* The shelf's order, each language in its own words. */
export const LANGS = (['en', 'ar', 'so'] as const).map((k) => ({ k, name: languageName[k] }));
