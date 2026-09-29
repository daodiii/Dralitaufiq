/**
 * The lectures on a phone, "the screen" (components/LecturesScreen.astro): choosing a series
 * by its name, or by swiping across the screen, fetches its picture and lessons if they have
 * not come yet and crossfades to them once the picture is ready.
 */

/* Longest to wait for a picture before showing its series anyway. */
const WAIT = 600;

/* Give an image the source it was held back from. */
const fill = (img: HTMLImageElement) => {
  if (img.getAttribute('src')) return;
  if (img.dataset.srcset) img.srcset = img.dataset.srcset;
  if (img.dataset.src) img.src = img.dataset.src;
};

function mount(root: HTMLElement) {
  const names = [...root.querySelectorAll<HTMLButtonElement>('.screen__name')];
  const namesRow = root.querySelector<HTMLElement>('.screen__names')!;
  const view = root.querySelector<HTMLElement>('.screen__view')!;
  const parts = [...root.querySelectorAll<HTMLElement>('.screen__shot, .screen__lesson, .screen__row')];
  const n = names.length;
  let current = 0;
  let asked = 0;

  const shotImg = (k: number) => root.querySelector<HTMLImageElement>(`.screen__shot[data-k="${k}"] img`)!;
  const warm = (k: number) => fill(shotImg((k + n) % n));

  const show = async (k: number) => {
    k = (k + n) % n;
    if (k === asked) return;
    asked = k;
    names.forEach((b, i) => {
      b.classList.toggle('is-on', i === k);
      b.setAttribute('aria-pressed', String(i === k));
    });
    /* Keep the chosen name in view. */
    const b = names[k];
    namesRow.scrollTo({ left: b.offsetLeft - namesRow.clientWidth / 2 + b.offsetWidth / 2, behavior: 'smooth' });
    const img = shotImg(k);
    fill(img);
    root.querySelectorAll<HTMLImageElement>(`.screen__row[data-k="${k}"] img`).forEach(fill);
    await Promise.race([img.decode().catch(() => undefined), new Promise((r) => window.setTimeout(r, WAIT))]);
    if (asked !== k) return;
    current = k;
    parts.forEach((p) => {
      const on = p.dataset.k === String(k);
      p.classList.toggle('is-on', on);
      p.inert = !on;
    });
    root.querySelector<HTMLElement>(`.screen__row[data-k="${k}"]`)?.scrollTo({ left: 0 });
    /* The next one along is likely next. */
    warm(k + 1);
  };

  parts.forEach((p) => (p.inert = p.dataset.k !== '0'));
  names.forEach((b, i) => b.addEventListener('click', () => show(i)));

  /* A sideways swipe across the screen goes to the next series, or back. */
  let start: { x: number; y: number; id: number } | null = null;
  let swiped = false;
  view.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    swiped = false;
  });
  view.addEventListener('pointermove', (e) => {
    if (!start || swiped || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      swiped = true;
      show(current + (dx < 0 ? 1 : -1));
    }
  });
  view.addEventListener('pointerup', () => (start = null));
  view.addEventListener('pointercancel', () => (start = null));
  /* A swipe that ends on the screen is not a tap on it. */
  view.addEventListener(
    'click',
    (e) => {
      if (!swiped) return;
      e.preventDefault();
      swiped = false;
    },
    true
  );

  /* The second series' picture comes along once the screen is in view. */
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    warm(1);
  });
  io.observe(view);
}

const root = document.querySelector<HTMLElement>('.screen');
if (root) mount(root);

export {};
