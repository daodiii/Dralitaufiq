import { getLenis } from '../../smooth';
import { sheetOpen } from '../sheet';
import { settleIndex } from './settle';

/* Scroll stops for a sticky WebGL stage: the section is tall and its stage stays on
   screen; the scroll position picks the current stop; when the scroll comes to rest between stops
   it glides on to the nearest, or with `carry` on to the next in the direction of travel (one
   gesture, one stop); an opening beat (`lead` screens) plays out before the first stop and, left
   half way, carries on in the direction of travel. While `carried` says the page's own carry
   (steps.ts) moves it from stop to stop, the wheel and the keys are its, and a scroll that comes
   to rest is only reported. The section's height comes from CSS (--lead, --per, --n), so it is
   right before any script runs. */

export interface Stops {
  count: number;
  y(i: number): number;
  at(): { intro: number; u: number; i: number; past: boolean };
  go(i: number, done?: () => void): void;
  jump(i: number): void;
  inside(): boolean;
  measure(): void;
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/* With `carry`, a scroll that stops this near a stop goes back onto it (px). */
const TOL = 24;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function stops(o: {
  section: HTMLElement;
  stage: HTMLElement;
  count: number;
  lead: number;
  per: number;
  onRest?: (i: number) => void;
  /* 'vertical' leaves the left and right arrows to the page. */
  keys?: boolean | 'vertical';
  carry?: boolean;
  carried?: () => boolean;
}): Stops {
  const lenis = getLenis();
  const r = { top: 0, H: 1 };
  const measure = () => {
    r.H = o.stage.clientHeight || window.innerHeight;
    r.top = o.section.getBoundingClientRect().top + window.scrollY;
  };
  measure();
  window.addEventListener('resize', () => window.setTimeout(measure, 60));

  const y = (i: number) => r.top + (o.lead + o.per * i) * r.H;
  const last = () => y(o.count - 1);
  const at = () => {
    const s = window.scrollY;
    const intro = o.lead > 0 ? clamp((s - r.top) / (o.lead * r.H)) : 1;
    const u = o.per > 0 ? clamp((s - y(0)) / (o.per * r.H), 0, o.count - 1) : 0;
    return { intro, u, i: Math.round(u), past: s > last() + r.H * 0.5 };
  };
  const inside = () => window.scrollY > r.top - r.H * 0.5 && window.scrollY < last() + r.H * 0.5;

  function glide(to: number, duration: number, done?: () => void) {
    if (lenis) lenis.scrollTo(to, { duration, easing: easeInOut, force: true, onComplete: () => done?.() });
    else {
      window.scrollTo({ top: to, behavior: 'auto' });
      done?.();
    }
  }

  const go = (i: number, done?: () => void) => {
    const to = y(clamp(Math.round(i), 0, o.count - 1));
    const hops = Math.abs(to - window.scrollY) / (Math.max(o.per, 0.5) * r.H);
    glide(to, Math.min(2.6, 0.9 + hops * 0.22), done);
  };

  /* At once. Lenis reads a zero duration as "no duration" and eases by its lerp instead, which
     would pass through every stop on the way. */
  const jump = (i: number) => {
    lenis?.resize();
    if (lenis) lenis.scrollTo(y(i), { immediate: true, force: true });
    else window.scrollTo({ top: y(i), behavior: 'auto' });
  };

  let idle = 0;
  let dir = 1;
  let lastY = window.scrollY;
  function settle() {
    if (sheetOpen()) return;
    /* Never mid-glide: with slow frames the timer can fire inside one. */
    if (lenis?.isScrolling) {
      idle = window.setTimeout(settle, 170);
      return;
    }
    const s = window.scrollY;
    if (s < r.top - 2 || s > last() + 2) return;
    if (o.lead > 0 && s < y(0) - 1) {
      glide(dir > 0 ? y(0) : r.top, 1.1, () => (dir > 0 ? o.onRest?.(0) : undefined));
      return;
    }
    const { u } = at();
    const i = o.carry ? settleIndex(u, dir, TOL / (o.per * r.H), o.count - 1) : Math.round(u);
    if (Math.abs(s - y(i)) < 1.5) {
      o.onRest?.(i);
      return;
    }
    if (o.carried?.()) return;
    glide(y(i), 0.9, () => o.onRest?.(i));
  }

  const onScroll = () => {
    const s = window.scrollY;
    if (s !== lastY) dir = s > lastY ? 1 : -1;
    lastY = s;
    window.clearTimeout(idle);
    idle = window.setTimeout(settle, 170);
  };
  if (lenis) lenis.on('scroll', onScroll);
  else window.addEventListener('scroll', onScroll, { passive: true });

  const down = ['ArrowDown', 'PageDown'];
  const up = ['ArrowUp', 'PageUp'];
  if (o.keys !== 'vertical') {
    down.push('ArrowRight');
    up.push('ArrowLeft');
  }
  if (o.keys !== false)
    window.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || o.carried?.() || sheetOpen() || !inside() || e.altKey || e.ctrlKey || e.metaKey) return;
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return;
      /* Space on a focused button or link presses it. */
      if (e.key === ' ' && (e.target as HTMLElement | null)?.closest('button, a')) return;
      const { u } = at();
      const before = window.scrollY < y(0) - 1;
      let to: number;
      if (down.includes(e.key) || (e.key === ' ' && !e.shiftKey)) to = before ? 0 : Math.floor(u + 0.001) + 1;
      else if (up.includes(e.key) || (e.key === ' ' && e.shiftKey)) to = Math.ceil(u - 0.001) - 1;
      else return;
      if (to < 0 || to >= o.count) return;
      e.preventDefault();
      go(to);
    });

  return { count: o.count, y, at, go, jump, inside, measure };
}
