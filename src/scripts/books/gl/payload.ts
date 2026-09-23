import type { GlBook } from '../../../lib/glbooks';

export type { GlBook };

/* The books GlPayload.astro embedded in the page. */
export function readBooks(): GlBook[] {
  const el = document.getElementById('glbooks');
  return el?.textContent ? (JSON.parse(el.textContent) as GlBook[]) : [];
}

/* A book's weight in grams: its volume at the density of book paper. */
export const grams = (b: GlBook) => b.size.w * b.size.h * b.size.t * 0.72;
