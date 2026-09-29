/**
 * The books on a phone (components/books/Pile.astro). Each book is a body that falls under
 * gravity until it meets the book below it (or the table), with a small bounce; the pile is only
 * the order they lie in, top first. Drawing a book out slides it off to the side, and once it is
 * mostly clear the books above fall into its place; putting it back drops it on top. A link to
 * one book (/books?book=<id>, as the home page's fan opens it) opens that book as the page loads.
 */
import gsap from 'gsap';
import { nav, showNav } from '../nav';
import { reveals } from '../reveals';
import { getLenis, lockScroll, reduceMotion } from '../smooth';
import { openSheet } from './sheet';

const root = document.querySelector<HTMLElement>('.pile')!;
const stack = root.querySelector<HTMLElement>('.pile__stack')!;
const els = [...stack.querySelectorAll<HTMLElement>('.pile__book')];
const langs = [...root.querySelectorAll<HTMLButtonElement>('.pile__langs button')];
const view = document.querySelector<HTMLElement>('.pview')!;
const viewBody = view.querySelector<HTMLElement>('.pview__body')!;
const scrim = view.querySelector<HTMLElement>('.pview__scrim')!;
const closeBtn = view.querySelector<HTMLButtonElement>('.pview__close')!;
const articles = [...view.querySelectorAll<HTMLElement>('.pview__book')];

nav();
showNav();
reveals();

view.querySelectorAll<HTMLButtonElement>('[data-sheet]').forEach((b) => b.addEventListener('click', () => openSheet(b.dataset.sheet!, b)));

/* ---------- the bodies ---------- */

type Body = {
  el: HTMLElement;
  i: number;
  rtl: boolean;
  t: number; /* thickness, px */
  y: number; /* its underside above the table, px */
  v: number;
  x: number; /* drawn sideways, px */
  xTo: number;
  off: number; /* how far it lies off square, px */
  rot: number;
  lift: number; /* drawn a little out: its language chosen, a press, a hover */
  out: boolean; /* drawn out of the pile */
  held: boolean; /* following a finger, or sliding away */
  wait: number; /* not yet let go (the pile building itself) */
  shown: boolean;
};

/* A fixed scatter, so the pile lies the same way every time. */
const scatter = (n: number) => {
  const s = Math.sin(n * 91.7 + 13.1) * 43758.5453;
  return s - Math.floor(s);
};

const S: Body[] = els.map((el, i) => ({
  el,
  i,
  rtl: el.dataset.rtl === '1',
  t: el.offsetHeight,
  y: 0,
  v: 0,
  x: 0,
  xTo: 0,
  off: (scatter(i) - 0.5) * 14,
  rot: (scatter(i + 40) - 0.5) * 0.7,
  lift: 0,
  out: false,
  held: false,
  wait: 0,
  shown: true,
}));

/* Top first. */
let order = S.map((b) => b.i);
const G = 5600; /* px/s², a heavy book's fall at this scale */
const LID = 46; /* the top book's cover, seen over the pile */

const inPile = () => order.filter((i) => !S[i].out);

function measure() {
  S.forEach((b) => (b.t = b.el.offsetHeight));
  const h = inPile().reduce((sum, i) => sum + S[i].t, 0);
  stack.style.setProperty('--pile-h', `${h + LID}px`);
}

function markTop() {
  const top = inPile()[0];
  S.forEach((b) => b.el.classList.toggle('is-top', b.i === top));
}

function draw(b: Body) {
  const x = b.off + b.x + b.lift * (b.rtl ? -1 : 1);
  b.el.style.transform = `translate3d(${x.toFixed(2)}px, ${(-b.y).toFixed(2)}px, 0) rotate(${b.rot}deg)`;
}

/* Every book where it lies, at once. */
function place() {
  let y = 0;
  for (const i of [...inPile()].reverse()) {
    const b = S[i];
    b.y = y;
    b.v = 0;
    y += b.t;
  }
  S.forEach(draw);
}

/* ---------- the loop, running only while something moves ---------- */

let running = false;
let last = 0;

function wake() {
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(tick);
}

function tick(now: number) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  let busy = false;
  /* From the table up: each book's floor is the book under it, where that book is now. */
  let floor = 0;
  for (let k = order.length - 1; k >= 0; k--) {
    const b = S[order[k]];
    if (b.out) continue;
    if (now < b.wait) {
      busy = true;
      continue;
    }
    if (!b.shown) {
      b.shown = true;
      b.el.style.opacity = '';
    }
    if (b.y > floor + 0.01 || b.v !== 0) {
      b.v -= G * dt;
      b.y += b.v * dt;
      if (b.y <= floor) {
        b.y = floor;
        b.v = -b.v > 260 ? -b.v * 0.2 : 0;
      }
      busy = true;
    } else if (b.y < floor) b.y = floor;
    floor = b.y + b.t;
  }
  S.forEach((b) => {
    if (!b.held) {
      const dx = b.xTo - b.x;
      if (Math.abs(dx) > 0.05) {
        b.x += dx * 0.2;
        busy = true;
      } else b.x = b.xTo;
    }
    draw(b);
  });
  if (busy) requestAnimationFrame(tick);
  else running = false;
}

/* ---------- the pile builds itself ---------- */

function build() {
  measure();
  markTop();
  if (reduceMotion) {
    place();
    return;
  }
  const start = performance.now() + 250;
  const n = order.length;
  let height = 0;
  for (let k = n - 1; k >= 0; k--) {
    const b = S[order[k]];
    height += b.t;
    b.y = height + 380 + (n - 1 - k) * 6;
    b.v = 0;
    b.wait = start + (n - 1 - k) * 105;
    b.shown = false;
    b.el.style.opacity = '0';
    draw(b);
  }
  wake();
}

/* Spine titles are set as large as the spine lets them; a long one comes down to fit, and on a
   spine too short for both the author's name gives way. */
function fitSpines() {
  S.forEach((b) => {
    const t = b.el.querySelector<HTMLElement>('.pile__t')!;
    const a = b.el.querySelector<HTMLElement>('.pile__a')!;
    t.style.removeProperty('--fs');
    a.style.display = '';
    const over = () => t.scrollWidth > t.clientWidth + 0.5;
    let fs = parseFloat(getComputedStyle(t).fontSize);
    const min = b.rtl ? 10 : 7.5;
    while (over() && fs > min) t.style.setProperty('--fs', `${(fs -= 0.5)}px`);
    if (over()) {
      a.style.display = 'none';
      while (over() && fs > 6.5) t.style.setProperty('--fs', `${(fs -= 0.5)}px`);
    }
  });
}

/* ---------- drawing a book out, and putting it back ---------- */

let open: Body | null = null;
let busy = false;

const articleOf = (b: Body) => articles.find((a) => a.dataset.i === String(b.i))!;

function pull(b: Body, dir = b.rtl ? -1 : 1) {
  if (busy || b.out) return;
  busy = true;
  b.held = true;
  b.lift = 0;
  /* Fetch the big cover while the book slides out. */
  const img = articleOf(b).querySelector<HTMLImageElement>('.pview__cover img')!;
  img.loading = 'eager';
  const from = b.x;
  if (reduceMotion) {
    b.out = true;
    measure();
    markTop();
    place();
    show(b, dir);
    return;
  }
  gsap.to(b, {
    x: from + dir * innerWidth * 1.05,
    duration: 0.46,
    ease: 'power2.in',
    onUpdate: () => {
      draw(b);
      /* Once it is mostly clear, the books above it fall. */
      if (!b.out && Math.abs(b.x - from) > innerWidth * 0.62) {
        b.out = true;
        measure();
        markTop();
        wake();
      }
    },
    onComplete: () => show(b, dir),
  });
}

function show(b: Body, dir: number, focus = true) {
  open = b;
  articles.forEach((a) => (a.hidden = a.dataset.i !== String(b.i)));
  const art = articleOf(b);
  const cover = art.querySelector<HTMLImageElement>('.pview__cover img')!;
  const words = art.querySelector<HTMLElement>('.pview__words')!;
  cover.loading = 'eager';
  view.setAttribute('aria-label', b.el.getAttribute('aria-label') || '');
  view.hidden = false;
  viewBody.scrollTop = 0;
  lockScroll(true);
  /* Focus goes to the way back; not on a page that opened on this book, where no one asked. */
  if (focus) closeBtn.focus({ preventScroll: true });
  if (reduceMotion) {
    busy = false;
    return;
  }
  gsap.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
  gsap.fromTo(
    cover,
    { x: dir * innerWidth * 0.8, rotateY: dir * -70, rotateZ: dir * 8, opacity: 0 },
    { x: 0, rotateY: 0, rotateZ: 0, opacity: 1, duration: 1.1, ease: 'expo.out' }
  );
  gsap.fromTo(words.children, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.05, ease: 'power3.out', delay: 0.25 });
  gsap.fromTo(closeBtn, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.4, onComplete: () => (busy = false) });
}

function putBack() {
  const b = open;
  if (!b || busy) return;
  busy = true;
  open = null;
  const art = articleOf(b);
  const cover = art.querySelector<HTMLElement>('.pview__cover img')!;
  const words = art.querySelector<HTMLElement>('.pview__words')!;
  const done = () => {
    view.hidden = true;
    lockScroll(false);
    gsap.set([cover, scrim, closeBtn, ...words.children], { clearProps: 'all' });
    b.el.focus({ preventScroll: true });
    busy = false;
  };

  /* A link to this book has been answered: a reload shows the pile. */
  if (new URLSearchParams(location.search).has('book')) history.replaceState(history.state, '', location.pathname + location.hash);

  /* Back on top of the pile, from above. */
  order = [b.i, ...order.filter((i) => i !== b.i)];
  const top = inPile().reduce((sum, i) => sum + S[i].t, 0);
  b.out = false;
  b.held = false;
  b.x = 0;
  b.xTo = 0;
  measure();
  markTop();

  /* If the reader had gone down the pile, bring its top back into view to see the book land. */
  const pileTop = stack.getBoundingClientRect().top;
  if (pileTop < 80) {
    const y = scrollY + pileTop - 160;
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(y, { duration: 0.8 });
    else scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  if (reduceMotion) {
    place();
    done();
    return;
  }
  b.y = top + 420;
  b.v = 0;
  b.wait = performance.now() + 260;
  b.shown = false;
  b.el.style.opacity = '0';
  gsap.to(cover, { y: -innerHeight * 0.5, scale: 0.4, opacity: 0, duration: 0.45, ease: 'power2.in' });
  gsap.to(words.children, { autoAlpha: 0, duration: 0.25 });
  gsap.to(closeBtn, { opacity: 0, duration: 0.2 });
  gsap.to(scrim, { opacity: 0, duration: 0.5, ease: 'power2.inOut', onComplete: done });
  wake();
}

closeBtn.addEventListener('click', putBack);
view.addEventListener('click', (e) => {
  if (e.target === viewBody || e.target === scrim) putBack();
});
/* The sheet's own Escape handler runs first (in capture) while it is open. */
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && open) putBack();
});

/* ---------- fingers, the mouse and keys on the spines ---------- */

type Grip = { b: Body; id: number; x0: number; y0: number; live: boolean; lastX: number; lastT: number; v: number };
let grip: Grip | null = null;
let swallow = false;
let chosen: string | null = null;

const rest = (b: Body) => (chosen === b.el.dataset.lang ? 16 : 0);

S.forEach((b) => {
  const el = b.el;
  el.addEventListener('pointerdown', (e) => {
    if (b.out || busy) return;
    grip = { b, id: e.pointerId, x0: e.clientX, y0: e.clientY, live: false, lastX: e.clientX, lastT: performance.now(), v: 0 };
    el.setPointerCapture(e.pointerId);
    /* The book gives a little under the finger. */
    b.lift = 7;
    wake();
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && !grip && !b.out) {
      b.lift = Math.max(b.lift, 5);
      wake();
    }
    if (!grip || grip.b !== b || e.pointerId !== grip.id) return;
    const dx = e.clientX - grip.x0;
    const dy = e.clientY - grip.y0;
    const now = performance.now();
    grip.v = 0.7 * grip.v + 0.3 * ((e.clientX - grip.lastX) / Math.max(1, now - grip.lastT));
    grip.lastX = e.clientX;
    grip.lastT = now;
    if (!grip.live) {
      /* Up or down is the page's scroll. */
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        grip = null;
        b.lift = rest(b);
        wake();
        return;
      }
      if (Math.abs(dx) < 8) return;
      grip.live = true;
      b.held = true;
    }
    b.x = dx;
    draw(b);
  });
  el.addEventListener('pointerup', (e) => {
    if (!grip || grip.b !== b || e.pointerId !== grip.id) return;
    const g = grip;
    grip = null;
    if (!g.live) {
      b.lift = rest(b);
      wake();
      return;
    }
    /* A pull far or fast enough draws the book out that way; less, and it slides back. */
    swallow = true;
    const dx = e.clientX - g.x0;
    if (Math.abs(dx) > 70 || Math.abs(g.v) > 0.5) pull(b, Math.sign(dx || g.v));
    else {
      b.held = false;
      b.xTo = 0;
      b.lift = rest(b);
      wake();
    }
  });
  el.addEventListener('pointercancel', () => {
    if (grip?.b !== b) return;
    grip = null;
    b.held = false;
    b.xTo = 0;
    b.lift = rest(b);
    wake();
  });
  el.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !grip) {
      b.lift = rest(b);
      wake();
    }
  });
  el.addEventListener('click', () => {
    if (swallow) {
      swallow = false;
      return;
    }
    pull(b);
  });
});

/* ---------- the languages ---------- */

langs.forEach((btn) =>
  btn.addEventListener('click', () => {
    chosen = chosen === btn.dataset.lang ? null : btn.dataset.lang!;
    langs.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.lang === chosen)));
    stack.classList.toggle('is-filtered', !!chosen);
    S.forEach((b, k) => {
      const mine = b.el.dataset.lang === chosen;
      b.el.classList.toggle('is-chosen', mine);
      /* Drawn out one after another, as a hand would. */
      setTimeout(
        () => {
          b.lift = rest(b);
          wake();
        },
        mine ? k * 30 : 0
      );
    });
  })
);

/* ---------- start ---------- */

const wanted = new URLSearchParams(location.search).get('book');

function boot() {
  fitSpines();
  const b = S.find((x) => x.el.dataset.id === wanted);
  if (!b) {
    build();
    return;
  }
  /* A link to one book: the pile lies ready and that book is already out of it, facing the reader. */
  b.out = true;
  b.held = true;
  b.x = (b.rtl ? -1 : 1) * innerWidth * 1.05;
  measure();
  markTop();
  place();
  busy = true;
  show(b, b.rtl ? -1 : 1, false);
}

document.fonts.ready.catch(() => undefined).then(boot);

addEventListener('resize', () => {
  fitSpines();
  measure();
  if (!running) place();
});

declare global {
  interface Window {
    __pile: { order: () => number[]; open: () => string | null; pull: (i: number) => void; back: () => void };
  }
}

window.__pile = {
  order: () => [...order],
  open: () => open?.el.dataset.id ?? null,
  pull: (i) => pull(S[i]),
  back: putBack,
};
