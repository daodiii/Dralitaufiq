/**
 * The lectures' table of stacks (components/Lectures.astro). Lays the flat hit areas and labels
 * over the 3D stacks, paints each stack's edges card by card, and thumbs through them: the height
 * of the pointer on a stack picks a lesson, whose card slides out and stands up in colour while
 * the cards around it fan out; the label names it and a click opens it on YouTube, inside its
 * series. From the keyboard, a focused stack shows its latest lesson and the arrow keys walk it.
 * A tap is left alone: on a touch screen a stack opens its whole series.
 */
import { W, D, watch, minutes, type Lesson, type Lessons } from '../lib/lectures';
import { still, pictureOf } from '../lib/stills';

interface Stack {
  key: string;
  title: string;
  meta: string;
  href: string;
  pl: string;
  n: number;
  h: number;
}

interface LabelText {
  ar?: string;
  t: string;
  m: string;
}

const M = 2; /* the faces' room for cards that stick out of the stack */
/* How far the cards around the pulled one slide out, by distance from it. */
const FAN = [0, 30, 19, 9, 3];

/* A lesson's picture (lib/stills.ts): the small one at once, 320 px wide a moment later. */
const frame = (L: Lesson, size: '' | 'mq') => {
  const p = pictureOf(L);
  return still(p.id, p.f, size);
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const root = document.querySelector<HTMLElement>('.lectures');
if (root) mount(root);

function mount(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>('.lectures__stage')!;
  const view = root.querySelector<HTMLElement>('.lectures__scene')!;
  const table = root.querySelector<HTMLElement>('.lectures__table')!;
  const stacks = [...root.querySelectorAll<HTMLElement>('.lectures__stack')];
  const hits = [...root.querySelectorAll<HTMLAnchorElement>('.lectures__hit')];
  const labels = [...root.querySelectorAll<HTMLElement>('.lectures__lbl')];
  const live = root.querySelector<HTMLElement>('[data-live]');
  const data: Stack[] = JSON.parse(root.querySelector('script[data-stacks]')!.textContent!);
  const part = (l: HTMLElement, k: string) => l.querySelector<HTMLElement>(`.lectures__lbl-${k}`)!;
  const rest: LabelText[] = labels.map((l) => ({
    ar: part(l, 'ar').textContent ?? '',
    t: part(l, 't').textContent ?? '',
    m: part(l, 'm').textContent ?? '',
  }));

  /* ---------- the camera, read back from the computed style ---------- */

  let u = 1; /* px per design unit (--lu) */
  let d = 2100;
  let ox = 0;
  let oy = 0;
  let tx = 0;
  let ty = 0;
  let m = new DOMMatrix();
  /* Where each stack stands on the table, in design units: the stylesheet decides. */
  const place = data.map(() => ({ x: 0, y: 0 }));
  const px = (el: Element, prop: 'left' | 'top') => parseFloat(getComputedStyle(el)[prop]) || 0;

  const read = () => {
    u = parseFloat(getComputedStyle(stage).getPropertyValue('--lu')) || parseFloat(getComputedStyle(stacks[0]).width) / W;
    const cs = getComputedStyle(view);
    d = parseFloat(cs.perspective) || 2100 * u;
    [ox, oy] = cs.perspectiveOrigin.split(' ').map(parseFloat);
    tx = px(table, 'left');
    ty = px(table, 'top');
    m = new DOMMatrix(getComputedStyle(table).transform);
    stacks.forEach((s, i) => (place[i] = { x: px(s, 'left') / u, y: px(s, 'top') / u }));
  };

  /** A point on or above the table (design units, z up from it) to stage pixels. */
  const project = (x: number, y: number, z = 0) => {
    x *= u;
    y *= u;
    z *= u;
    const qx = m.m11 * x + m.m21 * y + m.m31 * z + m.m41;
    const qy = m.m12 * x + m.m22 * y + m.m32 * z + m.m42;
    const qz = m.m13 * x + m.m23 * y + m.m33 * z + m.m43;
    const s = d / (d - qz);
    return { x: ox + (tx + qx - ox) * s, y: oy + (ty + qy - oy) * s };
  };

  /* ---------- flat hit areas and labels over the stacks ---------- */

  const layout = () => {
    read();
    /* A label may be as wide as the room between its neighbours: nearer the tower, perspective
       draws the stacks closer together. */
    const mids = place.map(({ x, y }) => project(x + W / 2, y + D).x);
    const widest = 15 * parseFloat(getComputedStyle(document.documentElement).fontSize);
    data.forEach((st, i) => {
      const { x, y } = place[i];
      const pts = [0, st.h].flatMap((z) =>
        [
          [x, y],
          [x + W, y],
          [x, y + D],
          [x + W, y + D],
        ].map(([a, b]) => project(a, b, z))
      );
      const left = Math.min(...pts.map((p) => p.x));
      const right = Math.max(...pts.map((p) => p.x));
      const top = Math.min(...pts.map((p) => p.y));
      const bottom = Math.max(project(x, y + D).y, project(x + W, y + D).y);
      const mid = project(x + W / 2, y + D);
      Object.assign(hits[i].style, {
        left: `${left - 8}px`,
        top: `${top - 8}px`,
        width: `${right - left + 16}px`,
        height: `${bottom - top + 16}px`,
      });
      const room = Math.min(i > 0 ? mid.x - mids[i - 1] : Infinity, i < mids.length - 1 ? mids[i + 1] - mid.x : Infinity);
      Object.assign(labels[i].style, {
        left: `${mid.x}px`,
        top: `${bottom + 16}px`,
        width: `${Math.min(widest, room - 16)}px`,
      });
    });
    stage.classList.add('is-laid');
  };

  /** Other words under a stack, or its own again. */
  const label = (i: number, text: LabelText = rest[i]) => {
    part(labels[i], 'ar').textContent = text.ar ?? '';
    part(labels[i], 't').textContent = text.t;
    part(labels[i], 'm').textContent = text.m;
  };

  /* ---------- the edges: every card, a little out of line ---------- */

  let painted = 0;
  const paint = () => {
    /* Canvas pixels per design unit: the screen's own. Painted finer and shrunk, the thin sheets
       ripple into moiré. */
    const S = clamp(u * (window.devicePixelRatio || 1), 0.75, 3);
    if (painted && Math.abs(S - painted) / painted < 0.15) return;
    painted = S;
    /* On a coarse screen the sheets are drawn thicker, so none is thinner than about a pixel and
       a half: thinner, the table's slight turn steps them into waves. */
    const f = Math.max(1, 1.45 / S);
    data.forEach((st, i) => {
      const rnd = mulberry(i * 7919 + 17);
      /* A card is thinner than a pixel, so the edge is drawn as sheets of uneven thickness
         (a few cards each): even hairlines alias into waves once the face is tilted. */
      const bands: { z: number; k: number }[] = [];
      for (let z = 0; z < st.h - 0.3; ) {
        const k = Math.min(st.h - z, (1.5 + rnd() * 2.4) * f);
        bands.push({ z, k });
        z += k;
      }
      /* Sheets drift as a stack is built: a random walk, pulled back to the middle. */
      let ax = 0;
      let ay = 0;
      const off = bands.map((b) => {
        ax = ax * 0.8 + (rnd() - 0.5) * 1.1;
        ay = ay * 0.8 + (rnd() - 0.5) * 1.1;
        const kick = rnd() < 0.06 ? (rnd() - 0.5) * 3 : 0;
        return { ...b, x: clamp(ax + kick, -M, M), y: clamp(ay - kick * 0.6, -M, M), l: rnd(), g: 0.22 + rnd() * 0.2 };
      });
      const faces: [HTMLElement, 'front' | 'r' | 'l'][] = [
        [stacks[i].querySelector<HTMLElement>('.lectures__front')!, 'front'],
        [stacks[i].querySelector<HTMLElement>('.lectures__side--r')!, 'r'],
        [stacks[i].querySelector<HTMLElement>('.lectures__side--l')!, 'l'],
      ];
      faces.forEach(([face, kind]) => {
        const front = kind === 'front';
        const cw = front ? W + 2 * M : st.h;
        const ch = front ? st.h : D + 2 * M;
        const c = face.querySelector('canvas') ?? face.appendChild(document.createElement('canvas'));
        c.width = Math.ceil(cw * S);
        c.height = Math.ceil(ch * S);
        const g = c.getContext('2d')!;
        g.scale(S, S);
        off.forEach((o) => {
          /* Where the sheet sits along the stack's height, and which way is down: its underside
             is the thin dark line. */
          const lo = front ? 93.5 + o.l * 4.5 : 86 + o.l * 5.5;
          const gap = front ? 76 + o.l * 5 : 68 + o.l * 5;
          const lit = `hsl(40 ${front ? 20 : 14}% ${lo}%)`;
          const dark = `hsl(35 11% ${gap}%)`;
          const gk = Math.min(o.k * o.g, 0.9 * f);
          if (front) {
            const y = st.h - o.z - o.k;
            g.fillStyle = lit;
            g.fillRect(M + o.x, y, W, o.k - gk);
            g.fillStyle = dark;
            g.fillRect(M + o.x, y + o.k - gk, W, gk + 0.02);
          } else {
            const x = kind === 'r' ? st.h - o.z - o.k : o.z;
            g.fillStyle = lit;
            g.fillRect(kind === 'r' ? x : x + gk, M + o.y, o.k - gk, D);
            g.fillStyle = dark;
            g.fillRect(kind === 'r' ? x + o.k - gk : x, M + o.y, gk + 0.02, D);
          }
        });
        face.classList.add('is-painted');
      });
    });
  };

  /* ---------- thumbing through ---------- */

  let lessons: Lesson[][] | null = null;
  let loading: Promise<void> | null = null;
  const load = () =>
    (loading ??= import('../data/lessons.json').then((mod) => {
      const all = mod.default as Lessons;
      lessons = data.map((st) => all[st.key].lessons);
    }));
  /* The lessons come in as the table nears, or at the first touch of it. */
  const near = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      near.disconnect();
      load();
    },
    { rootMargin: '900px 0px' }
  );
  near.observe(stage);

  const make = (cls: string) => {
    const e = document.createElement('div');
    e.className = cls;
    return e;
  };
  const slot = make('lectures__slot');
  const leaves = [-4, -3, -2, -1, 1, 2, 3, 4].map((j) => {
    const l = make('lectures__leaf');
    l.dataset.j = String(j);
    slot.append(l);
    return l;
  });
  const card = make('lectures__card');
  const lo = document.createElement('img');
  const hi = document.createElement('img');
  lo.alt = hi.alt = '';
  hi.className = 'is-hi';
  card.append(lo, hi);
  slot.append(card);

  /* The pulled card: out past the stack's face, lifted, stood up towards us. */
  const OUT = () => `translateY(${D * 0.68 * u}px) translateZ(${58 * u}px) rotateX(-60deg) scale(1.3)`;
  const IN = 'translateY(0px) translateZ(0px) rotateX(0deg) scale(1)';
  card.style.transform = IN;

  let cur = -1; /* the stack a card is out of */
  let shown = -1; /* the lesson showing */
  let over = -1; /* the stack under the pointer */
  let hiTimer = 0;

  /* Where the pointer is along the stack's height: the height on its front face that projects
     to the pointer's y. */
  const heightAt = (i: number, v: number) => {
    const { x, y } = place[i];
    let a = -80;
    let b = data[i].h + 600;
    for (let k = 0; k < 26; k++) {
      const z = (a + b) / 2;
      if (project(x + W / 2, y + D, z).y > v) a = z;
      else b = z;
    }
    return (a + b) / 2;
  };
  const pick = (i: number, clientY: number) => {
    const st = data[i];
    const z = heightAt(i, clientY - stage.getBoundingClientRect().top);
    return clamp(Math.floor(z / (st.h / st.n)), 0, st.n - 1);
  };

  const fan = (open: boolean) => {
    const sheet = data[cur].h / data[cur].n;
    leaves.forEach((l) => {
      const j = Number(l.dataset.j);
      const out = open ? FAN[Math.abs(j)] : 0;
      l.style.transform = `translateZ(${j * sheet * u}px) translateY(${out * u}px)`;
    });
  };

  /* Small frames for the whole stack, nearest first, a few at a time. */
  const warmed = new Set<number>();
  const warm = (i: number, from: number) => {
    if (warmed.has(i) || !lessons) return;
    warmed.add(i);
    const list = lessons[i];
    const order = list.map((_, j) => j).sort((p, q) => Math.abs(p - from) - Math.abs(q - from));
    let next = 0;
    const one = () => {
      if (next >= order.length) return;
      const im = new Image();
      im.onload = im.onerror = one;
      im.src = frame(list[order[next++]], '');
    };
    for (let k = 0; k < 6; k++) one();
  };

  const words = (i: number, L: Lesson): LabelText => {
    const st = data[i];
    const m = `${st.key === 'quran' || st.key === 'brief' ? `Lesson ${L.n}` : L.t} · ${minutes(L.m)}`;
    if (st.key === 'quran' || st.key === 'brief') return { ar: L.a, t: L.t, m };
    if (st.key === 'companions' && L.w) return { t: L.w, m };
    return { t: st.title, m };
  };

  const show = (j: number, say = false) => {
    if (!lessons || j === shown) return;
    const i = cur;
    const st = data[i];
    const L = lessons[i][j];
    shown = j;
    slot.style.transform = `translateZ(${(j + 0.5) * (st.h / st.n) * u}px)`;
    leaves.forEach((l) => {
      const e = j + Number(l.dataset.j);
      l.style.visibility = e < 0 || e >= st.n ? 'hidden' : '';
    });
    lo.src = frame(L, '');
    hi.classList.remove('is-ready');
    window.clearTimeout(hiTimer);
    hiTimer = window.setTimeout(() => (hi.src = frame(L, 'mq')), 110);
    const text = words(i, L);
    label(i, text);
    hits[i].href = watch(L.id, st.pl);
    const said = [text.t, text.m.replace(' · ', ', ')].join(', ');
    hits[i].setAttribute('aria-label', `${st.title}: ${said}, on YouTube`);
    if (say && live) live.textContent = said;
  };
  hi.addEventListener('load', () => {
    if (lessons && cur >= 0 && shown >= 0 && hi.src === frame(lessons[cur][shown], 'mq')) hi.classList.add('is-ready');
  });

  const enter = (i: number, j: number, say = false) => {
    if (!lessons) {
      load().then(() => {
        if (over === i || document.activeElement === hits[i]) enter(i, j, say);
      });
      return;
    }
    if (cur !== i) {
      if (cur >= 0) leave(cur);
      cur = i;
      shown = -1;
      stacks[i].append(slot);
      /* Start inside the stack, then slide out. */
      card.style.transition = 'none';
      card.style.transform = IN;
      card.classList.remove('is-out');
      fan(false);
      void card.offsetWidth;
      card.style.transition = '';
    }
    labels[i].classList.add('is-on');
    show(j, say);
    card.style.transform = OUT();
    card.classList.add('is-out');
    fan(true);
    warm(i, j);
  };

  const leave = (i: number) => {
    if (cur !== i) return;
    card.style.transform = IN;
    card.classList.remove('is-out');
    fan(false);
    labels[i].classList.remove('is-on');
    label(i);
    hits[i].href = data[i].href;
    hits[i].setAttribute('aria-label', `${data[i].title}, ${data[i].meta.toLowerCase()}, on YouTube`);
    window.clearTimeout(hiTimer);
    cur = -1;
    shown = -1;
  };

  hits.forEach((hit, i) => {
    /* Mouse and pen thumb through; a finger's tap just follows the link to the series. */
    const fine = (e: PointerEvent) => e.pointerType !== 'touch';
    hit.addEventListener('pointerenter', (e) => {
      if (!fine(e)) return;
      over = i;
      enter(i, pick(i, e.clientY));
    });
    hit.addEventListener('pointermove', (e) => {
      if (fine(e) && cur === i && lessons) show(pick(i, e.clientY));
    });
    hit.addEventListener('pointerleave', (e) => {
      if (!fine(e)) return;
      if (over === i) over = -1;
      if (document.activeElement !== hit || !hit.matches(':focus-visible')) leave(i);
    });
    /* Only a keyboard focus pulls a card: a tap focuses the link too, just before its click. */
    hit.addEventListener('focus', () => {
      if (hit.matches(':focus-visible')) enter(i, data[i].n - 1, true);
    });
    hit.addEventListener('blur', () => {
      if (over !== i) leave(i);
    });
    /* The arrow keys walk the stack: up is later, down is earlier. */
    hit.addEventListener('keydown', (e) => {
      if (cur !== i || !lessons) return;
      const n = data[i].n;
      const step: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
      let j = shown;
      if (e.key in step) j = shown + step[e.key];
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = n - 1;
      else return;
      e.preventDefault();
      show(clamp(j, 0, n - 1), true);
    });
  });

  /* ---------- sizes ---------- */

  let frameReq = 0;
  let width = 0;
  const refit = () => {
    /* The table is redrawn at its new size: a stack left open is opened again at the same lesson
       if the pointer or the keyboard is still on it. */
    const was = cur;
    const lesson = shown;
    if (cur >= 0) leave(cur);
    layout();
    paint();
    if (was >= 0 && lesson >= 0 && (over === was || (document.activeElement === hits[was] && hits[was].matches(':focus-visible'))))
      enter(was, lesson);
    /* On a phone the row is wider than the screen: open it on the tower, the others either side. */
    if (stage.clientWidth !== width) {
      width = stage.clientWidth;
      const tower = data.reduce((a, st, i) => (st.h > data[a].h ? i : a), 0);
      const box = hits[tower];
      stage.scrollLeft = box.offsetLeft + box.offsetWidth / 2 - width / 2;
    }
  };
  window.addEventListener('resize', () => {
    cancelAnimationFrame(frameReq);
    frameReq = requestAnimationFrame(refit);
  });
  refit();
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
