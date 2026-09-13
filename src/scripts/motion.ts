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
/* Works: the tracking shot                                             */
/* ------------------------------------------------------------------ */

function works() {
  const pin = $('.works__pin');
  if (!pin) return;
  const camera = $('.works__camera', pin);
  const scene = $('.works__scene', pin);
  const books = $$('.works__book', pin);
  const caps = $$('.works__cap', pin);
  const dots = $$<HTMLButtonElement>('.works__dot', pin);
  const fill = $('.works__rail-fill', pin);
  const n = books.length;
  if (!camera || !scene || !n) return;

  /* Distance between stations, in px of depth, and where the focal book sits (vw, vh). */
  const D = 900;
  const focal = { x: 12, y: -3 };
  const slots = books.map((b) => ({
    x: parseFloat(b.dataset.x || '0'),
    y: parseFloat(b.dataset.y || '0'),
  }));

  const mm = gsap.matchMedia();

  mm.add('(min-width: 760px) and (prefers-reduced-motion: no-preference)', () => {
    pin.classList.add('is-3d');
    const cam = { x: focal.x - slots[0].x, y: focal.y - slots[0].y, z: 0 };
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
    };

    const render = () => {
      const vw = window.innerWidth / 100;
      const vh = window.innerHeight / 100;
      gsap.set(scene, { x: cam.x * vw, y: cam.y * vh, z: cam.z });
      books.forEach((b, i) => {
        const rel = cam.z - i * D; /* < 0: still ahead of the camera, > 0: already passed */
        const far = rel < 0 ? Math.min(1, -rel / (1.7 * D)) : 0;
        const passed = rel > 0 ? Math.min(1, rel / (0.5 * D)) : 0;
        const d = Math.max(far, passed);
        b.style.setProperty('--d', d.toFixed(3));
        const hidden = rel < -2.7 * D || passed >= 1;
        gsap.set(b, {
          x: slots[i].x * vw,
          y: slots[i].y * vh,
          z: -i * D,
          xPercent: -50,
          yPercent: -50,
          visibility: hidden ? 'hidden' : 'visible',
        });
      });
      const idx = Math.max(0, Math.min(n - 1, Math.round(cam.z / D)));
      if (idx !== active) setActive(idx);
      if (fill) gsap.set(fill, { scaleY: cam.z / ((n - 1) * D) });
    };

    const tl = gsap.timeline({ paused: true, onUpdate: render });
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        tl.to(cam, {
          x: focal.x - slots[i].x,
          y: focal.y - slots[i].y,
          z: i * D,
          duration: 1,
          ease: 'power2.inOut',
        });
      }
      tl.addLabel(`s${i}`);
      tl.to({}, { duration: i === 0 || i === n - 1 ? 0.4 : 0.55 });
    }

    const st = ScrollTrigger.create({
      trigger: pin,
      start: 'top top',
      end: () => `+=${Math.round(window.innerHeight * n * 0.95)}`,
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
        ry(nx * 7);
        rx(-ny * 5);
      };
      onLeave = () => {
        rx(0);
        ry(0);
      };
      pin.addEventListener('pointermove', onMove);
      pin.addEventListener('pointerleave', onLeave);
    }

    return () => {
      st.kill();
      tl.kill();
      dots.forEach((d) => d.removeEventListener('click', onDot));
      if (onMove) pin.removeEventListener('pointermove', onMove);
      if (onLeave) pin.removeEventListener('pointerleave', onLeave);
      gsap.set([scene, camera, ...books], { clearProps: 'all' });
      books.forEach((b) => b.style.removeProperty('--d'));
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

  const img = $('.about__photo img');
  if (img && !reduceMotion) {
    gsap.fromTo(
      img,
      { yPercent: -5, scale: 1.1 },
      {
        yPercent: 5,
        scale: 1.1,
        ease: 'none',
        scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'bottom top', scrub: true },
      }
    );
  }
}

/* ------------------------------------------------------------------ */

function init() {
  nav();
  reveals();
  works();
  about();
  ScrollTrigger.refresh();
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(init);
} else {
  init();
}

window.addEventListener('load', () => ScrollTrigger.refresh());
