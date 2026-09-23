import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis, { type VirtualScrollData } from 'lenis';

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

if (!reduceMotion) {
  lenis = new Lenis({
    lerp: 0.085,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.4,
    virtualScroll: (data) => (gesture ? gesture(data) : true),
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

export function scrollToY(y: number, immediate = false) {
  if (lenis) {
    /* A jump needs immediate: Lenis reads duration 0 as no duration and glides there on its lerp. */
    if (immediate) lenis.scrollTo(y, { immediate: true, force: true });
    else lenis.scrollTo(y, { duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
  } else {
    window.scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' });
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
