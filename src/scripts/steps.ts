import gsap from 'gsap';
import type Lenis from 'lenis';
import type { VirtualScrollData } from 'lenis';
import { getLenis, setGestureHandler } from './smooth';

/* Beat-to-beat scrolling. A wheel or trackpad gesture, or a key, moves the page one beat
   and glides there; input is ignored until the glide lands. Scrollbar drags and touch
   scroll freely and settle on the nearest beat once they stop. The beats are read from
   the provider on every move, so they follow resizes and ScrollTrigger refreshes. Phones
   and reduced motion keep native scrolling: their layouts are stacked and unpinned. */

const TOL = 40; /* within this many px of a beat counts as standing on it */
const MIN_DELTA = 4; /* smaller wheel deltas are jitter or the tail of trackpad momentum */
const TAIL = 260; /* ms after a glide lands during which input is still ignored */
const ease = (t: number) => 1 - Math.pow(1 - t, 4);

export function steps(beatsOf: () => number[]) {
  const lenis = getLenis();
  if (!lenis) return;
  const mm = gsap.matchMedia();

  mm.add('(min-width: 760px) and (prefers-reduced-motion: no-preference)', () => {
    let lockUntil = 0;
    let lastDelta = 0;
    let lastTime = 0;
    let wasNative = false;

    const limit = () => document.documentElement.scrollHeight - window.innerHeight;
    const here = () => lenis.scroll;
    const beats = () => {
      const max = limit();
      const list = beatsOf()
        .filter((y) => Number.isFinite(y))
        .map((y) => Math.min(Math.max(0, Math.round(y)), max))
        .sort((a, b) => a - b);
      const out: number[] = [];
      for (const y of list) if (!out.length || y - out[out.length - 1] > TOL) out.push(y);
      return out;
    };
    const next = (dir: number) => {
      const y = here();
      const list = beats();
      return dir > 0 ? list.find((b) => b > y + TOL) : list.reverse().find((b) => b < y - TOL);
    };
    const nearest = () => {
      const y = here();
      return beats().reduce((best, b) => (Math.abs(b - y) < Math.abs(best - y) ? b : best));
    };
    const locked = () => performance.now() < lockUntil;
    const go = (y: number | undefined) => {
      if (y === undefined) return;
      const duration = 0.8 + Math.min(0.8, Math.abs(y - here()) / 2000);
      lockUntil = performance.now() + duration * 1000 + TAIL;
      lenis.scrollTo(y, { duration, easing: ease });
    };

    /* Wheel and trackpad. A gesture counts when its delta is not shrinking: momentum
       decays, a fresh flick rises. Touch is left to the browser and settles below. */
    setGestureHandler(({ deltaY, event }: VirtualScrollData) => {
      if (event.type.startsWith('touch') || (event as WheelEvent).ctrlKey) return true;
      if (event.cancelable) event.preventDefault();
      const now = performance.now();
      const d = Math.abs(deltaY);
      const fresh = d >= lastDelta || now - lastTime > 200;
      lastDelta = d;
      lastTime = now;
      if (locked() || d < MIN_DELTA || !fresh) return false;
      go(next(Math.sign(deltaY)));
      return false;
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      if (e.key === ' ' && t && /^(a|button)$/i.test(t.tagName)) return; /* space activates it */
      let y: number | undefined;
      switch (e.key) {
        case 'ArrowDown':
        case 'PageDown':
          y = next(1);
          break;
        case 'ArrowUp':
        case 'PageUp':
          y = next(-1);
          break;
        case ' ':
          y = next(e.shiftKey ? -1 : 1);
          break;
        case 'Home':
          y = 0;
          break;
        case 'End':
          y = limit();
          break;
        default:
          return;
      }
      e.preventDefault();
      if (!locked()) go(y);
    };
    window.addEventListener('keydown', onKey);

    /* Lenis reports a scrollbar drag or a touch scroll as native and clears the state
       400ms after it stops; that is the moment to settle. */
    const onScroll = (l: Lenis) => {
      if (l.isScrolling === 'native') wasNative = true;
      else if (l.isScrolling === false && wasNative) {
        wasNative = false;
        const b = nearest();
        if (!locked() && Math.abs(b - here()) > TOL) go(b);
      }
    };
    lenis.on('scroll', onScroll);

    return () => {
      setGestureHandler(null);
      window.removeEventListener('keydown', onKey);
      lenis.off('scroll', onScroll);
    };
  });
}
