import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getLenis, scrollToY } from './smooth';
import { steps, type Beats } from './steps';
import { nav } from './nav';
import { reveals } from './reveals';

gsap.registerPlugin(ScrollTrigger);
(window as unknown as { ScrollTrigger: typeof ScrollTrigger }).ScrollTrigger = ScrollTrigger;
ScrollTrigger.config({ ignoreMobileResize: true });

const finePointer = window.matchMedia('(pointer: fine)').matches;
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);
const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

/* ------------------------------------------------------------------ */
/* Works: the wall                                                      */
/* ------------------------------------------------------------------ */

/* Grid units, matching Works.astro: tile, cell (tile + label), gap. */
const TW = 380;
const TH = 570;
const CELL = 614;
const GAP = 26;
const HOLD = 0.55;
/* Where the featured cover sits on screen (fractions of the stage). */
const FX = 0.4;
const FY = 0.5;

/* Scroll positions of the wall's stops, for the beats; set while the wall is live. */
let wallStops: () => number[] = () => [];

function works() {
  const pin = $('.works__pin');
  if (!pin) return;
  const camera = $('.works__camera', pin);
  const grid = $('.works__grid', pin);
  const tiles = $$('.works__tile', pin);
  const caps = $$('.works__cap', pin);
  const capsBox = $('.works__caps', pin);
  const dots = $$<HTMLButtonElement>('.works__dot', pin);
  const fill = $('.works__rail-fill', pin);
  const cols = parseInt(getComputedStyle(pin).getPropertyValue('--cols') || '6', 10);
  if (!camera || !grid || !tiles.length) return;

  const rows = Math.ceil(tiles.length / cols);
  const GW = cols * TW + (cols - 1) * GAP;
  const GH = rows * CELL + (rows - 1) * GAP;
  const stops: number[] = [];
  tiles.forEach((t, i) => {
    const s = parseInt(t.dataset.stop ?? '-1', 10);
    if (s >= 0) stops[s] = i;
  });
  const n = stops.length;
  const centre = (i: number) => ({
    x: (i % cols) * (TW + GAP) + TW / 2,
    y: Math.floor(i / cols) * (CELL + GAP) + TH / 2,
  });

  const mm = gsap.matchMedia();

  mm.add('(min-width: 760px) and (prefers-reduced-motion: no-preference)', () => {
    pin.classList.add('is-3d');
    let sw = pin.clientWidth;
    let sh = pin.clientHeight;
    const measure = () => {
      sw = pin.clientWidth;
      sh = pin.clientHeight;
    };
    const gutter = () => Math.max(20, Math.min(80, sw * 0.045));

    /* The camera is the grid point under the focal spot plus a scale, so travel and
       zoom are independent and the flight can lift between stops. */
    const fit = (s: number, x: number, y: number) => ({ s, gx: (FX * sw - x) / s, gy: (FY * sh - y) / s });
    const wide = () => {
      const s = Math.max(sw / GW, sh / GH) * 1.04;
      return fit(s, (sw - GW * s) / 2, (sh - GH * s) / 2);
    };
    const index = () => {
      const g = gutter();
      const s = Math.min((sw - 2 * g) / GW, (sh - 2 * g - 48) / GH);
      return fit(s, (sw - GW * s) / 2, (sh - GH * s) / 2 + 28);
    };
    const stop = (k: number) => {
      const c = centre(stops[k]);
      return { s: (0.66 * sh) / TH, gx: c.x, gy: c.y };
    };
    const steps = (a: number, b: number) => {
      const ca = stops[a];
      const cb = stops[b];
      return Math.abs((ca % cols) - (cb % cols)) + Math.abs(Math.floor(ca / cols) - Math.floor(cb / cols));
    };

    const cam = { ...wide() };
    const light = { amb: 0, out: 0, dim: 0 };
    const marks: number[] = [];
    let active = -1;

    const setActive = (i: number) => {
      const first = active < 0;
      active = i;
      caps.forEach((c, k) => {
        const kids = Array.from(c.children) as HTMLElement[];
        if (k === i) {
          c.classList.add('is-active');
          gsap.killTweensOf([c, ...kids]);
          gsap.set(c, { autoAlpha: 1 });
          gsap.fromTo(
            kids,
            { autoAlpha: 0, y: 18 },
            { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.06, ease: 'power3.out', delay: first ? 0 : 0.12 }
          );
        } else if (c.classList.contains('is-active')) {
          c.classList.remove('is-active');
          gsap.killTweensOf([c, ...kids]);
          gsap.to(c, { autoAlpha: 0, duration: 0.3, ease: 'power2.in' });
        }
      });
      dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
      tiles.forEach((t, k) => t.classList.toggle('is-focus', i >= 0 && k === stops[i]));
    };

    /* Hover is done by hand: Chrome's :hover flickers on covers inside the tilting camera,
       while hit-testing is steady. While the wall is in flight the covers ignore the pointer,
       or each one would flash to colour as it slid under a still cursor. */
    let hovered: HTMLElement | null = null;
    const hover = (el: HTMLElement | null) => {
      if (el === hovered) return;
      hovered?.classList.remove('is-hover');
      hovered = el;
      hovered?.classList.add('is-hover');
    };
    let still = 0;
    const moving = () => {
      hover(null);
      pin.classList.add('is-moving');
      window.clearTimeout(still);
      still = window.setTimeout(() => pin.classList.remove('is-moving'), 160);
    };

    const render = () => {
      moving();
      const tx = FX * sw - cam.gx * cam.s;
      const ty = FY * sh - cam.gy * cam.s;
      gsap.set(grid, { x: tx, y: ty, scale: cam.s });
      /* A torch of colour around the focal point; at a stop the rest of the wall recedes
         into paper so the caption reads; at the end the whole wall is lit. */
      const R = 0.62 * sh;
      const fx = FX * sw;
      const fy = FY * sh;
      const focus = active >= 0 ? stops[active] : -1;
      for (let i = 0; i < tiles.length; i++) {
        const c = centre(i);
        const d = Math.hypot(tx + c.x * cam.s - fx, ty + c.y * cam.s - fy);
        let t = Math.max(0, 1 - d / R);
        t = t * t * (3 - 2 * t) * light.amb;
        if (i === focus) t = Math.max(t, light.dim);
        tiles[i].style.setProperty('--lit', Math.max(t, light.out).toFixed(3));
      }
      grid.style.setProperty('--lbl', light.out.toFixed(3));
      grid.style.setProperty('--veil', (0.38 + 0.5 * light.dim).toFixed(3));
      capsBox?.style.setProperty('--spot', light.dim.toFixed(3));

      const time = tl.time();
      let idx = -1;
      for (let k = 0; k < n; k++) {
        if (time >= marks[k] - 0.3 && time <= marks[k] + HOLD + 0.12) idx = k;
      }
      if (idx !== active) setActive(idx);
      if (fill && n > 1) {
        const p = (time - marks[0]) / (marks[n - 1] - marks[0]);
        gsap.set(fill, { scaleY: Math.max(0, Math.min(1, p)) });
      }
    };

    const tl = gsap.timeline({ paused: true, onUpdate: render });
    tl.to({}, { duration: 0.35 });
    for (let k = 0; k < n; k++) {
      const at = tl.duration();
      if (k === 0) {
        tl.fromTo(
          cam,
          { gx: () => wide().gx, gy: () => wide().gy, s: () => wide().s },
          { gx: () => stop(0).gx, gy: () => stop(0).gy, s: () => stop(0).s, duration: 1.1, ease: 'power2.inOut' },
          at
        );
        tl.to(light, { amb: 1, duration: 0.8, ease: 'power2.out' }, at + 0.2);
        tl.to(light, { dim: 1, duration: 0.4, ease: 'power2.inOut' }, at + 0.6);
      } else {
        /* Between stops the camera lifts and settles, the way a map flies. */
        const dip = 1 - Math.min(0.45, 0.1 + 0.07 * steps(k - 1, k));
        tl.to(light, { dim: 0, duration: 0.35, ease: 'power2.inOut' }, at);
        tl.to(cam, { gx: () => stop(k).gx, gy: () => stop(k).gy, duration: 1, ease: 'power2.inOut' }, at);
        tl.to(cam, { s: () => stop(k).s * dip, duration: 0.5, ease: 'power2.out' }, at);
        tl.to(cam, { s: () => stop(k).s, duration: 0.5, ease: 'power2.in' }, at + 0.5);
        tl.to(light, { dim: 1, duration: 0.4, ease: 'power2.inOut' }, at + 0.55);
      }
      marks[k] = tl.duration();
      tl.addLabel(`s${k}`);
      tl.to({}, { duration: HOLD });
    }
    const out = tl.duration();
    tl.to(light, { dim: 0, duration: 0.5, ease: 'power2.inOut' }, out);
    tl.to(cam, { gx: () => index().gx, gy: () => index().gy, s: () => index().s, duration: 1.3, ease: 'power2.inOut' }, out);
    tl.to(light, { out: 1, duration: 0.9, ease: 'power2.inOut' }, out + 0.3);
    tl.to({}, { duration: 0.45 });

    ScrollTrigger.addEventListener('refreshInit', measure);
    const st = ScrollTrigger.create({
      trigger: pin,
      start: 'top top',
      end: () => `+=${Math.round(window.innerHeight * (n + 1.7))}`,
      pin: true,
      scrub: 1,
      animation: tl,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onRefresh: render,
    });
    render();

    const at = (i: number) => st.start + ((tl.labels[`s${i}`] ?? 0) / tl.duration()) * (st.end - st.start);
    const jump = (i: number) => scrollToY(at(i) + 2);
    wallStops = () => stops.map((_, i) => at(i));
    const onDot = (e: Event) => jump(parseInt((e.currentTarget as HTMLElement).dataset.go || '0', 10));
    dots.forEach((d) => d.addEventListener('click', onDot));

    let onMove: ((e: PointerEvent) => void) | null = null;
    let onLeave: (() => void) | null = null;
    if (finePointer) {
      const rx = gsap.quickTo(camera, 'rotationX', { duration: 1.4, ease: 'power3.out' });
      const ry = gsap.quickTo(camera, 'rotationY', { duration: 1.4, ease: 'power3.out' });
      onMove = (e) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        ry(nx * 4);
        rx(-ny * 3);
        const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        hover(pin.classList.contains('is-moving') ? null : (under?.closest<HTMLElement>('.works__tile') ?? null));
      };
      onLeave = () => {
        rx(0);
        ry(0);
        hover(null);
      };
      pin.addEventListener('pointermove', onMove);
      pin.addEventListener('pointerleave', onLeave);
    }

    return () => {
      ScrollTrigger.removeEventListener('refreshInit', measure);
      window.clearTimeout(still);
      hover(null);
      pin.classList.remove('is-moving');
      wallStops = () => [];
      st.kill();
      tl.kill();
      dots.forEach((d) => d.removeEventListener('click', onDot));
      if (onMove) pin.removeEventListener('pointermove', onMove);
      if (onLeave) pin.removeEventListener('pointerleave', onLeave);
      gsap.set([grid, camera], { clearProps: 'all' });
      grid.style.removeProperty('--lbl');
      grid.style.removeProperty('--veil');
      capsBox?.style.removeProperty('--spot');
      tiles.forEach((t) => {
        t.style.removeProperty('--lit');
        t.classList.remove('is-focus');
      });
      caps.forEach((c) => {
        c.classList.remove('is-active');
        gsap.set([c, ...Array.from(c.children)], { clearProps: 'all' });
      });
      dots.forEach((d) => d.classList.remove('is-active'));
      pin.classList.remove('is-3d');
    };
  });
}

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
      scrub: 1,
      animation: tl,
      anticipatePin: 1,
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

/* Read live, so they follow resizes and refreshes. Three zones the page scrolls through
   automatically: the pull-back (banner at rest, banner pulled back), the wall (wide, its
   stops, the index) and the parting (pages meeting, mission written). Between them the
   scroll is free; the marks are where the keys rest on the way: the works headline, the
   lectures headline (set so the "all works" link still shows above it), the table of
   lectures down to its button, and the About headline (the "all lectures" link above it). */
function beats(): Beats {
  const pins = ScrollTrigger.getAll().filter((t) => t.pin);
  const pin = (sel: string) => pins.find((t) => (t.trigger as Element).matches(sel));
  /* Layout tops rather than client rects: the reveal tweens translate these blocks. */
  const top = (sel: string) => {
    const el = $(sel);
    if (!el) return NaN;
    let y = 0;
    for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) y += e.offsetTop;
    return y;
  };
  const bottom = (sel: string) => top(sel) + ($(sel)?.offsetHeight ?? NaN);
  const navH = $('.nav')?.getBoundingClientRect().height ?? 0;
  const hero = pin('.hero');
  const wall = pin('.works__pin');
  const parting = pin('.about__pin');
  const lectures = Math.min(top('#lectures'), top('.works__all') - navH - 24);
  return {
    zones: [
      hero ? [0, hero.end] : [],
      wall ? [wall.start, ...wallStops(), wall.end] : [],
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
/* Deep links                                                           */
/* ------------------------------------------------------------------ */

/* The browser jumps to a hash before the pinned hero has grown its spacer, so land
   again after each refresh in the first seconds, unless the reader has started scrolling. */
function landOnHash() {
  const id = location.hash.slice(1);
  const target = id ? document.getElementById(id) : null;
  if (!target) return;
  let manual = false;
  const cancel = () => (manual = true);
  const events = ['wheel', 'touchstart', 'keydown'];
  events.forEach((ev) => window.addEventListener(ev, cancel, { passive: true }));
  const land = () => {
    if (manual) return;
    /* Lenis clamps scrollTo to a limit it re-measures on a debounce, so read the grown pins first. */
    getLenis()?.resize();
    scrollToY(target.getBoundingClientRect().top + window.scrollY - 24, true);
  };
  ScrollTrigger.addEventListener('refresh', land);
  land();
  window.setTimeout(() => {
    ScrollTrigger.removeEventListener('refresh', land);
    events.forEach((ev) => window.removeEventListener(ev, cancel));
  }, 4000);
}

/* ------------------------------------------------------------------ */

function init() {
  nav();
  reveals();
  works();
  about();
  ScrollTrigger.refresh();
  landOnHash();
  steps(beats);
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(init);
} else {
  init();
}

window.addEventListener('load', () => ScrollTrigger.refresh());
