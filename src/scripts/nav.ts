import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { lockScroll } from './smooth';

gsap.registerPlugin(ScrollTrigger);

/* The bar: tighter once the page scrolls, the phone menu, and the link of the section in view.
   On the home page the hero's intro brings the bar in; other pages call showNav(). */
export function nav() {
  const bar = document.querySelector<HTMLElement>('.nav');
  if (!bar) return;

  const sync = (self: ScrollTrigger) => bar.classList.toggle('is-scrolled', self.scroll() > 40);
  ScrollTrigger.create({ start: 40, onUpdate: sync, onRefresh: sync });

  const toggle = bar.querySelector<HTMLElement>('.nav__toggle');
  const menu = bar.querySelector<HTMLElement>('.nav__menu');
  if (toggle && menu) {
    /* The menu covers the page; the page is held still under it, so closing it shows the place left. */
    const set = (open: boolean) => {
      bar.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      lockScroll(open);
    };
    const close = () => set(false);
    toggle.addEventListener('click', () => set(!bar.classList.contains('is-open')));
    menu.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a')) close();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && bar.classList.contains('is-open')) {
        close();
        toggle.focus();
      }
    });
    /* A phone turned sideways or a window widened leaves the menu behind as the bar's own links. */
    window.matchMedia('(min-width: 760px)').addEventListener('change', (e) => {
      if (e.matches && bar.classList.contains('is-open')) close();
    });
  }

  bar.querySelectorAll<HTMLAnchorElement>('.nav__menu a[href^="#"]').forEach((link) => {
    const id = link.getAttribute('href')!.slice(1);
    const section = document.getElementById(id);
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 45%',
      end: 'bottom 45%',
      onToggle: (self) => link.classList.toggle('is-active', self.isActive),
    });
  });
}

export function showNav() {
  const bar = document.querySelector<HTMLElement>('.nav');
  if (bar) gsap.to(bar, { autoAlpha: 1, duration: 0.9, ease: 'power2.out' });
}
