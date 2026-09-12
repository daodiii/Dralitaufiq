import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { reduceMotion, scrollToY } from './smooth';

gsap.registerPlugin(ScrollTrigger, SplitText);

const finePointer = window.matchMedia('(pointer: fine)').matches;
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);
const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

/* ------------------------------------------------------------------ */
/* Navigation chrome                                                    */
/* ------------------------------------------------------------------ */

function nav() {
  const bar = $('.nav');
  if (!bar) return;

  ScrollTrigger.create({
    start: 60,
    onUpdate: (self) => bar.classList.toggle('is-scrolled', self.scroll() > 60),
    onRefresh: (self) => bar.classList.toggle('is-scrolled', self.scroll() > 60),
  });

  const progress = $('.nav__progress i');
  if (progress) {
    gsap.to(progress, {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.4 },
    });
  }

  const toggle = $('.nav__toggle');
  const menu = $('.nav__menu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = bar.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      document.documentElement.classList.toggle('menu-open', open);
    });
    menu.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a')) {
        bar.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        document.documentElement.classList.remove('menu-open');
      }
    });
  }

  /* Active section highlighting */
  const links = $$<HTMLAnchorElement>('.nav__menu a[href^="#"]');
  links.forEach((link) => {
    const id = link.getAttribute('href')!.slice(1);
    const section = document.getElementById(id);
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 45%',
      end: 'bottom 45%',
      onToggle: (self) => link.classList.toggle('is-active', self.isActive),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Hero: the opening shot                                               */
/* ------------------------------------------------------------------ */

function hero() {
  const root = $('.hero');
  if (!root) return;
  const media = $('.hero__media', root);
  const glow = $('.hero__glow', root);
  const eyebrow = $('[data-hero="eyebrow"]', root);
  const calli = $('[data-hero="calli"]', root);
  const name = $('[data-hero="name"]', root);
  const lede = $('[data-hero="lede"]', root);
  const cta = $('[data-hero="cta"]', root);
  const rail = $('[data-hero="rail"]', root);
  const bar = $('.nav');

  const all = [media, glow, eyebrow, calli, name, lede, cta, rail, bar].filter(Boolean) as HTMLElement[];

  if (reduceMotion) {
    gsap.set(all, { autoAlpha: 1, clearProps: 'transform,clipPath' });
    return;
  }

  const split = name ? new SplitText(name, { type: 'lines', mask: 'lines', linesClass: 'line' }) : null;

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.15 });

  tl.fromTo(media, { autoAlpha: 0, scale: 1.09 }, { autoAlpha: 1, scale: 1, duration: 3.2, ease: 'power2.out' }, 0)
    .fromTo(glow, { autoAlpha: 0 }, { autoAlpha: 1, duration: 2.4, ease: 'sine.out' }, 0.5)
    .fromTo(eyebrow, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 1 }, 0.9)
    .fromTo(
      calli,
      { autoAlpha: 1, clipPath: 'inset(0 0 0 100%)' },
      { clipPath: 'inset(0 0 0 0%)', duration: 1.5, ease: 'power3.inOut' },
      1.05
    );

  if (split && name) {
    tl.set(name, { autoAlpha: 1 }, 1.3).from(
      split.lines,
      { yPercent: 115, duration: 1.2, stagger: 0.1, ease: 'power4.out' },
      1.3
    );
  }

  tl.fromTo(lede, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1 }, 1.85)
    .fromTo(cta, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1 }, 2.0)
    .fromTo([rail, bar].filter(Boolean), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2 }, 2.2);

  /* Scroll: the camera drifts, the room dims. */
  gsap.to(media, {
    yPercent: 12,
    ease: 'none',
    scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
  });
  const dim = $('.hero__dim', root);
  if (dim) {
    gsap.to(dim, {
      opacity: 0.92,
      ease: 'none',
      scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
    });
  }
  const content = $('.hero__content', root);
  if (content) {
    gsap.to(content, {
      yPercent: -10,
      autoAlpha: 0,
      ease: 'none',
      scrollTrigger: { trigger: root, start: '15% top', end: '75% top', scrub: true },
    });
  }
}

/* ------------------------------------------------------------------ */
/* Generic scroll reveals                                               */
/* ------------------------------------------------------------------ */

function reveals() {
  if (reduceMotion) {
    gsap.set('[data-reveal]', { autoAlpha: 1 });
    gsap.set('[data-split]', { visibility: 'visible' });
    return;
  }

  $$('[data-reveal]').forEach((el) => {
    const delay = parseFloat(el.dataset.delay || '0');
    const y = parseFloat(el.dataset.y || '28');
    gsap.fromTo(
      el,
      { autoAlpha: 0, y },
      {
        autoAlpha: 1,
        y: 0,
        duration: 1.3,
        delay,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      }
    );
  });

  $$('[data-split]').forEach((el) => {
    const split = new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'line' });
    gsap.set(el, { visibility: 'visible' });
    gsap.from(split.lines, {
      yPercent: 110,
      duration: 1.25,
      stagger: 0.09,
      ease: 'power4.out',
      scrollTrigger: { trigger: el, start: 'top 86%', once: true },
    });
  });

  $$('[data-stagger]').forEach((group) => {
    const items = Array.from(group.children) as HTMLElement[];
    gsap.fromTo(
      items,
      { autoAlpha: 0, y: 24 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 1.1,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: group, start: 'top 88%', once: true },
      }
    );
  });

  $$('[data-line]').forEach((el) => {
    gsap.fromTo(
      el,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: 1.6,
        ease: 'power3.inOut',
        transformOrigin: 'left center',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      }
    );
  });
}

/* ------------------------------------------------------------------ */
/* Spotlight: pointer tilt and rotating endorsements                   */
/* ------------------------------------------------------------------ */

function spotlight() {
  const tilt = $('[data-tilt]');
  if (tilt && finePointer && !reduceMotion) {
    const obj = $('.book3d', tilt) || tilt;
    const glare = $('.book3d__glare', tilt);
    const rest = { rotateY: parseFloat(tilt.dataset.restY || '18'), rotateX: 0 };
    gsap.set(obj, rest);
    const move = (e: PointerEvent) => {
      const r = tilt.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      gsap.to(obj, {
        rotateY: rest.rotateY + x * 22,
        rotateX: -y * 14,
        duration: 0.8,
        ease: 'power2.out',
      });
      if (glare) gsap.to(glare, { x: `${x * 60}%`, y: `${y * 60}%`, opacity: 0.55, duration: 0.8 });
    };
    tilt.addEventListener('pointermove', move);
    tilt.addEventListener('pointerleave', () => {
      gsap.to(obj, { ...rest, duration: 1.2, ease: 'power3.out' });
      if (glare) gsap.to(glare, { opacity: 0.25, x: '0%', y: '0%', duration: 1.2 });
    });
  }

  const quotes = $('[data-quotes]');
  if (!quotes) return;
  const items = $$('.quote', quotes);
  const dots = $$('.quotes__dot', quotes);
  if (items.length < 2) return;
  let index = 0;
  let timer = 0;

  const show = (n: number) => {
    index = (n + items.length) % items.length;
    items.forEach((it, k) => it.classList.toggle('is-active', k === index));
    dots.forEach((d, k) => d.setAttribute('aria-selected', String(k === index)));
  };
  const start = () => {
    stop();
    if (reduceMotion) return;
    timer = window.setInterval(() => show(index + 1), 7500);
  };
  const stop = () => window.clearInterval(timer);

  dots.forEach((d, k) =>
    d.addEventListener('click', () => {
      show(k);
      start();
    })
  );
  quotes.addEventListener('pointerenter', stop);
  quotes.addEventListener('pointerleave', start);
  show(0);
  start();
}

/* ------------------------------------------------------------------ */
/* The library shelf: a dolly along the bookcase                       */
/* ------------------------------------------------------------------ */

function shelf() {
  const pin = $('.library__pin');
  const track = $('.library__track');
  if (!pin || !track) return;
  const bar = $('.library__progress i', pin);
  const chips = $$<HTMLButtonElement>('.library__chip');
  const groups = $$('.library__group', track);
  const counter = $('.library__counter', pin);
  const books = $$('.book', track);

  const setActiveChip = (key: string) => chips.forEach((c) => c.classList.toggle('is-active', c.dataset.go === key));

  const mm = gsap.matchMedia();

  mm.add('(min-width: 960px) and (prefers-reduced-motion: no-preference)', () => {
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: pin,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (bar) gsap.set(bar, { scaleX: self.progress });
          const viewX = self.progress * distance() + window.innerWidth * 0.5;
          let current = groups[0];
          groups.forEach((g) => {
            if (g.offsetLeft <= viewX) current = g;
          });
          if (current) setActiveChip(current.dataset.group || 'all');
          if (counter) {
            /* The reading line drifts from centre to the right edge as the shelf ends,
               so the first book reads 01 at rest and the last one is reached at the end. */
            const line = self.progress * distance() + window.innerWidth * (0.5 + 0.25 * self.progress);
            let n = 0;
            books.forEach((b) => {
              if (b.offsetLeft + b.offsetWidth <= line) n += 1;
            });
            counter.textContent = String(Math.max(1, Math.min(books.length, n))).padStart(2, '0');
          }
        },
      },
    });

    /* Individual books lean in as the camera passes. */
    books.forEach((book) => {
      const obj = $('.book__obj', book);
      if (!obj) return;
      gsap.fromTo(
        obj,
        { rotateY: 34, y: 20, autoAlpha: 0.6 },
        {
          rotateY: 0,
          y: 0,
          autoAlpha: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: book,
            containerAnimation: tween,
            start: 'left 110%',
            end: 'left 60%',
            scrub: true,
          },
        }
      );
    });

    const jump = (key: string) => {
      const st = tween.scrollTrigger!;
      let x = 0;
      if (key !== 'all') {
        const g = groups.find((el) => el.dataset.group === key);
        if (g) x = Math.max(0, g.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft || '0'));
      }
      const d = distance();
      const y = st.start + (d ? (Math.min(x, d) / d) * (st.end - st.start) : 0);
      scrollToY(y);
    };
    const handler = (e: Event) => jump((e.currentTarget as HTMLElement).dataset.go || 'all');
    chips.forEach((c) => c.addEventListener('click', handler));

    return () => {
      chips.forEach((c) => c.removeEventListener('click', handler));
    };
  });

  mm.add('(max-width: 959px), (prefers-reduced-motion: reduce)', () => {
    const handler = (e: Event) => {
      const key = (e.currentTarget as HTMLElement).dataset.go || 'all';
      const g = key === 'all' ? groups[0] : groups.find((el) => el.dataset.group === key);
      if (g) track.scrollTo({ left: g.offsetLeft - 16, behavior: reduceMotion ? 'auto' : 'smooth' });
      setActiveChip(key);
    };
    chips.forEach((c) => c.addEventListener('click', handler));
    const onScroll = () => {
      const viewX = track.scrollLeft + track.clientWidth * 0.4;
      let current = groups[0];
      groups.forEach((g) => {
        if (g.offsetLeft <= viewX) current = g;
      });
      if (current) setActiveChip(current.dataset.group || 'all');
      if (bar) gsap.set(bar, { scaleX: track.scrollLeft / Math.max(1, track.scrollWidth - track.clientWidth) });
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      chips.forEach((c) => c.removeEventListener('click', handler));
      track.removeEventListener('scroll', onScroll);
    };
  });
}

/* ------------------------------------------------------------------ */
/* About: counters and the drawn timeline                              */
/* ------------------------------------------------------------------ */

function about() {
  $$('[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count || '0');
    const suffix = el.dataset.suffix || '';
    if (reduceMotion) {
      el.textContent = `${target}${suffix}`;
      return;
    }
    const state = { n: 0 };
    gsap.to(state, {
      n: target,
      duration: 2,
      ease: 'power3.out',
      snap: { n: 1 },
      onUpdate: () => {
        el.textContent = `${Math.round(state.n)}${suffix}`;
      },
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  const line = $('.timeline__line i');
  const timeline = $('.timeline');
  if (line && timeline && !reduceMotion) {
    gsap.fromTo(
      line,
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: 'none',
        transformOrigin: 'top center',
        scrollTrigger: { trigger: timeline, start: 'top 70%', end: 'bottom 55%', scrub: 0.6 },
      }
    );
  }

  const media = $('.about__media img');
  if (media && !reduceMotion) {
    gsap.fromTo(
      media,
      { yPercent: -6, scale: 1.12 },
      {
        yPercent: 6,
        scale: 1.12,
        ease: 'none',
        scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'bottom top', scrub: true },
      }
    );
  }
}

/* ------------------------------------------------------------------ */

function init() {
  document.documentElement.classList.add('js');
  nav();
  hero();
  reveals();
  spotlight();
  shelf();
  about();
  ScrollTrigger.refresh();
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(init);
} else {
  init();
}

window.addEventListener('load', () => ScrollTrigger.refresh());
