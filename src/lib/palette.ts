/**
 * A cover's palette, for the WebGL stage: its few main colours, found by k-means over a small
 * copy of the cover, most common first, near-duplicates merged. Loaded by `node --test` too, so
 * it keeps to erasable TypeScript.
 */
import sharp from 'sharp';

export type RGB = [number, number, number];
export type Swatch = { c: RGB; n: number };

/* A small seeded generator, so a cover always gives the same palette. */
function generator(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

const dist2 = (a: RGB, b: RGB) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/* k-means with k-means++ seeding: the centres, most populous first, with their counts. */
export function kmeans(pixels: RGB[], k: number, iterations = 16, seed = 7): Swatch[] {
  const rand = generator(seed);
  const centres: RGB[] = [[...pixels[Math.floor(rand() * pixels.length)]] as RGB];
  while (centres.length < k) {
    const d = pixels.map((p) => Math.min(...centres.map((c) => dist2(p, c))));
    const total = d.reduce((a, b) => a + b, 0);
    if (total === 0) break;
    let pick = rand() * total;
    let i = 0;
    while (pick > d[i] && i < d.length - 1) pick -= d[i++];
    centres.push([...pixels[i]] as RGB);
  }
  const owner = new Array<number>(pixels.length).fill(0);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < pixels.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let j = 0; j < centres.length; j++) {
        const dd = dist2(pixels[i], centres[j]);
        if (dd < bestD) {
          bestD = dd;
          best = j;
        }
      }
      owner[i] = best;
    }
    const sums = centres.map(() => [0, 0, 0, 0]);
    pixels.forEach((p, i) => {
      const s = sums[owner[i]];
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3] += 1;
    });
    sums.forEach((s, j) => {
      if (s[3]) centres[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }
  const counts = centres.map((_, j) => owner.filter((o) => o === j).length);
  return centres
    .map((c, j) => ({ c, n: counts[j] }))
    .filter((s) => s.n > 0)
    .sort((a, b) => b.n - a.n);
}

/* Merge swatches closer than `min` (RGB distance) into the more common one. */
export function distinct(list: Swatch[], min = 30): Swatch[] {
  const out: Swatch[] = [];
  for (const s of list) {
    const near = out.find((o) => dist2(o.c, s.c) < min * min);
    if (near) near.n += s.n;
    else out.push({ c: s.c, n: s.n });
  }
  return out.sort((a, b) => b.n - a.n);
}

export const hex = (c: RGB) =>
  '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

/* A cover's main colours as hex, most common first, at most five. */
export async function paletteOf(file: string) {
  const { data, info } = await sharp(file)
    .resize(36, 54, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += info.channels) pixels.push([data[i], data[i + 1], data[i + 2]]);
  return distinct(kmeans(pixels, 7))
    .slice(0, 5)
    .map((s) => hex(s.c));
}
