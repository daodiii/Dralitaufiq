/**
 * The shelf on the books page (components/books/Shelf.astro): sizes the spines to the screen, and
 * opens a book's sheet on a click, or straight away for a link to one book (?book=<id>).
 */
import { nav, showNav } from '../nav';
import { reveals } from '../reveals';
import { openSheet } from './sheet';
import { spineName } from './spine-name';
import { fitSpines } from './spine-fit';

nav();
showNav();
reveals();

const room = document.querySelector<HTMLElement>('.shelf__room');
const spines = Array.from(document.querySelectorAll<HTMLButtonElement>('.shelf .spine'));
const sheet = document.querySelector<HTMLElement>('.sheet');
const css = document.documentElement.style;

/* The tallest book in cm (the Arabic editions); every height is drawn true to it. */
const TALLEST = Math.max(...spines.map((s) => parseFloat(s.style.getPropertyValue('--h'))));

/* --s px per cm: the tallest book fills what is left of the screen under the heading (less if the
   shelf would not fit the width, a tablet held upright). The titles' standard size follows it;
   the thicknesses are then widened alike until the shelf fills the width (spine-fit.ts). */
function fit() {
  if (!room || !spines.length) return;
  const ggap = Math.round(Math.max(24, room.clientWidth * 0.03));
  const free = room.clientWidth - 2 * ggap - spines.length - 64;
  const top = room.getBoundingClientRect().top + window.scrollY;
  const pad = parseFloat(getComputedStyle(room).paddingTop) || 0;
  /* Under the shelf: its board and the title line. */
  const tall = (window.innerHeight - top - pad - 110) / TALLEST;
  css.setProperty('--ggap', `${ggap}px`);
  fitSpines({
    holder: document.documentElement,
    spines,
    width: free,
    maxS: Math.max(10, Math.min(34, tall)),
    font: (s) => Math.min(20, Math.max(13, s * 0.78)),
    fill: true,
  });
}

fit();
window.addEventListener('resize', fit);
document.fonts?.ready.then(fit);

function open(id: string, from: HTMLElement) {
  spines.forEach((s) => s.classList.toggle('is-out', s.dataset.open === id));
  openSheet(id, from);
}

spines.forEach((el) => el.addEventListener('click', () => open(el.dataset.open!, el)));
spineName(document.querySelector('.shelf__case'), document.querySelector('.shelf__name'));

/* The sheet closes itself (its X, the scrim, Escape): the book goes back on the shelf. */
if (sheet)
  new MutationObserver(() => {
    if (sheet.hidden) spines.forEach((s) => s.classList.remove('is-out'));
  }).observe(sheet, { attributes: true, attributeFilter: ['hidden'] });

const want = new URLSearchParams(location.search).get('book');
const asked = want ? spines.find((s) => s.dataset.open === want) : undefined;
if (asked) open(want!, asked);
