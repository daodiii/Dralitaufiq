import gsap from 'gsap';
import type Lenis from 'lenis';
import type { VirtualScrollData } from 'lenis';
import { getLenis, setGestureHandler } from './smooth';
import { gestures, glide, landing, next } from './carry';

/* Scrolling that is free between the choreographed parts and carried inside them. Each part (the
   pull-back, the wall, the parting) is a zone with its beats. Outside a zone nothing intervenes.
   Inside one, a gesture moves the page one beat, as one continuous motion: the page follows the
   fingers, and as their momentum starts to fade it glides on to the next beat on a curve that
   leaves at the speed the page already has and slows once, into the beat. The rest of that
   momentum is spent on the glide; a new gesture moves on from wherever the page is, at its
   speed, one beat further or back. A mouse notch starts the glide at once. Keys step through
   every beat and mark the same way; scrollbar drags and touch settle on the nearest beat of the
   zone they stop in. Everything is read from the provider on each move, so it follows resizes and
   ScrollTrigger refreshes. Phones and reduced motion keep native scrolling: their layouts are
   stacked and unpinned. The arithmetic is in carry.ts. */

export interface Beats {
  zones: number[][]; /* each an ordered run of scroll positions, first to last beat */
  marks: number[]; /* resting places between zones, for the keys */
}

const TOL = 40; /* beats closer than this merge; within this of a beat counts as standing on it */
const SNAP = 24; /* a zone reaches this far past its first and last beats; a drag that stops this near a beat goes back onto it */
const QUIET = 90; /* ms without input before a drag that simply stopped settles */
const TRICKLE = 180; /* px of a spent gesture's momentum swallowed after the glide has landed */
const HALF = 0.45; /* a new push the same way past this much of a glide asks for the next beat */
const SPIN = 300; /* px of notches more in a spent spin of the wheel that move on another beat */

export function steps(read: () => Beats) {
  const lenis = getLenis();
  if (!lenis) return;
  const mm = gsap.matchMedia();

  mm.add('(min-width: 760px) and (prefers-reduced-motion: no-preference)', () => {
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

    /* The page's own speed in px/s, read each tick after Lenis has moved it. */
    let speed = 0;
    let lastY = lenis.animatedScroll;
    let lastT = 0;
    const sample = (time: number) => {
      const y = lenis.animatedScroll;
      const dt = time - lastT;
      speed = lastT && dt > 0 && dt < 0.25 ? speed * 0.35 + ((y - lastY) / dt) * 0.65 : 0;
      lastY = y;
      lastT = time;
    };
    gsap.ticker.add(sample);

    /* The glide in flight, and the gesture whose momentum went into it. */
    let flight: { to: number; dir: number; start: number; duration: number; spun: number } | null = null;
    let spent = -1;
    let trickle = 0;
    const go = (to: number | undefined, gesture = -1) => {
      if (to === undefined) return;
      spent = gesture;
      trickle = 0;
      const from = lenis.animatedScroll;
      const g = glide(to - from, speed);
      if (!g) {
        flight = null;
        if (to !== from) lenis.scrollTo(to, { immediate: true, force: true });
        return;
      }
      const f = { to, dir: Math.sign(to - from), start: performance.now(), duration: g.duration, spun: 0 };
      flight = f;
      lenis.scrollTo(to, {
        duration: g.duration,
        easing: g.ease,
        force: true,
        onComplete: () => {
          if (flight === f) flight = null;
        },
      });
    };
    /* The glide, if it is still the one moving the page: a link or a jump may have taken over. */
    const flying = () => {
      if (flight && (lenis.isScrolling !== 'smooth' || performance.now() - flight.start > flight.duration * 1000 + 100)) flight = null;
      return flight;
    };
    const through = () => (flight ? (performance.now() - flight.start) / (flight.duration * 1000) : 1);
    const swallow = (event: Event) => {
      if (event.cancelable) event.preventDefault();
      return false;
    };

    const gesture = gestures();
    setGestureHandler(({ deltaX, deltaY, event }: VirtualScrollData) => {
      if (event.type.startsWith('touch') || (event as WheelEvent).ctrlKey || !deltaY || lenis.isStopped) return true;
      if (Math.abs(deltaX) > Math.abs(deltaY)) return true;
      const g = gesture(event.timeStamp || performance.now(), deltaY);
      window.clearTimeout(quiet);
      flying();

      /* The gesture the glide took its speed from: its momentum is spent. A long spin of the
         wheel asks for another beat; after landing a little more trickles in, then it is free. */
      if (g.id === spent) {
        if (flight) {
          if (g.notch && g.dir === flight.dir && (flight.spun += Math.abs(deltaY)) >= SPIN && through() > 0.3) {
            const z = zoneAt(flight.to);
            go(z && next(z, flight.to, g.dir), g.id);
          }
          return swallow(event);
        }
        if ((trickle += Math.abs(deltaY)) <= TRICKLE) return swallow(event);
        spent = -1;
      }

      /* A new gesture while gliding: the same way, past half way, one beat further (before that
         it is the same wish arriving twice, a second notch or a restless finger); the other way,
         back to the beat behind. */
      if (flight) {
        const z = zoneAt(flight.to) ?? zoneAt(lenis.animatedScroll);
        if (g.dir === flight.dir) {
          const to = z && through() >= HALF ? next(z, flight.to, g.dir) : undefined;
          if (to !== undefined) go(to, g.id);
          else spent = g.id;
          return swallow(event);
        }
        const back = z && next(z, lenis.animatedScroll, g.dir);
        if (back !== undefined) {
          go(back, g.id);
          return swallow(event);
        }
        flight = null;
        return true;
      }

      const z = zoneAt(lenis.targetScroll + deltaY) ?? zoneAt(lenis.animatedScroll);
      if (!z) return true;
      /* A notch is the whole wish at once; fingers are followed until their momentum fades. */
      if (g.notch || (g.fading >= 3 && g.n >= 4)) {
        const to = landing(z, lenis.animatedScroll, speed, g.dir);
        if (to !== undefined) {
          go(to, g.id);
          return swallow(event);
        }
        if (g.notch) return true;
      }
      /* A drag that simply stops: once quiet, settle from wherever it is. */
      const id = g.id;
      quiet = window.setTimeout(() => {
        if (flying() || spent === id) return;
        const zone = zoneAt(lenis.targetScroll);
        if (!zone) return;
        const y = lenis.targetScroll;
        const near = nearest(zone, y);
        go(Math.abs(near - y) <= SNAP ? near : next(zone, lenis.animatedScroll, g.dir) ?? near, id);
      }, QUIET);
      return true;
    });

    const onKey = (e: KeyboardEvent) => {
      /* Taken already: the arrow keys walking a stack of lectures. */
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      if (e.key === ' ' && t && /^(a|button)$/i.test(t.tagName)) return; /* space activates it */
      /* Each press is a beat, counted from where a glide in flight is going; a held key waits
         for half of each glide rather than racing down the page. */
      const f = flying();
      const held = e.repeat && f && through() < HALF;
      const y = f ? f.to : lenis.scroll;
      let to: number | undefined;
      switch (e.key) {
        case 'ArrowDown':
        case 'PageDown':
          to = next(every(), y, 1, TOL);
          break;
        case 'ArrowUp':
        case 'PageUp':
          to = next(every(), y, -1, TOL);
          break;
        case ' ':
          to = next(every(), y, e.shiftKey ? -1 : 1, TOL);
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
      if (held) return;
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
      gsap.ticker.remove(sample);
      setGestureHandler(null);
      window.removeEventListener('keydown', onKey);
      lenis.off('scroll', onScroll);
      flight = null;
      spent = -1;
    };
  });
}
