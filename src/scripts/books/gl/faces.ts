import type { GlBook } from './payload';

/* The printed faces of a book, drawn on canvases for three.js: the spine, the back cover and the
   page edges. The spine title runs down the spine; the back carries the title, the blurb, a line
   of praise, the publisher and a barcode. */

const SANS = '"Geist Variable", "Helvetica Neue", Arial, sans-serif';
const ARABIC = 'Amiri, "Noto Naskh Arabic", serif';
export const AUTHOR = 'Ali Mohamed Salah';

/* Canvas text only draws in a web font once the browser has loaded it (and the Arabic subset
   only loads for Arabic text). */
export function fontsReady() {
  return Promise.all([
    document.fonts.load(`400 20px ${SANS}`, 'Ab'),
    document.fonts.load(`600 20px ${SANS}`, 'Ab'),
    document.fonts.load(`italic 400 20px ${SANS}`, 'Ab'),
    document.fonts.load(`400 20px ${ARABIC}`, 'علم'),
    document.fonts.load(`700 20px ${ARABIC}`, 'علم'),
  ]).then(() => undefined);
}

function sheet(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(4, Math.round(w));
  c.height = Math.max(4, Math.round(h));
  return c;
}

/* A software canvas. An accelerated one only records its drawing and rasterises it on the GPU the
   first time three.js uploads it, which stalled the page for 0.3 to 0.9 s whenever a book was first
   drawn or brought forward (measured on this laptop's Iris Xe, 2026-09-23); drawn on the CPU, the
   upload costs about 15 ms. */
const pen = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!;

/* Words laid into lines no wider than `width` from (x, y) down; the last line that fits above
   `maxY` ends in an ellipsis. Returns the y below the last line. */
function paragraph(g: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lead: number, maxY = Infinity) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && g.measureText(test).width > width) {
      if (y + lead * 2 > maxY) {
        g.fillText(`${line} …`, x, y);
        return y + lead;
      }
      g.fillText(line, x, y);
      y += lead;
      line = word;
    } else line = test;
  }
  if (line) {
    g.fillText(line, x, y);
    y += lead;
  }
  return y;
}

/* The spine: the cover's ground, shaded towards the hinges, the title running down it (an Arabic
   title reads upwards) and the author at its foot. `k` is canvas px per cm. */
export function drawSpine(b: GlBook, k: number) {
  const c = sheet(b.size.t * k, b.size.h * k);
  const g = pen(c);
  const W = c.width;
  const H = c.height;
  g.fillStyle = b.ground;
  g.fillRect(0, 0, W, H);
  const shade = g.createLinearGradient(0, 0, W, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.22)');
  shade.addColorStop(0.18, 'rgba(0,0,0,0)');
  shade.addColorStop(0.78, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.14)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);

  g.save();
  g.translate(W / 2, 0);
  g.rotate(Math.PI / 2);
  g.fillStyle = b.ink;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  const ar = b.lang === 'ar';
  const family = ar ? ARABIC : SANS;
  const weight = ar ? 700 : 600;
  g.direction = ar ? 'rtl' : 'ltr';
  g.font = `${weight} 100px ${family}`;
  const at100 = g.measureText(b.spine).width;
  const px = Math.min(W * (ar ? 0.5 : 0.46), (H * 0.66 * 100) / at100);
  g.font = `${weight} ${px}px ${family}`;
  g.fillText(b.spine, H * 0.06, ar ? px * 0.08 : 0);
  g.direction = 'ltr';
  g.textAlign = 'right';
  g.globalAlpha = 0.8;
  g.font = `500 ${Math.min(W * 0.3, H * 0.024)}px ${SANS}`;
  g.fillText(AUTHOR, H * 0.94, 0);
  g.restore();
  return c;
}

function barcode(g: CanvasRenderingContext2D, ean: NonNullable<GlBook['ean']>, x: number, y: number, w: number, h: number) {
  g.fillStyle = '#ffffff';
  g.fillRect(x, y, w, h);
  const margin = w * 0.08;
  const bar = (w - margin * 2) / 95;
  const top = y + h * 0.1;
  const tall = h * 0.64;
  g.fillStyle = '#16130f';
  for (const [s, n] of ean.runs) g.fillRect(x + margin + s * bar, top, n * bar, tall + (ean.guards.includes(s) ? h * 0.08 : 0));
  g.font = `500 ${h * 0.15}px ${SANS}`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.direction = 'ltr';
  g.fillText(ean.digits, x + w / 2, y + h * 0.95);
}

/* The back cover: title, blurb, a line of praise, and at the foot the
   publisher and the barcode. Seen from behind, so the spine side is on the right of a book bound
   on the left. */
export function drawBack(b: GlBook, k: number) {
  const c = sheet(b.size.w * k, b.size.h * k);
  const g = pen(c);
  const W = c.width;
  const H = c.height;
  g.fillStyle = b.ground;
  g.fillRect(0, 0, W, H);
  const sx = b.rtl ? 0 : W;
  const shade = g.createLinearGradient(sx, 0, b.rtl ? W * 0.08 : W * 0.92, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.18)');
  shade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);

  const left = W * 0.11;
  const right = W * 0.89;
  const width = right - left;
  const gap = H * 0.026;
  let y = H * 0.09;
  g.fillStyle = b.ink;
  g.textBaseline = 'top';

  const ar = b.lang === 'ar';
  const titlePx = H * (ar ? 0.036 : 0.034);
  g.font = `${ar ? 700 : 600} ${titlePx}px ${ar ? ARABIC : SANS}`;
  g.direction = ar ? 'rtl' : 'ltr';
  g.textAlign = ar ? 'right' : 'left';
  y = paragraph(g, b.title, ar ? right : left, y, width, titlePx * (ar ? 1.5 : 1.1)) + gap;

  const bl = b.blurb;
  const blAr = bl.dir === 'rtl';
  const bodyPx = H * (blAr ? 0.023 : 0.02);
  g.font = `400 ${bodyPx}px ${blAr ? ARABIC : SANS}`;
  g.direction = bl.dir;
  g.textAlign = blAr ? 'right' : 'left';
  g.globalAlpha = 0.92;
  y = paragraph(g, bl.text, blAr ? right : left, y, width, bodyPx * (blAr ? 1.8 : 1.55), H * 0.66) + gap;
  g.globalAlpha = 1;

  if (b.praise && y < H * 0.7) {
    const px = H * 0.019;
    const inset = H * 0.018;
    g.direction = 'ltr';
    g.textAlign = 'left';
    g.font = `italic 400 ${px}px ${SANS}`;
    const top = y;
    y = paragraph(g, `“${b.praise.quote}”`, left + inset, y, width - inset, px * 1.5, H * 0.8);
    g.font = `400 ${H * 0.016}px ${SANS}`;
    g.globalAlpha = 0.8;
    y = paragraph(g, b.praise.name, left + inset, y + px * 0.4, width - inset, H * 0.016 * 1.4);
    g.globalAlpha = 1;
    g.fillRect(left, top, Math.max(1, W * 0.003), y - top - px * 0.3);
  }

  const foot = H * 0.93;
  g.textBaseline = 'alphabetic';
  g.direction = 'ltr';
  g.textAlign = 'left';
  g.globalAlpha = 0.85;
  g.font = `500 ${H * 0.016}px ${SANS}`;
  g.fillText(b.publisher ?? AUTHOR, left, foot);
  g.globalAlpha = 1;
  if (b.ean) {
    const bw = W * 0.34;
    const bh = bw * 0.42;
    barcode(g, b.ean, right - bw, foot - bh, bw, bh);
  }
  return c;
}

/* Page edges: paper with fine lines, horizontal (head and tail) or vertical (fore-edge). */
export function drawEdges(vertical: boolean) {
  const c = sheet(vertical ? 128 : 8, vertical ? 8 : 128);
  const g = pen(c);
  g.fillStyle = '#f4efe5';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 128; i += 2) {
    g.fillStyle = `rgba(122, 104, 76, ${(0.07 + (((i * 7919) % 17) / 17) * 0.09).toFixed(3)})`;
    if (vertical) g.fillRect(i, 0, 1, c.height);
    else g.fillRect(0, i, c.width, 1);
  }
  return c;
}
