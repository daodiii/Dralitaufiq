/* A reload, or Back from another page, returns to the place the reader left. The browser cannot do it
   on the home page: it restores the scroll position before the pins have grown their spacers, into a
   page a fraction of the height, and the reader comes back somewhere else (among the books, from the
   About page). So the position is kept here, per tab, and motion.ts lands on it once the pins are
   built, the way it lands on a link's hash. The same size of window comes back to the same pixel; a
   different size, to the same share of the way down. Nothing here touches the page until it is
   called, so the arithmetic can be tested. */

export interface Kept {
  y: number;
  w: number; /* the window it was kept in */
  h: number;
  max: number; /* how far the page could scroll then */
}

const key = () => `place:${location.pathname}`;

/** The scroll position that is the kept place in a page now `w` by `h` that can scroll `max`. */
export function yFor(kept: Kept, w: number, h: number, max: number) {
  if (!(kept.y > 0) || !(max > 0)) return 0;
  const y = kept.w === w && kept.h === h ? kept.y : kept.max > 0 ? (kept.y / kept.max) * max : 0;
  return Math.round(Math.min(max, Math.max(0, y)));
}

function read(): Kept | null {
  try {
    const kept = JSON.parse(sessionStorage.getItem(key()) ?? 'null');
    return kept && [kept.y, kept.w, kept.h, kept.max].every(Number.isFinite) ? kept : null;
  } catch {
    return null;
  }
}

const limit = () => document.documentElement.scrollHeight - window.innerHeight;

/** Whether this load is a return to a page rather than a visit to it. */
export function returning() {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === 'reload' || nav?.type === 'back_forward';
}

/** Keeps the place from now on, for the caller to land on once the page is built (the caller also
    turns the browser's own restoring off: ScrollTrigger puts back the setting it found at each
    refresh, so it has to be set through ScrollTrigger.clearScrollMemory). Returns where the page was
    left, as a function of the layout it is asked in, or null on a first visit. The saved place is
    read now, before the page has moved to be overwritten. */
export function revisit() {
  const kept = returning() ? read() : null;

  const write = () => {
    try {
      const k: Kept = { y: Math.round(window.scrollY), w: window.innerWidth, h: window.innerHeight, max: limit() };
      sessionStorage.setItem(key(), JSON.stringify(k));
    } catch {
      /* storage can be off (private windows): the place is then simply not kept */
    }
  };

  /* Not before the page has been landed or the reader has taken over: until then it is still at the
     top, and would keep that. */
  let keeping = false;
  let quiet = 0;
  const keep = () => {
    if (keeping) return;
    keeping = true;
    window.addEventListener(
      'scroll',
      () => {
        window.clearTimeout(quiet);
        quiet = window.setTimeout(write, 150);
      },
      { passive: true }
    );
    window.addEventListener('pagehide', write);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && write());
  };

  return { where: kept ? () => yFor(kept, window.innerWidth, window.innerHeight, limit()) : null, keep };
}
