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
   book in view changes (a transform and a CSS transition), never on each frame of a scroll. */
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
  let cur = 0;

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
    const curH = height(cur, 72);
    /* The name of the book in view first, so its height (one line or two) is known. */
    if (items[cur]) {
      name.textContent = items[cur].getAttribute('aria-label');
      name.lang = items[cur].dataset.g!;
    }
    const nameH = name.offsetHeight || 18;
    items.forEach((it, i) => {
      const d = i - cur;
      const a = Math.abs(d);
      const w = width(a);
      const s = w / 72;
      const h = height(i, w);
      const near = height(cur + Math.sign(d), width(1)) / 2;
      const gap = d > 0 ? curH / 2 + 12 + nameH + 14 + near : curH / 2 + 14 + near;
      const y = mid + Math.sign(d) * (a === 0 ? 0 : gap + (a - 1) * 36);
      const x = 36 + a * a * 2.1;
      const on = a <= 7 && y - h / 2 > top + 8 && y + h / 2 < H - 8;
      it.style.transform = `translate3d(${x.toFixed(1)}px, ${(y - h / 2).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
      it.style.opacity = on ? String(d === 0 ? 1 : Math.max(0.3, 1 - a * 0.11)) : '0';
      it.classList.toggle('is-off', !on);
      it.classList.toggle('is-now', d === 0);
      if (d === 0) {
        it.setAttribute('aria-current', 'true');
        name.style.transform = `translate3d(${x}px, ${(y + h / 2 + 12).toFixed(1)}px, 0)`;
      } else it.removeAttribute('aria-current');
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
          cur = i;
          place();
        }
      }
    },
    { rootMargin: '-50% 0px -50% 0px' }
  );
  books.forEach((b) => now.observe(b));

  /* Shown once the shelf at the top is above the middle of the screen. */
  const shelf = new IntersectionObserver(([e]) => box.classList.toggle('is-on', !e.isIntersecting), { rootMargin: '0px 0px -50% 0px' });
  shelf.observe(head);

  place();
  addEventListener('resize', place);
  wide.addEventListener('change', place);
}
arc();
