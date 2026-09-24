import gsap from 'gsap';
import type Lenis from 'lenis';
import type { VirtualScrollData } from 'lenis';
import { getLenis, setGestureHandler } from './smooth';

/* Scrolling that is free between the choreographed parts and automatic inside them. Each
   part (the pull-back, the wall, the parting) is a zone with its beats; the wheel and the
   trackpad scroll freely everywhere, and once the input goes quiet inside a zone the page
   carries on to the zone's next beat in the direction of travel, or back onto the beat it
   is nearly on. Outside a zone nothing intervenes. A new gesture always takes over. Keys
   step through every beat and mark; scrollbar drags and touch settle on the nearest beat
   of the zone they stop in. Everything is read from the provider on each move, so it
   follows resizes and ScrollTrigger refreshes. Phones and reduced motion keep native
   scrolling: their layouts are stacked and unpinned. */

export interface Beats {
  zones: number[][]; /* each an ordered run of scroll positions, first to last beat */
  marks: number[]; /* resting places between zones, for the keys */
}

const TOL = 40; /* beats closer than this merge; within this of a beat counts as standing on it */
const SNAP = 24; /* after wheel input, this close to a beat goes back onto it rather than on */
const QUIET = 140; /* ms without wheel input before the page carries on */
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function steps(read: () => Beats) {
  const lenis = getLenis();
  if (!lenis) return;
  const mm = gsap.matchMedia();

  mm.add('(min-width: 760px) and (prefers-reduced-motion: no-preference)', () => {
    let dir = 1;
    let quiet = 0;
    let wasNative = false;

    const limit = () => document.documentElement.scrollHeight - window.innerHeight;
    const clean = (list: number[]) => {
      const max = limit();
      const sorted = list
        .filter((y) => Number.isFinite(y))
        .map((y) => Math.min(Math.max(0, Math.round(y)), max))
        .sort((a, b) => a - b);
      const out: number[] = [];
      for (const y of sorted) if (!out.length || y - out[out.length - 1] > TOL) out.push(y);
      return out;
    };
    const zones = () => read().zones.map(clean).filter((z) => z.length > 1);
    const zoneAt = (y: number) => zones().find((z) => y >= z[0] - SNAP && y <= z[z.length - 1] + SNAP);
    const every = () => {
      const b = read();
      return clean([0, limit(), ...b.marks, ...b.zones.flat()]);
    };
    const nearest = (list: number[], y: number) =>
      list.reduce((best, b) => (Math.abs(b - y) < Math.abs(best - y) ? b : best));
    const ahead = (list: number[], d: number, y: number, margin: number) =>
      d > 0 ? list.find((b) => b > y + margin) : [...list].reverse().find((b) => b < y - margin);
    const go = (y: number | undefined) => {
      if (y === undefined) return;
      const duration = 0.8 + Math.min(1.6, Math.abs(y - lenis.scroll) / 1000);
      lenis.scrollTo(y, { duration, easing: ease });
    };

    /* Wheel and trackpad: let Lenis scroll, note the direction, and carry on once quiet
       if the page is inside a zone. Touch is left to the browser and settles below. */
    const carryOn = () => {
      const y = lenis.targetScroll;
      const zone = zoneAt(y);
      if (!zone) return;
      const near = nearest(zone, y);
      if (Math.abs(near - y) <= SNAP) {
        if (Math.round(near) !== Math.round(y)) go(near);
        return;
      }
      go(ahead(zone, dir, y, SNAP) ?? near);
    };
    setGestureHandler(({ deltaY, event }: VirtualScrollData) => {
      if (event.type.startsWith('touch') || (event as WheelEvent).ctrlKey || !deltaY) return true;
      dir = Math.sign(deltaY);
      window.clearTimeout(quiet);
      quiet = window.setTimeout(carryOn, QUIET);
      return true;
    });

    const onKey = (e: KeyboardEvent) => {
      /* Taken already: the arrow keys walking a stack of lectures. */
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      if (e.key === ' ' && t && /^(a|button)$/i.test(t.tagName)) return; /* space activates it */
      const y = lenis.scroll;
      let to: number | undefined;
      switch (e.key) {
        case 'ArrowDown':
        case 'PageDown':
          to = ahead(every(), 1, y, TOL);
          break;
        case 'ArrowUp':
        case 'PageUp':
          to = ahead(every(), -1, y, TOL);
          break;
        case ' ':
          to = ahead(every(), e.shiftKey ? -1 : 1, y, TOL);
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
       400ms after it stops; that is the moment to settle, if it stopped inside a zone. */
    const onScroll = (l: Lenis) => {
      if (l.isScrolling === 'native') wasNative = true;
      else if (l.isScrolling === false && wasNative) {
        wasNative = false;
        const zone = zoneAt(l.scroll);
        if (!zone) return;
        const b = nearest(zone, l.scroll);
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
