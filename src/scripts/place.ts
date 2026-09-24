import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getLenis, scrollToY } from './smooth';
import { placeIn, scrollFor, type Part, type Place } from './part';

/* The reader keeps their place through a resize. ScrollTrigger keeps the raw scroll position
   through a refresh, but the pins are sized in screen heights and text rewraps at a new width,
   so the same position would show another part of the page. So the place is noted whenever the
   page comes to rest, much as the browser anchors its own scrolling: the first piece of content
   wholly in view, or, while a pinned part holds most of the screen, how far through it the page
   is. After the refresh for a new size, and unless the reader has scrolled since, the page goes
   back to that place before the next frame is drawn. `pins` are the parts pinned in some layout,
   taken whole. */
export function keepPlace(pins: string) {
  /* `at` is the place in the part as laid out when noted; `flat` the same place as a plain
     block, for a part that is not pinned before or after, where only the content matters. */
  let spot: { el: HTMLElement; kind: Part['kind']; at: Place; flat: Place } | null = null;
  let laid = { w: window.innerWidth, h: window.innerHeight };
  /* A resize ScrollTrigger will refresh for is waiting; the reader moved on in the meantime. */
  let waiting = false;
  let moved = false;
  let quiet = 0;

  /* Layout positions, not client rects: the reveals translate blocks as they come into view. */
  const docTop = (el: HTMLElement) => {
    let y = 0;
    for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) y += e.offsetTop;
    return y;
  };

  const blockOf = (el: HTMLElement) => ({ kind: 'block' as const, top: docTop(el), h: el.offsetHeight });
  const partOf = (el: HTMLElement): Part => {
    const t = ScrollTrigger.getAll().find((s) => s.pin === el);
    if (t) return { kind: 'pinned', start: t.start, end: t.end, h: el.offsetHeight };
    return el.matches(pins) ? { ...blockOf(el), kind: 'stacked', vh: window.innerHeight } : blockOf(el);
  };

  /* Boxes in the flow: through display: contents, not text-level inline elements (images are
     boxes, inline or not). */
  const kids = (parent: Element): HTMLElement[] =>
    Array.from(parent.children).flatMap((c) => {
      if (!(c instanceof HTMLElement)) return [];
      const cs = getComputedStyle(c);
      if (cs.display === 'contents') return kids(c);
      const text = cs.display === 'inline' && !/^(IMG|VIDEO|CANVAS)$/.test(c.tagName);
      return text || cs.display === 'none' || cs.position === 'fixed' || cs.position === 'absolute' ? [] : [c];
    });

  /* The first piece of content wholly in view, in page order: looking into what the screen cuts
     through, and into wholly visible wrappers, whose edges and padding are not what the reader
     sees. `cut` keeps the first element with nothing inside to look into, for when none is whole. */
  let cut: HTMLElement | null = null;
  const seen = (root: Element): HTMLElement | null => {
    for (const c of kids(root)) {
      const h = c.offsetHeight;
      const top = docTop(c) - window.scrollY;
      if (!h || top + h <= 0) continue;
      if (top >= window.innerHeight) return null;
      /* A pinned part sits in a spacer, which stays in the flow while it is held. It is the
         place while it holds most of the screen; the last of it leaving is not. */
      const el = c.classList.contains('pin-spacer') && c.firstElementChild instanceof HTMLElement ? c.firstElementChild : c;
      if (el.matches(pins)) {
        if (top + h > window.innerHeight / 2) return el;
        cut ??= el;
        continue;
      }
      if (top >= 0 && top + h <= window.innerHeight) return seen(el) ?? el;
      const inner = seen(el);
      if (inner) return inner;
      if (!kids(el).length) cut ??= el;
    }
    return null;
  };

  const note = () => {
    cut = null;
    const el = seen(document.body) ?? cut ?? document.body;
    const part = partOf(el);
    spot = { el, kind: part.kind, at: placeIn(part, window.scrollY), flat: placeIn(blockOf(el), window.scrollY) };
  };

  /* Mirrors ScrollTrigger's own rule: touch screens ignore height changes under a quarter (the
     address bar), so those resizes are no relayout. */
  const relayout = () =>
    window.innerWidth !== laid.w ||
    (ScrollTrigger.isTouch === 1 ? Math.abs(window.innerHeight - laid.h) > window.innerHeight * 0.25 : window.innerHeight !== laid.h);

  window.addEventListener('resize', () => {
    if (waiting || !relayout()) return;
    waiting = true;
    /* Mid-glide the noted place is already behind; ScrollTrigger's position is the better guess. */
    moved = getLenis()?.isScrolling === 'smooth';
  });
  const input = () => {
    if (waiting) moved = true;
  };
  ['wheel', 'touchstart', 'pointerdown'].forEach((ev) => window.addEventListener(ev, input, { passive: true }));
  window.addEventListener('keydown', (e) => {
    if (/^(Arrow(Up|Down)|Page(Up|Down)|Home|End| )$/.test(e.key)) input();
  });
  window.addEventListener(
    'scroll',
    () => {
      window.clearTimeout(quiet);
      quiet = window.setTimeout(() => waiting || note(), 80);
    },
    { passive: true }
  );

  ScrollTrigger.addEventListener('refresh', () => {
    if (waiting && !moved && spot?.el.isConnected) {
      const part = partOf(spot.el);
      const flat = part.kind === 'stacked' && spot.kind === 'stacked';
      const to = flat ? scrollFor(blockOf(spot.el), spot.flat) : scrollFor(part, spot.at);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = Math.round(Math.min(max, Math.max(0, to)));
      if (Math.abs(y - window.scrollY) > 1) {
        /* Lenis clamps to a limit it re-measures on a debounce. */
        getLenis()?.resize();
        scrollToY(y, true);
      }
    }
    waiting = moved = false;
    laid = { w: window.innerWidth, h: window.innerHeight };
    note();
  });
  note();
}
