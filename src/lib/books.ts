/**
 * Shared book data for the showcase variants: the featured sequence, caption
 * text, and the dominant jacket colour (read with sharp at build time).
 */
import path from 'node:path';
import sharp from 'sharp';
import { getCollection, type CollectionEntry } from 'astro:content';
import raw from '../data/books.json';

export type Book = CollectionEntry<'books'>;

/* The three stops of the wall, one per language: Arab Culture, Fiqh al-Mahjar, Dawada Nafta. */
export const FEATURED = [0, 11, 15];

export const languageLabel = { en: 'English', ar: 'Arabic', so: 'Somali' } as const;

export function shortRole(role: string) {
  if (role.startsWith('Translated, edited')) return 'Translated, edited and annotated';
  if (role.startsWith('Translated')) return 'Translated';
  if (role.startsWith('Lectures')) return 'Lectures, compiled';
  if (role.startsWith('Critical')) return 'Critical edition';
  return role;
}

export async function allBooks(): Promise<Book[]> {
  const all = await getCollection('books');
  return all.sort((a, b) => a.data.order - b.data.order);
}

export function featuredBooks(all: Book[], orders: number[] = FEATURED): Book[] {
  return orders.map((n) => all.find((b) => b.data.order === n)).filter((b): b is Book => Boolean(b));
}

export function caption(b: Book) {
  return {
    secondary: b.data.language === 'ar' ? b.data.titleEn : b.data.subtitle || b.data.titleEn,
    meta: [shortRole(b.data.role), languageLabel[b.data.language], b.data.publisher, b.data.year]
      .filter(Boolean)
      .join(' · '),
    href: `/books/${b.id}`,
    label: b.data.titleLatin || b.data.title,
  };
}

const colourCache = new Map<number, string>();

export async function dominantColour(order: number) {
  const hit = colourCache.get(order);
  if (hit) return hit;
  const entry = raw.find((r) => r.order === order);
  if (!entry) return 'oklch(30% 0.02 60)';
  const file = path.join(process.cwd(), 'src/assets/covers', path.basename(entry.cover));
  const { dominant } = await sharp(file).resize(64, 96).stats();
  const colour = `rgb(${dominant.r} ${dominant.g} ${dominant.b})`;
  colourCache.set(order, colour);
  return colour;
}

export const pad = (n: number) => String(n).padStart(2, '0');
