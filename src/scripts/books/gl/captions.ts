import gsap from 'gsap';
import { reduceMotion } from '../../smooth';

/* One caption at a time (BookCaption.astro): the outgoing one lifts away as it fades, the next
   rises in a beat later. `dir` is the direction of travel (1 forward, -1 back). No blur: a CSS blur
   animating over a live WebGL canvas cost 33 to 67 ms a frame on this laptop (measured
   2026-09-23), a visible stutter while a book is moving. */
export function captions(root: ParentNode) {
  const items = Array.from(root.querySelectorAll<HTMLElement>('.bcap__item'));
  let current = -1;

  function out(el: HTMLElement | undefined, dir: number) {
    if (!el) return;
    el.classList.remove('is-live');
    gsap.to(el, { autoAlpha: 0, y: -10 * dir, duration: reduceMotion ? 0 : 0.35, ease: 'power2.in', overwrite: true });
  }

  function show(i: number, dir = 1) {
    if (i === current) return;
    out(items[current], dir);
    current = i;
    const el = items[i];
    if (!el) return;
    el.classList.add('is-live');
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 16 * dir },
      { autoAlpha: 1, y: 0, duration: reduceMotion ? 0 : 0.8, delay: reduceMotion ? 0 : 0.18, ease: 'power3.out', overwrite: true }
    );
  }

  function hide() {
    out(items[current], 1);
    current = -1;
  }

  return {
    show,
    hide,
    items,
    get current() {
      return current;
    },
  };
}
