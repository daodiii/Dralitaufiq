/**
 * The books page's reading room (components/books/BooksRoom.astro): turns from book to book. The
 * open book is the page's data-book; a spine, a cover, a neighbour or the arrow keys change it, and
 * the address follows (?book=<id>) so the book can be linked. The open page's description is cut
 * to the lines that fit, with the whole text under the room.
 */
import { nav, showNav } from '../nav';
import { reveals } from '../reveals';
import { scrollToY } from '../smooth';

nav();
showNav();
reveals();

const html = document.documentElement;
const ids = Array.from(document.querySelectorAll<HTMLElement>('.broom__stage')).map((s) => s.dataset.id!);
const current = () => (ids.includes(html.dataset.book ?? '') ? html.dataset.book! : ids[0]);

/* The description runs as far as the page allows, then stops at a whole line. */
function fit() {
  const stage = document.querySelector<HTMLElement>(`.broom__stage[data-id="${current()}"]`);
  const txt = stage?.querySelector<HTMLElement>('.bk__txt');
  if (!txt) return;
  const desc = txt.querySelector<HTMLElement>('.bk__desc')!;
  const whole = txt.querySelector<HTMLElement>('.bk__whole')!;
  desc.style.cssText = '';
  whole.hidden = false;
  const over = txt.scrollHeight - txt.clientHeight;
  if (over <= 0) {
    whole.hidden = true;
    return;
  }
  const lh = parseFloat(getComputedStyle(desc).lineHeight);
  const lines = Math.max(2, Math.floor((desc.offsetHeight - over - 4) / lh));
  desc.style.cssText = `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${lines};overflow:hidden`;
}

function open(id: string, from?: HTMLElement) {
  if (!ids.includes(id) || id === current()) return;
  html.dataset.book = id;
  history.replaceState(null, '', id === ids[0] ? location.pathname : `?book=${id}`);
  fit();
  /* A cover chosen under the room brings the room back into view. */
  if (from?.closest('.broom-paper')) scrollToY(0);
}

document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-book]');
  if (b && (b.closest('.broom') || b.closest('.broom-paper'))) open(b.dataset.book!, b);
});

document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target as HTMLElement;
  if (t.closest('input, textarea, select, [contenteditable]')) return;
  const i = ids.indexOf(current());
  if (e.key === 'ArrowRight' && i < ids.length - 1) open(ids[i + 1]);
  else if (e.key === 'ArrowLeft' && i > 0) open(ids[i - 1]);
});

document.fonts?.ready.then(fit);
addEventListener('load', fit);
let t = 0;
addEventListener('resize', () => {
  clearTimeout(t);
  t = window.setTimeout(fit, 120);
});
fit();
