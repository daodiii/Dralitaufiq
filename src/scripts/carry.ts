/* The arithmetic of the carry in steps.ts: how wheel events are read into gestures, which beat a
   glide lands on, and the curve it lands on. Nothing here touches the page, so it can be tested.
   Distances in px, speeds in px/s, event times in ms, glide durations in seconds (as Lenis takes
   them). */

/* A whole notch of a mouse wheel; fingers on a trackpad begin far smaller. Lenis turns line-based
   wheels (Firefox: three lines) into pixels, 50 px a notch. */
const NOTCH = 40;
/* A frame, ms, and the input rate (px a frame) above which momentum is still running. */
const FRAME = 16.7;
const FAST = 2.5;
/* A glide leaves at the page's own speed. Its start slope stays at most M_MAX (the curve is
   shortened instead) and never above 3, where the curve would stop being smooth; turning back, it
   swings on at most as far as M_MIN allows. */
const M_MAX = 2.4;
const M_MIN = -1.2;
/* The hardest a glide should brake as it sets off, px/s². Arriving faster than that allows, it
   carries on to the beat after. */
const BRAKE = 4000;

export interface Gesture {
  id: number;
  dir: number; /* 1 down the page, -1 up */
  notch: boolean; /* it began with a whole notch: a mouse wheel */
  fading: number; /* events with the input slower than at its peak: the fingers have lifted */
  n: number; /* events so far */
  fresh: boolean; /* this event began it */
}

/** Reads wheel events into gestures: a push of the fingers with the momentum after it, a notch,
    or a quick run of notches. The browser sends at most one event a frame, so the input's rate is
    each event's distance spread over the frames since the one before, averaged over the last four
    events; that holds up when events bunch into one frame or a new push overlaps the last one's
    momentum. A gesture ends with a pause, a change of direction, or a fresh push once its momentum
    was fading. A slow frame holds events back and lets them through merged into one (or, for
    events made by a script, together): while the momentum was running that is no pause, and
    spread over the frames it stands for it is no push either. */
export function gestures(pause = 80) {
  const seen: { t: number; s: number }[] = []; /* s: px a frame */
  let g: Gesture = { id: 0, dir: 0, notch: false, fading: 0, n: 0, fresh: false };
  let last = -Infinity;
  let lastGap = Infinity;
  let peak = 0;
  let low = Infinity;
  return (t: number, delta: number): Gesture => {
    const a = Math.abs(delta);
    const dir = Math.sign(delta);
    const gap = t - last;
    const before = seen.length ? seen[seen.length - 1].s : 0;
    /* After a pause or a turn the rate starts afresh: the last gesture's events say nothing of
       this one. A pause while momentum still streamed in fast is a slow frame, not the fingers,
       even when what it held back arrives as one big event; a notch after notches is a new wish. */
    const turn = dir !== g.dir || (gap > pause && (before < FAST || (a >= NOTCH && lastGap > 30)));
    if (turn) seen.length = 0;
    seen.push({ t, s: a / Math.min(12, Math.max(1, gap / FRAME)) });
    while (seen.length > 4 || t - seen[0].t > 300) seen.shift();
    const rate = seen.reduce((sum, e) => sum + e.s, 0) / seen.length;
    const push = !turn && g.fading >= 3 && rate > 1.8 * low && rate > 8;
    if (turn || push) {
      g = { id: g.id + 1, dir, notch: a >= NOTCH, fading: 0, n: 1, fresh: true };
      peak = low = rate;
    } else {
      g = { ...g, n: g.n + 1, fresh: false };
      if (rate > peak) {
        peak = low = rate;
        g.fading = 0;
      } else if (rate < peak * 0.9) g.fading++;
      low = Math.min(low, rate);
    }
    last = t;
    lastGap = gap;
    return g;
  };
}

/** The curve a glide lands on: a cubic Hermite from 0 to 1 that leaves at slope `m` (the page's
    speed, in distances per duration) and arrives at rest. */
export const hermite = (m: number) => (u: number) => m * (u * u * u - 2 * u * u + u) + 3 * u * u - 2 * u * u * u;

/** The glide over `distance` for a page moving at `speed`: its duration in seconds and its curve.
    From rest it takes 0.55 to 1.25 s, longer the further it goes. Already moving, it leaves at
    that speed; when that is fast for the room left, it takes less time rather than braking at once. */
export function glide(distance: number, speed: number) {
  if (Math.abs(distance) < 1) return null;
  let duration = Math.min(1.25, Math.max(0.55, 0.45 + 0.55 * Math.sqrt(Math.abs(distance) / 1000)));
  let m = (speed * duration) / distance;
  if (m > M_MAX) {
    duration = Math.max(0.25, (M_MAX * distance) / speed);
    m = Math.min(3, (speed * duration) / distance);
  }
  m = Math.max(M_MIN, m);
  return { duration, m, ease: hermite(m) };
}

/** The next beat past `y` going `dir`, with a little grace so a page resting on a beat moves on. */
export const next = (beats: number[], y: number, dir: number, grace = 8) =>
  dir > 0 ? beats.find((b) => b > y + grace) : [...beats].reverse().find((b) => b < y - grace);

/** Where a glide from `y` lands: the next beat going `dir`, or the one after it when the page is
    already moving that way too fast to stop at the next one without braking harder than BRAKE. */
export function landing(beats: number[], y: number, speed: number, dir: number) {
  const first = next(beats, y, dir);
  if (first === undefined) return undefined;
  const v = speed * dir > 0 ? Math.abs(speed) : 0;
  /* Leaving at slope M_MAX over a room d, the curve sets off braking at (4 M_MAX - 6) / M_MAX² · v²/d. */
  const hard = ((4 * M_MAX - 6) / (M_MAX * M_MAX)) * v * v;
  if (v && Math.abs(first - y) * BRAKE < hard) return next(beats, first, dir) ?? first;
  return first;
}
