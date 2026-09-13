import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { reduceMotion, scrollToY } from './smooth';

gsap.registerPlugin(ScrollTrigger, SplitText);
(window as unknown as { ScrollTrigger: typeof ScrollTrigger }).ScrollTrigger = ScrollTrigger;
ScrollTrigger.config({ ignoreMobileResize: true });

const finePointer = window.matchMedia('(pointer: fine)').matches;
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);
const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

/* ------------------------------------------------------------------ */
/* Navigation                                                           */
/* ------------------------------------------------------------------ */

function nav() {
  const bar = $('.nav');
  if (!bar) return;

  const sync = (self: ScrollTrigger) => bar.classList.toggle('is-scrolled', self.scroll() > 40);
  ScrollTrigger.create({ start: 40, onUpdate: sync, onRefresh: sync });

  const toggle = $('.nav__toggle');
  const menu = $('.nav__menu');
  if (toggle && menu) {
    const close = () => {
      bar.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    };
    toggle.addEventListener('click', () => {
      const open = bar.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    menu.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a')) close();
    });
  }

  $$<HTMLAnchorElement>('.nav__menu a[href^="#"]').forEach((link) => {
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

/* ------------------------------------------------------------------ */
/* Generic scroll reveals                                               */
/* ------------------------------------------------------------------ */

function reveals() {
  if (reduceMotion) {
    gsap.set('[data-reveal]', { autoAlpha: 1 });
    gsap.set('[data-split]', { visibility: 'visible' });
    return;
  }

  $$('[data-reveal]').forEach((el) => {
    const delay = parseFloat(el.dataset.delay || '0');
    const y = parseFloat(el.dataset.y || '26');
    gsap.fromTo(
      el,
      { autoAlpha: 0, y },
      {
        autoAlpha: 1,
        y: 0,
        duration: 1.3,
        delay,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      }
    );
  });

  $$('[data-split]').forEach((el) => {
    const split = new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'line' });
    gsap.set(el, { visibility: 'visible' });
    gsap.from(split.lines, {
      yPercent: 110,
      duration: 1.3,
      stagger: 0.09,
      ease: 'power4.out',
      scrollTrigger: { trigger: el, start: 'top 86%', once: true },
    });
  });

  $$('[data-stagger]').forEach((group) => {
    const items = Array.from(group.children) as HTMLElement[];
    gsap.fromTo(
      items,
      { autoAlpha: 0, y: 20 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 1.1,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: group, start: 'top 88%', once: true },
      }
    );
  });
}

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

    const render = () => {
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

    const jump = (i: number) => {
      const t = tl.labels[`s${i}`] ?? 0;
      scrollToY(st.start + (t / tl.duration()) * (st.end - st.start) + 2);
    };
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
      };
      onLeave = () => {
        rx(0);
        ry(0);
      };
      pin.addEventListener('pointermove', onMove);
      pin.addEventListener('pointerleave', onLeave);
    }

    return () => {
      ScrollTrigger.removeEventListener('refreshInit', measure);
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
/* About: the road from Madinah to Oslo                                 */
/* ------------------------------------------------------------------ */

function about() {
  const journey = $('.journey');
  const pathEl = journey?.querySelector<SVGPathElement>('.journey__path') ?? null;
  if (journey && pathEl) {
    const pts = Array.from(journey.querySelectorAll<SVGCircleElement>('.journey__pt'));
    const stops = $$('.journey__stop', journey);
    const light = (p: number, fractions: number[]) => {
      pts.forEach((c, i) => c.classList.toggle('is-on', p >= fractions[i] - 0.004));
      stops.forEach((s, i) => s.classList.toggle('is-on', p >= fractions[i] - 0.004));
    };
    const len = pathEl.getTotalLength();
    if (!len || reduceMotion) {
      light(1, pts.map(() => 0));
    } else {
      /* The road runs left to right, so a stop's share of the path follows from its x. */
      const fractions = pts.map((c) => {
        const cx = parseFloat(c.getAttribute('cx') || '0');
        let lo = 0;
        let hi = len;
        for (let k = 0; k < 24; k++) {
          const mid = (lo + hi) / 2;
          if (pathEl.getPointAtLength(mid).x < cx) lo = mid;
          else hi = mid;
        }
        return lo / len;
      });
      gsap.set(pathEl, { strokeDasharray: len, strokeDashoffset: len });
      gsap.to(pathEl, {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: journey,
          start: 'top 78%',
          end: 'bottom 45%',
          scrub: 0.5,
          onUpdate: (self) => light(self.progress, fractions),
        },
      });
    }
  }
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
    if (!manual) scrollToY(target.getBoundingClientRect().top + window.scrollY - 24, true);
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
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(init);
} else {
  init();
}

window.addEventListener('load', () => ScrollTrigger.refresh());
