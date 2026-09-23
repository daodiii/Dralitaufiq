import gsap from 'gsap';
import { lockScroll, reduceMotion } from '../smooth';

/* The side sheet with a book's full text (BookSheet.astro). */

const sheet = document.querySelector<HTMLElement>('.sheet');
const panel = sheet?.querySelector<HTMLElement>('.sheet__panel');
const body = sheet?.querySelector<HTMLElement>('.sheet__body');
const scrim = sheet?.querySelector<HTMLElement>('.sheet__scrim');
let back: HTMLElement | null = null;
let open = false;

export function openSheet(id: string, from?: HTMLElement | null) {
  const tpl = document.getElementById(`sheet-${id}`) as HTMLTemplateElement | null;
  if (!sheet || !panel || !body || !scrim || !tpl) return;
  body.replaceChildren(tpl.content.cloneNode(true));
  const book = body.querySelector<HTMLElement>('.sheet__book')!;
  panel.style.setProperty('--accent', book.style.getPropertyValue('--accent'));
  panel.style.setProperty('--sheet-bg', `oklch(from ${book.style.getPropertyValue('--accent')} 0.972 calc(c * 0.12) h)`);
  panel.scrollTop = 0;
  back = from ?? (document.activeElement as HTMLElement | null);
  sheet.hidden = false;
  open = true;
  lockScroll(true);
  if (reduceMotion) {
    gsap.set(scrim, { opacity: 1 });
    gsap.set(panel, { xPercent: 0 });
  } else {
    gsap.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
    gsap.fromTo(panel, { xPercent: 100 }, { xPercent: 0, duration: 0.8, ease: 'expo.out' });
    gsap.fromTo(book.children, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.04, ease: 'power3.out', delay: 0.15 });
  }
  sheet.querySelector<HTMLButtonElement>('.sheet__close')?.focus({ preventScroll: true });
}

export function closeSheet() {
  if (!sheet || !panel || !scrim || !open) return;
  open = false;
  const done = () => {
    sheet.hidden = true;
    lockScroll(false);
    back?.focus({ preventScroll: true });
  };
  if (reduceMotion) {
    done();
    return;
  }
  gsap.to(scrim, { opacity: 0, duration: 0.4, ease: 'power2.in' });
  gsap.to(panel, { xPercent: 100, duration: 0.55, ease: 'power3.in', onComplete: done });
}

export const sheetOpen = () => open;

sheet?.querySelector('.sheet__close')?.addEventListener('click', closeSheet);
scrim?.addEventListener('click', closeSheet);
/* Capture, so Escape closes the sheet before the page's own keys see it. */
window.addEventListener(
  'keydown',
  (e) => {
    if (open && e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeSheet();
    }
  },
  true
);
