/**
 * The lectures page (components/ReadingRoom.astro). The list shows a series at a time, chosen by
 * the names above it (and ?series= in the address, so a series can be linked); the preview beside
 * it follows the pointer and the keyboard through the list and remembers the last lesson of each
 * series. A phone has no room beside the list: there a tapped row opens where it is, into the
 * same preview, and a second tap closes it. On a wide touch screen the first tap on a row shows
 * it beside the list and a second opens it. The frame comes in small at once and sharp a moment
 * later: the YouTube picture chosen for the lesson (lib/stills.ts), the largest YouTube has.
 */
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import LESSONS from '../data/lessons.json';
import { describe, talkMeta, video, TALKS, type Lessons } from '../lib/lectures';
import { still, pictureOf, sharpSizes } from '../lib/stills';
import { getLenis, reduceMotion, scrollToY } from './smooth';
import { nav, showNav } from './nav';
import { reveals } from './reveals';

const data = LESSONS as Lessons;

nav();
showNav();
reveals();

const room = document.querySelector<HTMLElement>('.room');
if (room) mount(room);

function mount(room: HTMLElement) {
  const $ = <T extends Element>(sel: string) => room.querySelector<T>(sel)!;
  const tabs = [...room.querySelectorAll<HTMLAnchorElement>('.room__tabs a')];
  const line = $<HTMLElement>('.room__line');
  const shelves = [...room.querySelectorAll<HTMLElement>('.room__shelf')];
  const view = $<HTMLElement>('.room__view');
  const open = $<HTMLElement>('.room__open');
  const card = $<HTMLElement>('.room__sticky');
  const frame = $<HTMLAnchorElement>('.room__frame');
  const lo = $<HTMLImageElement>('.room__lo');
  const hi = $<HTMLImageElement>('.room__hi');
  const ar = $<HTMLElement>('.room__ar');
  const title = $<HTMLElement>('.room__title');
  const meta = $<HTMLElement>('.room__meta');
  const watch = $<HTMLAnchorElement>('.room__watch');
  const near = [...room.querySelectorAll<HTMLButtonElement>('.room__near button')];
  /* As in the stylesheet: below it, no room for the preview beside the list. */
  const narrow = window.matchMedia('(max-width: 1000px)');

  const rowsOf = (shelf: HTMLElement) => [...shelf.querySelectorAll<HTMLAnchorElement>('.room__row')];
  const told = (key: string, k: number) => {
    if (key === 'talks') {
      const t = TALKS[k];
      return { pic: pictureOf(t), ar: '', title: t.title, meta: talkMeta(t), href: video(t.id) };
    }
    const l = data[key].lessons[k];
    return { pic: pictureOf(l), ...describe(key, l, data[key].pl) };
  };

  /* ---------- the frame: small at once, sharp when the reader stays ---------- */

  type Pic = ReturnType<typeof pictureOf>;
  /* The picture wanted now, by its small address (two lessons can share a picture). */
  let want = '';
  let sharpTimer = 0;
  /* The sharp download under way: left behind, it is dropped. */
  let probe: HTMLImageElement | null = null;
  const drop = () => {
    if (!probe) return;
    probe.onload = probe.onerror = null;
    probe.src = '';
    probe = null;
  };
  const sharpen = (p: Pic, s: number) => {
    const sizes = sharpSizes(p.x);
    const url = still(p.id, p.f, sizes[s]);
    const im = (probe = new Image());
    im.onload = () => {
      if (probe !== im) return;
      probe = null;
      /* YouTube answers a size it does not have with a 120 px grey placeholder (should the one
         the lesson names have gone): the next size, or the small frame stays. */
      if (im.naturalWidth <= 120) {
        if (s < sizes.length - 1) sharpen(p, s + 1);
        return;
      }
      hi.src = url;
      hi.decode?.().then(
        () => want === still(p.id, p.f, 'mq') && hi.classList.add('is-ready'),
        () => {}
      );
    };
    im.onerror = () => {
      if (probe !== im) return;
      probe = null;
      if (s < sizes.length - 1) sharpen(p, s + 1);
    };
    im.src = url;
  };
  const showFrame = (p: Pic) => {
    const small = still(p.id, p.f, 'mq');
    if (small === want) return;
    want = small;
    lo.src = small;
    hi.classList.remove('is-ready');
    window.clearTimeout(sharpTimer);
    drop();
    sharpTimer = window.setTimeout(() => sharpen(p, 0), 160);
  };

  /* ---------- the preview ---------- */

  let shelf = shelves[0];
  let row: HTMLAnchorElement | null = null;
  const last = new Map<string, number>();

  /* A row brought into view (from the keyboard, or by "Before it" / "After it") comes clear of the
     bar and the series names, which stay over the top of the list. Done here: page-wide
     scroll-padding would do it for the rows, but it also makes Chrome scroll the page on every Tab
     onto a name in the stuck bar, which no scroll can bring out of the padding. */
  const bringIn = (r: HTMLElement) => {
    const box = r.getBoundingClientRect();
    const clear = $<HTMLElement>('.room__tabs').getBoundingClientRect().bottom + 8;
    if (box.top < clear) scrollToY(window.scrollY + box.top - clear, true);
    else if (box.bottom > window.innerHeight - 8) scrollToY(window.scrollY + box.bottom - window.innerHeight + 8, true);
  };

  const pick = (r: HTMLAnchorElement, reveal = false) => {
    if (r === row) return;
    row?.classList.remove('is-on');
    row = r;
    r.classList.add('is-on');
    const key = shelf.dataset.key!;
    const k = Number(r.dataset.k);
    last.set(key, k);
    const t = told(key, k);
    ar.textContent = t.ar;
    title.textContent = t.title;
    meta.textContent = t.meta;
    watch.href = frame.href = t.href;
    showFrame(t.pic);
    const rows = rowsOf(shelf);
    const i = rows.indexOf(r);
    /* At either end of the series the step that way goes; focus on it moves to the other. */
    const held = near.find((b) => b === document.activeElement);
    near.forEach((b) => {
      const other = rows[i + Number(b.dataset.go)];
      b.disabled = !other;
      b.querySelector('b')!.textContent = other ? told(key, Number(other.dataset.k)).title : '';
    });
    if (held?.disabled) (near.find((b) => !b.disabled) ?? watch).focus();
    if (reveal) bringIn(r);
  };
  const unpick = () => {
    row?.classList.remove('is-on');
    row = null;
  };

  /* Beside the list the pointer and the keyboard choose. A finger's first tap on a row shows it
     and a second opens it: the row shown when the finger came down tells them apart, since a tap
     can focus the link (and so show it) before its click. On a phone a row opens where it is. */
  let touchFrom: HTMLAnchorElement | null | undefined;
  room.addEventListener('pointerdown', (e) => {
    touchFrom = e.pointerType === 'touch' ? row : undefined;
  });
  room.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch' || narrow.matches) return;
    const r = (e.target as Element).closest<HTMLAnchorElement>('.room__row');
    if (r) pick(r);
  });
  room.addEventListener('focusin', (e) => {
    const r = (e.target as Element).closest<HTMLAnchorElement>('.room__row');
    if (!r) return;
    /* After the browser's own scroll to it, which leaves a row going up under the bars. */
    if (r.matches(':focus-visible')) requestAnimationFrame(() => document.activeElement === r && bringIn(r));
    if (!narrow.matches) pick(r);
  });
  /* A key after a touch that ended as a scroll is the keyboard's: Enter opens, as it should. */
  room.addEventListener('keydown', () => {
    touchFrom = undefined;
  });
  near.forEach((b) =>
    b.addEventListener('click', () => {
      const rows = rowsOf(shelf);
      const other = rows[rows.indexOf(row!) + Number(b.dataset.go)];
      if (other) pick(other, true);
    })
  );

  /* ---------- a phone: the row opens where it is ---------- */

  const allRows = [...room.querySelectorAll<HTMLAnchorElement>('.room__row')];
  let opened: HTMLAnchorElement | null = null;

  /* Every row says whether it is open, to a screen reader, while rows open. */
  const mark = () =>
    allRows.forEach((r) => {
      if (narrow.matches) {
        r.setAttribute('aria-expanded', String(r === opened));
        r.setAttribute('aria-controls', 'room-open');
      } else {
        r.removeAttribute('aria-expanded');
        r.removeAttribute('aria-controls');
      }
    });

  /* Fold the preview away: at once when it moves to another row, else as it opened. */
  const shut = (instant = false) => {
    if (instant) open.style.transition = card.style.transition = 'none';
    open.classList.remove('is-open');
    if (instant) {
      void open.offsetHeight;
      open.style.transition = card.style.transition = '';
    }
    opened?.setAttribute('aria-expanded', 'false');
    opened = null;
  };

  const glide = (y: number) => {
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(y, { duration: 0.7, easing: (t) => 1 - Math.pow(1 - t, 3) });
    else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const openAt = (r: HTMLAnchorElement) => {
    const y0 = r.getBoundingClientRect().top;
    shut(true);
    r.after(open);
    unpick();
    pick(r);
    opened = r;
    r.setAttribute('aria-expanded', 'true');
    /* The row stays where it was tapped, though a preview above it has folded away. */
    const dy = r.getBoundingClientRect().top - y0;
    if (Math.abs(dy) > 0.5) scrollToY(window.scrollY + dy, true);
    void open.offsetHeight;
    open.classList.add('is-open');
    /* Then the page comes up far enough to show the whole preview, the row still in sight
       under the names. */
    const box = r.getBoundingClientRect();
    const over = box.bottom + card.scrollHeight + 12 - window.innerHeight;
    const space = box.top - $<HTMLElement>('.room__tabs').getBoundingClientRect().bottom - 8;
    if (over > 0 && space > 0) glide(window.scrollY + Math.min(over, space));
  };

  room.addEventListener('click', (e) => {
    const r = (e.target as Element).closest<HTMLAnchorElement>('.room__row');
    const from = touchFrom;
    touchFrom = undefined;
    /* A click meant for a new tab still goes to YouTube. */
    if (!r || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (narrow.matches) {
      e.preventDefault();
      if (r === opened) {
        unpick();
        shut();
      } else openAt(r);
    } else if (from !== undefined && r !== from) {
      e.preventDefault();
      pick(r);
    }
  });

  /* ---------- the series ---------- */

  /* The chosen name in sight on the line of names, clear of its faded edge. */
  const showTab = (t: HTMLElement, instant: boolean) => {
    if (line.scrollWidth <= line.clientWidth) return;
    const cs = getComputedStyle(line);
    const a = t.offsetLeft - parseFloat(cs.paddingLeft);
    const b = t.offsetLeft + t.offsetWidth + parseFloat(cs.paddingRight) - line.clientWidth;
    const x = a < line.scrollLeft ? a : b > line.scrollLeft ? b : line.scrollLeft;
    if (x !== line.scrollLeft) line.scrollTo({ left: x, behavior: instant || reduceMotion ? 'auto' : 'smooth' });
  };
  const tabOn = () => tabs.find((t) => t.classList.contains('is-on'));

  const choose = (key: string, write = true) => {
    const next = shelves.find((s) => s.dataset.key === key) ?? shelves[0];
    const move = next !== shelf;
    /* The series already shown: a click on its name changes nothing. */
    if (!move && write) return;
    shelf.classList.remove('is-on');
    next.classList.add('is-on');
    shelf = next;
    tabs.forEach((t) => {
      const on = t.dataset.key === next.dataset.key;
      t.classList.toggle('is-on', on);
      if (on) {
        t.setAttribute('aria-current', 'true');
        showTab(t, !write);
      } else t.removeAttribute('aria-current');
    });
    unpick();
    if (narrow.matches) shut(true);
    else {
      const rows = rowsOf(next);
      const k = last.get(next.dataset.key!);
      pick(rows.find((r) => Number(r.dataset.k) === k) ?? rows[0]);
    }
    if (write) history.replaceState(null, '', next === shelves[0] ? location.pathname : `?series=${next.dataset.key}`);
    if (!move) return;
    /* The new list starts at the top of the page: straight there (the old list is gone). A link
       that opened on this series keeps the place the browser gave back. */
    if (write && window.scrollY > 0) scrollToY(0, true);
    /* The page is another length now: whatever the scroll places (the footer's reveals, the
       bar's marks) is measured again, and Lenis learns the new height. */
    getLenis()?.resize();
    ScrollTrigger.refresh();
  };

  tabs.forEach((t) => {
    /* Without the script a name leads down the page to its series; with it, the name's link is
       its series' address (for a new tab, or to copy). */
    t.href = t.dataset.key === shelves[0].dataset.key ? location.pathname : `${location.pathname}?series=${t.dataset.key}`;
    t.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      choose(t.dataset.key!);
    });
  });

  /* Across the width where the preview moves: it goes back beside the list on the lesson that
     was open (or the series' last), or leaves it, closed. */
  narrow.addEventListener('change', () => {
    const was = opened;
    shut(true);
    unpick();
    if (!narrow.matches) {
      view.append(open);
      const rows = rowsOf(shelf);
      pick(was ?? rows.find((r) => Number(r.dataset.k) === last.get(shelf.dataset.key!)) ?? rows[0]);
    }
    mark();
    const on = tabOn();
    if (on) showTab(on, true);
  });

  /* The series asked for: ?series=, or a link to its heading (#t-<key>, the names without the
     script). */
  const heading = location.hash.startsWith('#t-') ? location.hash.slice(3) : null;
  const asked = new URLSearchParams(location.search).get('series') ?? heading;
  choose(asked ?? shelves[0].dataset.key!, false);
  /* The series is shown by the classes now, no longer by the mark the page opened with. */
  delete document.documentElement.dataset.series;
  mark();
  /* The names are measured again once the page's font is in. */
  document.fonts?.ready.then(() => {
    const on = tabOn();
    if (on) showTab(on, true);
  });
}
