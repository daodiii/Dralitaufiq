/**
 * Sizes a shelf of spines (components/books/Spine.astro) to the room it has. Every title is set in
 * one standard size, as on a real series of books, and each spine is at least as thick as its
 * title needs at that size (one column of letters, or more where a long title has to wrap): thick
 * books keep their true thickness, thin ones grow until their title reads.
 *
 * Writes on the holder: --s (px per cm of height), --k (true thickness widened by this, for a shelf
 * that should fill its width), --f (the title size); on each spine: --wmin.
 */
export interface FitOptions {
  holder: HTMLElement; /* where --s, --k and --f are set */
  spines: HTMLElement[];
  width: number; /* px the spines may take, gaps already taken off */
  maxS: number; /* px per cm the height allows */
  font: (s: number) => number; /* the standard title size for a shelf drawn at s */
  fill: boolean; /* widen thickness (--k, up to 2x) until the shelf fills the width */
}

const SPACING = 1.04; /* the titles' letter-spacing, 0.02em, and a little air */
const LINE = 1.18; /* one column of letters, as wide as this many times the size */
const LINE_AR = 1.75; /* Amiri's letters reach much further above and below the line */
const SIDES = 12; /* px of spine either side of the title, together */
const ENDS = 80; /* px of a spine's height its rules and author take */

let ruler: CanvasRenderingContext2D | null = null;
function textWidth(el: HTMLElement, size: number) {
  ruler ??= document.createElement('canvas').getContext('2d');
  if (!ruler) return el.textContent!.length * size * 0.55;
  const cs = getComputedStyle(el);
  ruler.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
  return ruler.measureText(el.textContent!.trim()).width * SPACING;
}

export function fitSpines(o: FitOptions) {
  const books = o.spines.map((sp) => ({
    sp,
    t: parseFloat(sp.style.getPropertyValue('--t')),
    h: parseFloat(sp.style.getPropertyValue('--h')),
    title: sp.querySelector<HTMLElement>('.spine__title')!,
  }));
  if (!books.length || o.width <= 0) return;

  /* The biggest s whose spines, each at least as thick as its title needs, fit the width. */
  let s = Math.max(6, o.maxS);
  let f = o.font(s);
  let mins: number[] = [];
  for (; s >= 6; s -= 0.25) {
    f = o.font(s);
    mins = books.map((b) => {
      const cols = Math.min(3, Math.max(1, Math.ceil(textWidth(b.title, f) / Math.max(40, b.h * s - ENDS))));
      return cols * f * (b.sp.dataset.lang === 'ar' ? LINE_AR : LINE) + SIDES;
    });
    const total = books.reduce((a, b, i) => a + Math.max(b.t * s, mins[i]), 0);
    if (total <= o.width) break;
  }

  /* Then widen the true thicknesses alike until the shelf fills the width (the minimums hold). */
  let k = 1;
  if (o.fill) {
    const at = (k: number) => books.reduce((a, b, i) => a + Math.max(b.t * s * k, mins[i]), 0);
    let lo = 1;
    let hi = 2;
    if (at(hi) <= o.width) lo = hi;
    else for (let n = 0; n < 24; n++) ((at((lo + hi) / 2) <= o.width) ? (lo = (lo + hi) / 2) : (hi = (lo + hi) / 2));
    k = lo;
  }

  o.holder.style.setProperty('--s', s.toFixed(2));
  o.holder.style.setProperty('--k', k.toFixed(3));
  o.holder.style.setProperty('--f', `${f.toFixed(1)}px`);
  books.forEach((b, i) => b.sp.style.setProperty('--wmin', `${Math.ceil(mins[i])}px`));
  return { s, k, f };
}
