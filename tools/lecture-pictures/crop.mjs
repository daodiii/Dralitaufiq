/**
 * The pictures of him on the home page's lectures screen (phones), one per series:
 * src/assets/lectures/screen/<series>.jpg. Each is a frame YouTube keeps of one lesson
 * (lib/stills.ts), chosen by eye so he looks himself (eyes open, face calm, looking at the
 * camera), cropped 16:9 around him with the channel's logos and tickers left out.
 *
 *   node tools/lecture-pictures/crop.mjs
 *
 * Needs the network (i.ytimg.com) and the project's sharp. Regenerate here rather than editing
 * the JPEGs. Riyāḍ and the Companions come only as 640 px frames on YouTube, so theirs are small.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'package.json'));
const sharp = require('sharp');
const out = path.join(root, 'src/assets/lectures/screen');
const L = JSON.parse(readFileSync(path.join(root, 'src/data/lessons.json'), 'utf8'));

/* The series, the lesson, its frame (1-3, YouTube's quarter, half and three quarters), where he
   sits across the picture (0-1), and how much of its height to keep (the rest is a ticker). */
const PICKS = [
  ['quran', 325, 1, 0.52, 1],
  ['riyad', 148, 2, 0.6, 1],
  ['brief', 114, 2, 0.5, 1],
  ['companions', 97, 1, 0.45, 0.9],
  ['sira', 46, 3, 0.548, 0.6],
  ['bulugh', 18, 2, 0.44, 0.885],
];

mkdirSync(out, { recursive: true });

for (const [key, n, f, sx, keep] of PICKS) {
  const l = L[key].lessons.find((x) => x.n === n);
  if (!l) throw new Error(`No lesson ${n} in ${key}`);
  /* The largest size YouTube has of it (`x`, when it has no maxres). */
  const url = `https://i.ytimg.com/vi/${l.fv ?? l.id}/${l.x ?? 'maxres'}${f}.jpg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { width: w, height: h } = await sharp(buf).metadata();
  /* sd and hq are 4:3 with the 16:9 picture between black bars: take the picture. */
  let top = 0;
  let ph = h;
  if (Math.abs(w / h - 4 / 3) < 0.01) {
    ph = Math.round((w * 9) / 16);
    top = Math.round((h - ph) / 2);
  }
  const H = Math.round(ph * keep);
  const cw = Math.min(w, Math.round((H * 16) / 9));
  const ch = Math.round((cw * 9) / 16);
  const left = Math.max(0, Math.min(w - cw, Math.round(sx * w - cw / 2)));
  await sharp(buf)
    .extract({ left, top, width: cw, height: ch })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(path.join(out, `${key}.jpg`));
  console.log(`${key}: lesson ${n}, frame ${f}, ${w}x${h} -> ${cw}x${ch}`);
}
