import gsap from 'gsap';
import type Lenis from 'lenis';
import type { VirtualScrollData } from 'lenis';
import { getLenis, setGestureHandler } from './smooth';

/* Beat-to-beat scrolling. The wheel and the trackpad scroll freely, so every choreography
   plays at the reader's own pace; once the input goes quiet the page carries on to the next
   beat in the direction of travel, or back onto the beat it is nearly on. A new gesture
   always takes over. Keys step a beat at a time; scrollbar drags and touch settle on the
   nearest beat once they stop. The beats are read from the provider on every move, so they
   follow resizes and ScrollTrigger refreshes. Phones and reduced motion keep native
   scrolling: their layouts are stacked and unpinned. */

const TOL = 40; /* beats closer than this merge; within this of a beat counts as standing on it */
const SNAP = 24; /* after wheel input, this close to a beat goes back onto it rather than on */
const QUIET = 140; /* ms without wheel input before the page carries on */
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function steps(beatsOf: () => number[]) {
  const lenis = getLenis();
  if (!lenis) return;
  const mm = gsap.matchMedia();

  mm.add('(min-width: 760px) and (prefers-reduced-motion: no-preference)', () => {
    let dir = 1;
    let quiet = 0;
    let wasNative = false;

    const limit = () => document.documentElement.scrollHeight - window.innerHeight;
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
    const next = (d: number, y: number, margin = TOL) => {
      const list = beats();
      return d > 0 ? list.find((b) => b > y + margin) : list.reverse().find((b) => b < y - margin);
    };
    const nearest = (y: number) => beats().reduce((best, b) => (Math.abs(b - y) < Math.abs(best - y) ? b : best));
    const go = (y: number | undefined) => {
      if (y === undefined) return;
      const duration = 0.8 + Math.min(1.6, Math.abs(y - lenis.scroll) / 1000);
      lenis.scrollTo(y, { duration, easing: ease });
    };

    /* Wheel and trackpad: let Lenis scroll, note the direction, and carry on once quiet.
       Touch is left to the browser and settles below. */
    const carryOn = () => {
      const y = lenis.targetScroll;
      const near = nearest(y);
      go(Math.abs(near - y) <= SNAP ? near : (next(dir, y, SNAP) ?? near));
    };
    setGestureHandler(({ deltaY, event }: VirtualScrollData) => {
      if (event.type.startsWith('touch') || (event as WheelEvent).ctrlKey || !deltaY) return true;
      dir = Math.sign(deltaY);
      window.clearTimeout(quiet);
      quiet = window.setTimeout(carryOn, QUIET);
      return true;
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      if (e.key === ' ' && t && /^(a|button)$/i.test(t.tagName)) return; /* space activates it */
      const y = lenis.scroll;
      let to: number | undefined;
      switch (e.key) {
        case 'ArrowDown':
        case 'PageDown':
          to = next(1, y);
          break;
        case 'ArrowUp':
        case 'PageUp':
          to = next(-1, y);
          break;
        case ' ':
          to = next(e.shiftKey ? -1 : 1, y);
          break;
        case 'Home':
          to = 0;
          break;
        case 'End':
          to = limit();
          break;
        default:
          return;
      }
      e.preventDefault();
      window.clearTimeout(quiet);
      go(to);
    };
    window.addEventListener('keydown', onKey);

    /* Lenis reports a scrollbar drag or a touch scroll as native and clears the state
       400ms after it stops; that is the moment to settle. */
    const onScroll = (l: Lenis) => {
      if (l.isScrolling === 'native') wasNative = true;
      else if (l.isScrolling === false && wasNative) {
        wasNative = false;
        const b = nearest(l.scroll);
        if (Math.abs(b - l.scroll) > TOL) go(b);
      }
    };
    lenis.on('scroll', onScroll);

    return () => {
      window.clearTimeout(quiet);
      setGestureHandler(null);
      window.removeEventListener('keydown', onKey);
      lenis.off('scroll', onScroll);
    };
  });
}
