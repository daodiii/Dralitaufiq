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

/* A spine glides down to its book (smooth.ts); the address names the book, so it can be shared. */
document.addEventListener('click', (e) => {
  const sp = (e.target as HTMLElement).closest<HTMLAnchorElement>('a.vt__sp');
  if (sp) history.replaceState(history.state, '', `?book=${sp.hash.slice(4)}`);
});

