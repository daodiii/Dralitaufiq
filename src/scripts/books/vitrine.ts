/**
 * The books page's vitrine (components/books/BooksVitrine.astro). A book still below the reader
 * stands turned away; as it comes up it turns to face them, once (.is-low removed, a CSS
 * transition). The whole description is on each book's own page (pages/books/[id]). ?book=<id>
 * was already brought into view before the first paint (books.astro).
 */
import { nav, showNav } from '../nav';
import { reveals } from '../reveals';
import { scrollToY } from '../smooth';

nav();
showNav();
reveals();

/* The books below the reader (.is-low, set before the first paint) turn to face them as they come up. */
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.remove('is-low');
      io.unobserve(e.target);
    }
  },
  { rootMargin: '0px 0px -15% 0px' }
);
document.querySelectorAll('.vt__bk.is-low').forEach((b) => io.observe(b));

/* Fonts and pictures arriving can grow the text above it a little; until the reader moves, the
   linked book stays at the top. */
const target = document.documentElement.dataset.book && document.getElementById(`bk-${document.documentElement.dataset.book}`);
if (target) {
  let moved = false;
  const stop = () => (moved = true);
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => addEventListener(t, stop, { once: true, passive: true }));
  const align = () => {
    const top = target.getBoundingClientRect().top;
    if (!moved && Math.abs(top) > 2) scrollToY(scrollY + top, true);
  };
  document.fonts?.ready.then(align);
  addEventListener('load', align);
}

/* A spine or a cover of the arc glides down to its book (smooth.ts); the address names the book,
   so it can be shared. */
document.addEventListener('click', (e) => {
  const sp = (e.target as HTMLElement).closest<HTMLAnchorElement>('a.vt__sp, a.vt__ac');
  if (sp) history.replaceState(history.state, '', `?book=${sp.hash.slice(4)}`);
});


/* ---------- the arc of covers (BooksVitrine.astro, styles/vitrine.css) ----------
   The book in view sits nearest the left edge, 72px wide, with its name under it; the books before
   it go up the curve and the books after it down, smaller, fainter and further out the further they
   are. It shows once the shelf is behind the reader, on wide screens. The covers move only when the
   book in view changes, or the reader turns the arc with the wheel (a transform and a CSS
   transition), never on each frame of a scroll. */
function arc() {
  const box = document.querySelector<HTMLElement>('[data-arc]');
  const books = Array.from(document.querySelectorAll<HTMLElement>('.vt__bk'));
  const head = document.querySelector<HTMLElement>('.vt__in');
  if (!box || !books.length || !head) return;
  const items = Array.from(box.querySelectorAll<HTMLAnchorElement>('.vt__ac'));
  const labels = new Map(Array.from(box.querySelectorAll<HTMLElement>('.vt__al')).map((l) => [l.dataset.g!, l]));
  const name = box.querySelector<HTMLElement>('.vt__an')!;
  const wide = matchMedia('(min-width: 1100px)');
  const bar = document.querySelector<HTMLElement>('.nav');
  let cur = 0; /* the book in view */
  let at = 0; /* the cover the arc is turned to: the book in view, or one the reader wheeled to */
  /* Where the covers stand, for telling whether the pointer is over the arc. */
  const band = { top: 0, bottom: 0, right: 0 };

  const place = () => {
    if (!wide.matches) return;
    const H = innerHeight;
    const top = bar ? bar.getBoundingClientRect().bottom : 0;
    const mid = top + (H - top) / 2;
    const shown = new Set<string>();
    /* The covers next to the book in view keep clear of it (and of its name below); further out they
       stack, each overlapping the next by a little. */
    const width = (a: number) => (a === 0 ? 72 : Math.max(24, 44 - a * 2.8));
    const height = (i: number, w: number) => (items[i] ? (items[i].offsetHeight * w) / 72 : 0);
    const curH = height(at, 72);
    /* The name of the book in view first, so its height (one line or two) is known. */
    if (items[at]) {
      name.textContent = items[at].getAttribute('aria-label');
      name.lang = items[at].dataset.g!;
    }
    const nameH = name.offsetHeight || 18;
    band.top = Infinity;
    band.bottom = -Infinity;
    band.right = 0;
    items.forEach((it, i) => {
      const d = i - at;
      const a = Math.abs(d);
      const w = width(a);
      const s = w / 72;
      const h = height(i, w);
      const near = height(at + Math.sign(d), width(1)) / 2;
      const gap = d > 0 ? curH / 2 + 12 + nameH + 14 + near : curH / 2 + 14 + near;
      const y = mid + Math.sign(d) * (a === 0 ? 0 : gap + (a - 1) * 36);
      const x = 36 + a * a * 2.1;
      const on = a <= 7 && y - h / 2 > top + 8 && y + h / 2 < H - 8;
      it.style.transform = `translate3d(${x.toFixed(1)}px, ${(y - h / 2).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
      it.style.opacity = on ? String(d === 0 ? 1 : Math.max(0.3, 1 - a * 0.11)) : '0';
      it.classList.toggle('is-off', !on);
      it.classList.toggle('is-now', d === 0);
      if (on) {
        band.top = Math.min(band.top, y - h / 2);
        band.bottom = Math.max(band.bottom, y + h / 2 + (d === 0 ? 12 + nameH : 0));
        band.right = Math.max(band.right, x + w, d === 0 ? x + 132 : 0);
      }
      if (d === 0) name.style.transform = `translate3d(${x}px, ${(y + h / 2 + 12).toFixed(1)}px, 0)`;
      /* Current is the book on the page, wherever the arc is turned. */
      if (i === cur) it.setAttribute('aria-current', 'true');
      else it.removeAttribute('aria-current');
      /* Each language's name beside its first cover, unless that cover is the one in view. */
      const g = it.dataset.g!;
      const first = i === 0 || items[i - 1].dataset.g !== g;
      const label = labels.get(g);
      if (first && label) {
        const show = on && d !== 0;
        if (show) shown.add(g);
        label.style.transform = `translate3d(${(x + w + 12).toFixed(1)}px, ${(y - 8).toFixed(1)}px, 0)`;
      }
    });
    labels.forEach((l, g) => l.classList.toggle('is-off', !shown.has(g)));
  };

  /* The book in view: the one crossing the middle of the screen. */
  const now = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const i = books.indexOf(e.target as HTMLElement);
        if (i >= 0 && i !== cur) {
          cur = at = i;
          place();
        }
      }
    },
    { rootMargin: '-50% 0px -50% 0px' }
  );
  books.forEach((b) => now.observe(b));

  /* Shown once the shelf at the top has gone up past the middle of the screen. The band under the
     bar is left out, so a shelf that ends exactly at the top edge (the first book lands there) counts
     as gone: an observer counts touching edges as intersecting. */
  const shelf = new IntersectionObserver(([e]) => box.classList.toggle('is-on', !e.isIntersecting), {
    rootMargin: `-${Math.round(bar?.offsetHeight ?? 0)}px 0px -50% 0px`,
  });
  shelf.observe(head);

  /* Over the arc the wheel turns the arc, one cover per notch, and the page stays where it is
     (2026-11-25: the reader expected the arc to scroll on its own, as a list does). A trackpad's
     many small events add up to the same distance per cover. At either end the arc stops. When
     the pointer leaves the arc, it turns back to the book in view; a click on a cover goes there. */
  const STEP = 80;
  let acc = 0;
  let frame = 0;
  let back = 0;
  const over = (e: MouseEvent) =>
    wide.matches &&
    box.classList.contains('is-on') &&
    e.clientX <= band.right + 16 &&
    e.clientY >= band.top - 16 &&
    e.clientY <= band.bottom + 16;
  addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || !over(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      clearTimeout(back);
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
      /* A mouse notch (80 to 120 px, by screen scale) turns one cover; a trackpad's small steps add up. */
      if (Math.abs(dy) >= 50) acc = Math.sign(dy) * STEP;
      else acc += dy;
      let next = at;
      while (acc >= STEP && next < items.length - 1) (next++, (acc -= STEP));
      while (acc <= -STEP && next > 0) (next--, (acc += STEP));
      /* Pushing past an end is not saved up: turning back answers at once. */
      if ((next === items.length - 1 && acc > 0) || (next === 0 && acc < 0)) acc = 0;
      if (next === at) return;
      at = next;
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), place()));
    },
    { capture: true, passive: false }
  );
  addEventListener(
    'mousemove',
    (e) => {
      if (at === cur || over(e)) return;
      clearTimeout(back);
      back = window.setTimeout(() => {
        acc = 0;
        if (at !== cur) ((at = cur), place());
      }, 700);
    },
    { passive: true }
  );

  place();
  addEventListener('resize', place);
  wide.addEventListener('change', place);
}
arc();
