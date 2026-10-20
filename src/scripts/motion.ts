import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getLenis, scrollToY } from './smooth';
import { steps, type Beats } from './steps';
import { nav } from './nav';
import { reveals } from './reveals';
import { keepPlace } from './place';
import { revisit } from './revisit';

gsap.registerPlugin(ScrollTrigger);
(window as unknown as { ScrollTrigger: typeof ScrollTrigger }).ScrollTrigger = ScrollTrigger;
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);
const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

/* ------------------------------------------------------------------ */
/* About: the parting                                                   */
/* ------------------------------------------------------------------ */

function about() {
  const pin = $('.about__pin');
  if (!pin) return;
  const words = $$('.about__w', pin);
  const n = words.length;

  const mm = gsap.matchMedia();

  mm.add('(min-width: 760px) and (prefers-reduced-motion: no-preference)', () => {
    pin.classList.add('is-live');
    const state = { gap: 0, fade: 0, mission: 0 };

    /* The pages part and fade by custom properties; the mission writes itself word by word. */
    const render = () => {
      pin.style.setProperty('--gap', state.gap.toFixed(4));
      pin.style.setProperty('--fade', state.fade.toFixed(4));
      const head = state.mission * (n + 5);
      words.forEach((w, i) => {
        const k = Math.max(0, Math.min(1, (head - i) / 5));
        w.style.opacity = k.toFixed(3);
        w.style.transform = `translateY(${(0.35 * (1 - k)).toFixed(3)}em)`;
      });
    };

    const tl = gsap.timeline({ paused: true, onUpdate: render });
    tl.to({}, { duration: 0.4 });
    tl.to(state, { gap: 1, duration: 1.1, ease: 'power2.inOut' });
    tl.to(state, { fade: 1, duration: 0.9, ease: 'power2.inOut' }, '<0.25');
    tl.to(state, { mission: 1, duration: 0.9, ease: 'none' }, '-=0.35');
    tl.to({}, { duration: 0.55 });

    const st = ScrollTrigger.create({
      trigger: pin,
      start: 'top top',
      end: () => `+=${Math.round(window.innerHeight * 2.4)}`,
      pin: true,
      scrub: true,
      animation: tl,
      invalidateOnRefresh: true,
      onRefresh: render,
    });
    render();

    return () => {
      st.kill();
      tl.kill();
      pin.style.removeProperty('--gap');
      pin.style.removeProperty('--fade');
      words.forEach((w) => {
        w.style.removeProperty('opacity');
        w.style.removeProperty('transform');
      });
      pin.classList.remove('is-live');
    };
  });
}

/* ------------------------------------------------------------------ */
/* Beats: the choreographed parts and their resting places              */
/* ------------------------------------------------------------------ */

/* Read live, so they follow resizes and refreshes. Two zones the page scrolls through
   automatically: the pull-back (banner at rest, banner pulled back) and the parting (pages
   meeting, mission written). Between them the scroll is free; the marks are where the keys rest
   on the way: the works headline, the lectures headline (set so the "all works" link still shows
   above it), the table of lectures down to its button, and the About headline (the "all
   lectures" link above it). */
function beats(): Beats {
  const pins = ScrollTrigger.getAll().filter((t) => t.pin);
  const pin = (sel: string) => pins.find((t) => (t.trigger as Element).matches(sel));
  /* Layout tops rather than client rects: the reveal tweens translate these blocks. */
  /* The first one shown: the books' "all works" link has a phone version and a shelf version. */
  const top = (sel: string) => {
    const el = $$(sel).find((e) => e.offsetParent !== null);
    if (!el) return NaN;
    let y = 0;
    for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) y += e.offsetTop;
    return y;
  };
  const bottom = (sel: string) => top(sel) + ($$(sel).find((e) => e.offsetParent !== null)?.offsetHeight ?? NaN);
  const navH = $('.nav')?.getBoundingClientRect().height ?? 0;
  const hero = pin('.hero');
  const parting = pin('.about__pin');
  const lectures = Math.min(top('#lectures'), top('.works__all') - navH - 24);
  return {
    zones: [
      hero ? [0, hero.end] : [],
      parting ? [parting.start, parting.end] : [],
    ],
    marks: [
      top('#books'),
      lectures,
      Math.max(lectures, bottom('.lectures__all') + 32 - window.innerHeight),
      Math.min(top('#about'), top('.lectures__all') - navH - 24),
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Landing: deep links and returns                                      */
/* ------------------------------------------------------------------ */

/* Taken before anything moves: where the reader left, if this load is a reload or a Back. The
   browser's own restoring is turned off, as it comes before the pins are built (revisit.ts). */
ScrollTrigger.clearScrollMemory('manual');
const left = revisit();

/* The browser jumps to a hash, or back to where it was, before the pinned parts have grown their
   spacers, so land again after each refresh in the first seconds, unless the reader has started
   scrolling. The place is kept for the next return from the start, unless one is waiting to be
   landed on: then once the reader has started scrolling, or the seconds are up. */
function landAt(where: (() => number) | null) {
  if (!left.where) left.keep();
  let manual = false;
  const events = ['wheel', 'touchstart', 'keydown'];
  const cancel = () => {
    manual = true;
    left.keep();
  };
  events.forEach((ev) => window.addEventListener(ev, cancel, { passive: true }));
  const land = () => {
    if (manual || !where) return;
    /* Lenis clamps scrollTo to a limit it re-measures on a debounce, so read the grown pins first. */
    getLenis()?.resize();
    scrollToY(where(), true);
  };
  ScrollTrigger.addEventListener('refresh', land);
  land();
  window.setTimeout(() => {
    ScrollTrigger.removeEventListener('refresh', land);
    events.forEach((ev) => window.removeEventListener(ev, cancel));
    left.keep();
  }, 4000);
}

/* Where the reader left wins over a hash: the hash is only where they once clicked. */
function land() {
  const id = location.hash.slice(1);
  const target = id ? document.getElementById(id) : null;
  landAt(left.where ?? (target ? () => target.getBoundingClientRect().top + window.scrollY - 24 : null));
}

/* ------------------------------------------------------------------ */

function init() {
  nav();
  reveals();
  about();
  ScrollTrigger.refresh();
  keepPlace('.hero, .about__pin');
  land();
  steps(beats);
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(init);
} else {
  init();
}

window.addEventListener('load', () => ScrollTrigger.refresh());
