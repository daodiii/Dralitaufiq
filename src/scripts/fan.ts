/**
 * The books on a phone, as a fanned hand of covers (components/WorksFan.astro). Each hand keeps
 * where it is turned to (`pos`, in covers) and how far it is fanned (`spread`, 0 folded to 1);
 * one loop eases both toward their targets while anything is moving, the fanning on a spring so
 * a new hand overshoots a little as it is dealt. A drag turns the hand directly under the finger
 * and lets go with its speed; a vertical drag is the page's.
 */

/* Degrees between covers when the hand is fully fanned, and a finger's travel per cover. */
const STEP = 8.5;
const PX = 62;

const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Hand {
  el: HTMLElement;
  cards: HTMLAnchorElement[];
  dir: 1 | -1; /* the Arabic hand runs right to left */
  pos: number;
  target: number;
  spread: number;
  spreadV: number;
  spreadTo: number;
  alpha: number;
  alphaTo: number;
}

function mount(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>('.fan__stage')!;
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('.fan__tab')];
  const caps = [...root.querySelectorAll<HTMLElement>('.fan__cap')];
  const hands: Hand[] = [...root.querySelectorAll<HTMLElement>('.fan__hand')].map((el) => ({
    el,
    cards: [...el.querySelectorAll<HTMLAnchorElement>('.fan__card')],
    dir: el.dataset.dir === '-1' ? -1 : 1,
    pos: 0,
    target: 0,
    spread: calm ? 1 : 0,
    spreadV: 0,
    spreadTo: calm ? 1 : 0,
    alpha: 1,
    alphaTo: 1,
  }));
  let held = hands[0];
  let front = '';

  const clampPos = (h: Hand, p: number) => Math.max(0, Math.min(h.cards.length - 1, p));

  const draw = (h: Hand) => {
    h.el.style.opacity = h.alpha.toFixed(3);
    h.el.style.transform = `translateY(${((1 - h.alpha) * 26).toFixed(1)}px)`;
    h.cards.forEach((c, i) => {
      const rel = i - h.pos;
      const a = Math.abs(rel);
      const lift = Math.max(0, 1 - a) * h.spread;
      c.style.transform = `rotate(${(h.dir * rel * STEP * h.spread).toFixed(3)}deg)`;
      (c.firstElementChild as HTMLElement).style.transform = `translateY(${(-lift * 20).toFixed(2)}px) scale(${(1 + lift * 0.06).toFixed(4)})`;
      c.style.setProperty('--v', Math.min(a, 1).toFixed(3));
      c.style.zIndex = String(100 - Math.round(a * 10));
      c.style.opacity = a > 5 ? '0' : a > 4 ? (5 - a).toFixed(3) : '1';
    });
    if (h !== held) return;
    const k = Math.round(h.pos);
    const id = h.cards[k]?.dataset.id ?? '';
    if (id === front) return;
    front = id;
    h.cards.forEach((c, i) => c.classList.toggle('is-front', i === k));
    caps.forEach((cap) => {
      const on = cap.dataset.id === id;
      cap.classList.toggle('is-on', on);
      cap.inert = !on;
    });
  };

  /* ---------- one loop moves whatever is still moving ---------- */

  let running = false;
  let last = 0;
  let dragging = false;

  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    let busy = false;
    hands.forEach((h) => {
      if (!(dragging && h === held)) {
        const d = h.target - h.pos;
        if (!calm && Math.abs(d) > 0.0005) {
          h.pos += d * (1 - Math.exp(-dt * 11));
          busy = true;
        } else h.pos = h.target;
      }
      const acc = 150 * (h.spreadTo - h.spread) - 17 * h.spreadV;
      h.spreadV += acc * dt;
      h.spread += h.spreadV * dt;
      if (!calm && (Math.abs(h.spreadTo - h.spread) > 0.0005 || Math.abs(h.spreadV) > 0.001)) busy = true;
      else {
        h.spread = h.spreadTo;
        h.spreadV = 0;
      }
      const da = h.alphaTo - h.alpha;
      if (!calm && Math.abs(da) > 0.002) {
        h.alpha += da * (1 - Math.exp(-dt * 12));
        busy = true;
      } else h.alpha = h.alphaTo;
      const leaving = h.el.classList.contains('is-leaving');
      if (h.el.classList.contains('is-on') || leaving) draw(h);
      if (leaving && h.alpha === 0) h.el.classList.remove('is-leaving');
    });
    if (busy || dragging) requestAnimationFrame(tick);
    else running = false;
  };

  const wake = () => {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  };

  /* ---------- a finger across the hand ---------- */

  let start: { x: number; y: number; id: number; pos: number } | null = null;
  let moved = false;
  let samples: { t: number; pos: number }[] = [];

  stage.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY, id: e.pointerId, pos: held.pos };
    moved = false;
    samples = [];
  });

  stage.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    if (!moved) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) <= 6 || Math.abs(dx) <= Math.abs(dy)) return;
      moved = true;
      dragging = true;
      stage.setPointerCapture(e.pointerId);
      start.x = e.clientX;
      wake();
    }
    /* Past either end the hand gives, but less. */
    let p = start.pos - (held.dir * (e.clientX - start.x)) / PX;
    const hi = held.cards.length - 1;
    if (p < 0) p *= 0.3;
    if (p > hi) p = hi + (p - hi) * 0.3;
    held.pos = held.target = p;
    const t = performance.now();
    samples.push({ t, pos: p });
    samples = samples.filter((s) => t - s.t < 90);
  });

  /* Let go, it runs on with the finger's speed and settles on the nearest cover. */
  const release = () => {
    if (!start) return;
    if (moved) {
      const s0 = samples[0];
      const s1 = samples[samples.length - 1];
      const v = s0 && s1 && s1.t > s0.t ? ((s1.pos - s0.pos) / (s1.t - s0.t)) * 1000 : 0;
      held.target = clampPos(held, Math.round(held.pos + v * 0.16));
    }
    dragging = false;
    start = null;
    wake();
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  const bring = (h: Hand, i: number) => {
    h.target = i;
    wake();
  };

  hands.forEach((h) =>
    h.cards.forEach((c, i) => {
      c.addEventListener('click', (e) => {
        /* A drag that ends on a cover is not a tap on it. */
        if (moved) {
          e.preventDefault();
          moved = false;
          return;
        }
        if (h !== held || i !== Math.round(h.target)) {
          e.preventDefault();
          bring(h, i);
        }
      });
      /* Tabbing through the covers turns the hand to each. */
      c.addEventListener('focus', () => {
        if (h === held && c.matches(':focus-visible')) bring(h, i);
      });
    })
  );

  stage.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = clampPos(held, Math.round(held.target) + step * held.dir);
    held.cards[i].focus();
    bring(held, i);
  });

  /* ---------- dealing a new hand ---------- */

  const deal = (lang: string) => {
    const next = hands.find((h) => h.el.dataset.lang === lang);
    if (!next || next === held) return;
    const old = held;
    old.spreadTo = calm ? 1 : 0;
    old.alphaTo = 0;
    old.el.classList.remove('is-on');
    old.el.classList.add('is-leaving');
    held = next;
    front = '';
    next.pos = next.target = 0;
    next.spread = next.spreadTo = calm ? 1 : 0;
    next.spreadV = 0;
    next.alpha = calm ? 1 : 0;
    next.alphaTo = 1;
    next.el.classList.add('is-on');
    if (!calm)
      window.setTimeout(() => {
        next.spreadTo = 1;
        wake();
      }, 160);
    tabs.forEach((t) => {
      const on = t.dataset.lang === lang;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-pressed', String(on));
    });
    wake();
  };
  tabs.forEach((t) => t.addEventListener('click', () => deal(t.dataset.lang!)));

  /* The first hand waits folded until it comes into view, then fans out. */
  hands.forEach(draw);
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      held.spreadTo = 1;
      wake();
    },
    { threshold: 0.4 }
  );
  io.observe(stage);
}

const root = document.querySelector<HTMLElement>('.fan');
if (root) mount(root);

export {};
