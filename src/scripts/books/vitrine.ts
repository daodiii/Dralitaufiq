/**
 * The books page's vitrine (components/books/BooksVitrine.astro). A book still below the reader
 * stands turned away; as it comes up it turns to face them, once (.is-in, a CSS transition). The
 * whole description opens in the side sheet. ?book=<id> was already brought into view before the
 * first paint (books.astro); the books above it are shown as turned.
 */
import { nav, showNav } from '../nav';
import { reveals } from '../reveals';
import { openSheet } from './sheet';
import { scrollToY } from '../smooth';

nav();
showNav();
reveals();

const books = Array.from(document.querySelectorAll<HTMLElement>('.vt__bk'));

/* Everything already in view or passed shows at rest without turning. */
const settle = () => {
  for (const b of books) if (b.getBoundingClientRect().top < innerHeight * 0.85) b.classList.add('is-in');
};
settle();

const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  },
  { rootMargin: '0px 0px -15% 0px' }
);
books.filter((b) => !b.classList.contains('is-in')).forEach((b) => io.observe(b));

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

document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('.vt__whole[data-open]');
  if (b) openSheet(b.dataset.open!, b);
});
