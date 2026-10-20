import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis, { type VirtualScrollData } from 'lenis';
import { hermite } from './carry';

gsap.registerPlugin(ScrollTrigger);

export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | null = null;

/* Installed by steps.ts once the page's beats are known: it sees every wheel and touch
   gesture before Lenis does, and returning false drops the gesture. */
export type GestureHandler = (data: VirtualScrollData) => boolean;
let gesture: GestureHandler | null = null;

export function setGestureHandler(fn: GestureHandler | null) {
  gesture = fn;
}

/* lerp 0.16: one wheel notch settles in 0.56 s (0.35 s of it creeping) where 0.085, chosen while
   the books sections were carried, took 1.05 s (0.77 s creeping); replayed at 1536x960 @1.25. */
if (!reduceMotion) {
  lenis = new Lenis({
    lerp: 0.16,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.4,
    virtualScroll: (data) => {
      /* A sideways swipe over a row that scrolls sideways ([data-scroll-x]) is the browser's:
         Lenis would read its little vertical wobble as a scroll of the page and swallow it. */
      const e = data.event;
      if (e.type === 'wheel' && Math.abs(data.deltaX) > Math.abs(data.deltaY) && (e.target as Element).closest?.('[data-scroll-x]'))
        return false;
      return gesture ? gesture(data) : true;
    },
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis?.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);
}

declare global {
  interface Window {
    __lenis: Lenis | null;
  }
}
window.__lenis = lenis;

export function getLenis() {
  return lenis;
}

/* A trip by link or dot takes longer the further it goes (about 1.1 s for a screen, 1.7 s for four,
   2.3 s at most) and sets off gently: the old fixed 1.4 s ease-out left at four times the average
   speed, which for a link from the top to the lectures (7,700 px) was 416 px in the first frame
   and 20,000 px/s at its fastest, against 120 px and 10,000 px/s now. */
const trip = hermite(1.6);

export function scrollToY(y: number, immediate = false) {
  if (lenis) {
    /* A jump needs immediate: Lenis reads duration 0 as no duration and glides there on its lerp. */
    if (immediate) lenis.scrollTo(y, { immediate: true, force: true });
    else {
      const distance = Math.abs(y - lenis.animatedScroll);
      lenis.scrollTo(y, { duration: Math.min(2.3, 0.55 + 0.6 * Math.sqrt(distance / 1000)), easing: trip });
    }
  } else {
    window.scrollTo({ top: y, behavior: immediate || reduceMotion ? 'auto' : 'smooth' });
  }
}

export function scrollToEl(el: HTMLElement, offset = 0) {
  const y = el.getBoundingClientRect().top + window.scrollY + offset;
  scrollToY(y);
}

export function lockScroll(lock: boolean) {
  if (lenis) {
    lock ? lenis.stop() : lenis.start();
  } else {
    document.documentElement.style.overflow = lock ? 'hidden' : '';
  }
}

/* Smooth anchor navigation for same-page links. */
document.addEventListener('click', (event) => {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
  if (!link) return;
  const id = link.getAttribute('href')!.slice(1);
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  scrollToEl(target, 0);
  history.replaceState(null, '', `#${id}`);
});
