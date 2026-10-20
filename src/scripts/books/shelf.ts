/**
 * The shelf on the books page (components/books/Shelf.astro): sizes the spines to the screen, and
 * opens a book's sheet on a click, or straight away for a link to one book (?book=<id>).
 */
import { nav, showNav } from '../nav';
import { reveals } from '../reveals';
import { openSheet } from './sheet';

nav();
showNav();
reveals();

const room = document.querySelector<HTMLElement>('.shelf__room');
const spines = Array.from(document.querySelectorAll<HTMLButtonElement>('.shelf .spine'));
const sheet = document.querySelector<HTMLElement>('.sheet');
const css = document.documentElement.style;

/* The tallest book in cm (the Arabic editions); every height is drawn true to it. */
const TALLEST = Math.max(...spines.map((s) => parseFloat(s.style.getPropertyValue('--h'))));
const THICK = spines.reduce((a, s) => a + parseFloat(s.style.getPropertyValue('--t')), 0);

/* --s px per cm: the tallest book fills what is left of the screen under the heading, and the
   shelf at true thickness still fits the width (a tablet held upright). --k then widens every
   spine alike, at most twice its true thickness, until the shelf fills the width. */
function fit() {
  if (!room || !spines.length) return;
  const ggap = Math.round(Math.max(24, room.clientWidth * 0.03));
  const free = room.clientWidth - 2 * ggap - spines.length - 64;
  const top = room.getBoundingClientRect().top + window.scrollY;
  const pad = parseFloat(getComputedStyle(room).paddingTop) || 0;
  const tall = (window.innerHeight - top - pad - 80) / TALLEST;
  const s = Math.max(10, Math.min(34, tall, free / THICK));
  const k = Math.max(1, Math.min(2, free / (THICK * s)));
  css.setProperty('--ggap', `${ggap}px`);
  css.setProperty('--s', s.toFixed(2));
  css.setProperty('--k', k.toFixed(3));
}

fit();
window.addEventListener('resize', fit);
document.fonts?.ready.then(fit);

function open(id: string, from: HTMLElement) {
  spines.forEach((s) => s.classList.toggle('is-out', s.dataset.open === id));
  openSheet(id, from);
}

spines.forEach((el) => el.addEventListener('click', () => open(el.dataset.open!, el)));

/* The sheet closes itself (its X, the scrim, Escape): the book goes back on the shelf. */
if (sheet)
  new MutationObserver(() => {
    if (sheet.hidden) spines.forEach((s) => s.classList.remove('is-out'));
  }).observe(sheet, { attributes: true, attributeFilter: ['hidden'] });

const want = new URLSearchParams(location.search).get('book');
const asked = want ? spines.find((s) => s.dataset.open === want) : undefined;
if (asked) open(want!, asked);
