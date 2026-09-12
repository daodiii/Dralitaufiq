import gsap from 'gsap';
import { lockScroll, reduceMotion } from './smooth';

type Link = { label: string; url: string };
type BookData = {
  id: string;
  title: string;
  subtitle: string | null;
  titleLatin: string | null;
  titleEn: string | null;
  language: 'en' | 'ar' | 'so';
  languageLabel: string;
  role: string;
  series: string | null;
  publisher: string | null;
  year: number | null;
  badge: string | null;
  cover: string;
  ratio: number;
  description: string[];
  links: Link[];
};

const dataEl = document.getElementById('books-data');
const dialog = document.getElementById('book-panel') as HTMLDialogElement | null;

if (dataEl && dialog) {
  const books: BookData[] = JSON.parse(dataEl.textContent || '[]');
  const byId = new Map(books.map((b) => [b.id, b]));
  const panel = dialog.querySelector<HTMLElement>('.panel')!;
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => panel.querySelector<T>(sel)!;

  const cover = q<HTMLImageElement>('.panel__cover img');
  const coverObj = q('.panel__cover .book3d');
  const badge = q('.panel__badge');
  const title = q('.panel__title');
  const subtitle = q('.panel__subtitle');
  const translit = q('.panel__translit');
  const meta = q('.panel__meta');
  const body = q('.panel__body');
  const actions = q('.panel__actions');
  const prev = q<HTMLButtonElement>('.panel__prev');
  const next = q<HTMLButtonElement>('.panel__next');
  const counter = q('.panel__counter');
  const closeBtn = q<HTMLButtonElement>('.panel__close');
  const scroller = q('.panel__scroll');

  let current = 0;
  let lastTrigger: HTMLElement | null = null;
  let open = false;

  const isSheet = () => window.matchMedia('(max-width: 760px)').matches;

  function metaRow(label: string, value: string, lang?: string) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    if (lang) dd.setAttribute('lang', lang);
    meta.append(dt, dd);
  }

  function render(index: number) {
    current = (index + books.length) % books.length;
    const b = books[current];
    cover.src = b.cover;
    cover.alt = `Cover of ${b.title}`;
    coverObj.style.setProperty('--ratio', String(b.ratio));
    badge.textContent = b.badge || b.series || '';
    badge.hidden = !badge.textContent;
    title.textContent = b.title;
    title.setAttribute('lang', b.language === 'ar' ? 'ar' : b.language === 'so' ? 'so' : 'en');
    subtitle.textContent = b.subtitle || '';
    subtitle.hidden = !b.subtitle;
    subtitle.setAttribute('lang', b.language === 'ar' ? 'ar' : 'en');
    const tr = [b.titleLatin, b.titleEn].filter(Boolean).join(' — ');
    translit.textContent = tr;
    translit.hidden = !tr;

    meta.replaceChildren();
    metaRow('Language', b.languageLabel);
    metaRow('Role', b.role);
    if (b.series) metaRow('Series', b.series);
    if (b.publisher || b.year) metaRow('Published', [b.publisher, b.year].filter(Boolean).join(', '));

    body.replaceChildren(
      ...b.description.map((p) => {
        const el = document.createElement('p');
        el.textContent = p;
        if (/[؀-ۿ]/.test(p.slice(0, 40))) el.setAttribute('lang', 'ar');
        return el;
      })
    );
    if (!b.description.length) {
      const el = document.createElement('p');
      el.className = 'muted';
      el.textContent = 'Description coming soon.';
      body.append(el);
    }

    actions.replaceChildren(
      ...b.links.map((l, i) => {
        const a = document.createElement('a');
        a.className = i === 0 ? 'btn btn--primary' : 'btn';
        a.href = l.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = l.label;
        return a;
      })
    );

    counter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(books.length).padStart(2, '0')}`;
    scroller.scrollTop = 0;
  }

  function swap(direction: 1 | -1) {
    if (reduceMotion) {
      render(current + direction);
      return;
    }
    gsap.to(scroller, {
      autoAlpha: 0,
      x: -14 * direction,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => {
        render(current + direction);
        gsap.fromTo(scroller, { autoAlpha: 0, x: 14 * direction }, { autoAlpha: 1, x: 0, duration: 0.5, ease: 'power3.out' });
      },
    });
  }

  function show(id: string, trigger: HTMLElement | null) {
    const index = books.findIndex((b) => b.id === id);
    if (index < 0) return;
    lastTrigger = trigger;
    render(index);
    if (!dialog!.open) dialog!.showModal();
    open = true;
    lockScroll(true);
    dialog!.classList.add('is-open');
    if (reduceMotion) {
      gsap.set(panel, { clearProps: 'all' });
    } else {
      gsap.fromTo(
        panel,
        isSheet() ? { yPercent: 100, xPercent: 0 } : { xPercent: 100, yPercent: 0 },
        { xPercent: 0, yPercent: 0, duration: 0.9, ease: 'power4.out', clearProps: 'transform' }
      );
      gsap.fromTo(
        [q('.panel__cover'), q('.panel__head'), body, actions],
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.07, delay: 0.25, ease: 'power3.out' }
      );
    }
    closeBtn.focus({ preventScroll: true });
  }

  function hide() {
    if (!open) return;
    open = false;
    dialog!.classList.remove('is-open');
    const done = () => {
      dialog!.close();
      lockScroll(false);
      lastTrigger?.focus({ preventScroll: true });
    };
    if (reduceMotion) {
      done();
      return;
    }
    gsap.to(panel, {
      ...(isSheet() ? { yPercent: 100 } : { xPercent: 100 }),
      duration: 0.55,
      ease: 'power3.in',
      onComplete: () => {
        gsap.set(panel, { clearProps: 'transform' });
        done();
      },
    });
  }

  document.addEventListener('click', (e) => {
    const trigger = (e.target as HTMLElement).closest<HTMLElement>('[data-book]');
    if (!trigger) return;
    e.preventDefault();
    show(trigger.dataset.book!, trigger);
  });

  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    hide();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) hide();
  });
  closeBtn.addEventListener('click', hide);
  prev.addEventListener('click', () => swap(-1));
  next.addEventListener('click', () => swap(1));
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') swap(1);
    if (e.key === 'ArrowLeft') swap(-1);
    if (e.key === 'Escape') {
      e.preventDefault();
      hide();
    }
  });
  dialog.addEventListener('close', () => {
    /* Closed by the browser itself (close watcher, form method=dialog): restore state. */
    if (open) {
      open = false;
      dialog!.classList.remove('is-open');
      lockScroll(false);
      lastTrigger?.focus({ preventScroll: true });
    }
  });
}
