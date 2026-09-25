import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { reduceMotion } from '../smooth';
import { steps } from '../steps';
import { nav, showNav } from '../nav';
import { reveals } from '../reveals';
import { openSheet, sheetOpen } from './sheet';
import { chapterOf, chaptersOf } from './chapters';
import { lookRange, tiltTo, wideFrame } from './framing';
import { readBooks } from './gl/payload';
import { createStage } from './gl/stage';
import { bookKit, makeBook } from './gl/book';
import { fontsReady } from './gl/faces';
import { captions } from './gl/captions';
import { stops } from './gl/stops';
import { makeSky } from './aurora/sky';
import { auroraColours, makeCurtain, type Curtain } from './aurora/curtains';
import { makeIce } from './aurora/ice';
import { gradePass } from './aurora/grade';

/* "Northern lights". The page opens by night inside a ring of books standing on the ice, every
   curtain of aurora alight above them in their colours (curtains.ts), the library's name in the
   sky; the view turns along the ring with the mouse, or a drag. Scrolling then goes language by
   language (a chapter each, chapters.ts): the view turns to the book chosen in that language, its
   curtains light together and its name stands in the sky. Inside a chapter a tap, a swipe or the
   arrow keys choose the book; the chosen book comes close, into the middle of the screen, while its
   curtain surges across the sky and tints the ice. On wide screens the wheel and the keys move by
   the same carry as the home page (steps.ts). */

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const section = $('.aur');
const host = $('.aur__stage', section);
const shade = $('.aur__shade', host);
const head = $('.aur__head', host);
const langBar = $('.aur__langs', head);
const about = $('.aur__about', host);
const navBar = document.querySelector<HTMLElement>('.nav');
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
/* The camera's height above the ice, metres: on a wide screen low, near the books' own height. */
const EYE = { desk: 0.2, upright: 0.3 };
const R = 2.2; /* the ring of books */
/* The ring runs this far either side of its middle (±49°), the books about a hand apart. */
const ARC = 0.86;
/* Where a chosen book comes to stand, as a share of R from the reader: close on a wide screen, in
   the middle of it, looked down on a little (TILT); on an upright one it has the width to itself.
   fit() steps it back where the screen is short. */
const STEP = { desk: 0.28, upright: 0.3 };
const TILT = -0.09;
/* The page opens inside the ring: the camera stands this far out from its centre towards the books,
   this high above the ice and tilted so, and turns about the centre as the reader looks along. */
const OPEN = { forward: 0.75, eye: 0.2, pitch: { desk: -0.03, upright: 0 } };
const CLASSIC = new THREE.Color('#3dffa6');

/* The balance of light by night. The chosen book is the brightest, truest thing on screen: lit
   almost white, its cover shows its printed colours. The aurora stays well below it, a backdrop; a
   light show that outshines the book is uncomfortable to look at. */
const LIGHT = {
  chosen: 0.75, /* the chosen book's curtain */
  group: 0.12, /* the other curtains of its language, lit together as the chapter's band of sky */
  others: 0.035, /* the curtains of the other languages meanwhile */
  rest: 0.12, /* every curtain before a choice */
  whole: 0.36, /* every curtain under the whole sky */
  surge: 0.75, /* the crest that runs along a chosen curtain adds this much of its light, fading */
  horizon: 0.08, /* the chosen colour low on the horizon */
  key: 2.8, /* the spotlight on the chosen book */
  keyTint: 0.05, /* how far its white turns to the aurora's colour */
  sky: 1.3, /* the sky light on every book, so the whole ring reads at night */
  skyTint: 0.1, /* how far it turns to the aurora's colour */
};

function boot() {
  nav();
  showNav();
  reveals();
  section.querySelectorAll<HTMLButtonElement>('[data-sheet]').forEach((b) => b.addEventListener('click', () => openSheet(b.dataset.sheet!, b)));
  const books = readBooks();
  /* The book the address asks for (?book=<id>, as the home page links), read before the first frame:
     that frame rests at the top of the page, which clears the address. */
  const wanted = new URLSearchParams(location.search).get('book');
  /* No multisampling on the canvas: the composer draws into its own targets, so the canvas only ever
     receives one full-screen quad. Phones draw at up to twice their CSS pixels: at the 1.25 larger
     screens keep, a phone's 3x screen stretched the picture more than twice over and it looked soft. */
  const small = Math.min(screen.width, screen.height) < 760;
  const stage = createStage(host, { fov: 46, near: 0.05, far: 6000, maxDpr: small ? 2 : 1.25, clear: '#03060d', antialias: false });
  if (!stage || !books.length) {
    section.classList.add('no-gl');
    return;
  }
  const { scene, camera, renderer, pointer } = stage;
  const caps = captions(host);
  const names = captions(host, '.aur__name');
  const langs = Array.from(langBar.querySelectorAll<HTMLButtonElement>('[data-chapter]'));
  const n = books.length;
  const chapters = chaptersOf(books.map((b) => b.lang));
  const C = chapters.length;

  /* ---------- the night ---------- */

  const sky = makeSky();
  scene.add(sky.group);
  const night = sky.uniforms.uNight;
  const tint = sky.uniforms.uGlow.value;
  tint.copy(CLASSIC);
  /* A low glow of the aurora's colour on the horizon, not a wash over the whole sky. */
  sky.uniforms.uGlowAmt.value = LIGHT.horizon;

  const ice = makeIce(2400, new THREE.Vector2(Math.round(stage.size.w * stage.size.dpr * 0.25), Math.round(stage.size.h * stage.size.dpr * 0.25)));
  scene.add(ice.mesh);

  /* ---------- the books, in a ring around the camera ---------- */

  const kit = bookKit(renderer);
  const objs = books.map((b) => makeBook(b, kit));
  const meshes = objs.map((o) => o.mesh);
  const slots: number[] = [];
  books.forEach((b, i) => slots.push(i === 0 ? 0 : slots[i - 1] + (b.lang !== books[i - 1].lang ? 1.8 : 1)));
  const az = slots.map((v) => (v / slots[n - 1] - 0.5) * 2 * ARC);
  const ring = (i: number, r: number) => new THREE.Vector3(Math.sin(az[i]) * r, 0, -Math.cos(az[i]) * r);
  const home = objs.map((o, i) => {
    const p = ring(i, R);
    p.y = (books[i].size.h / 2) * 0.01 + 0.002;
    o.group.scale.setScalar(0.01);
    o.group.position.copy(p);
    o.group.lookAt(0, p.y, 0);
    scene.add(o.group);
    return p;
  });
  /* Phones, and tablets held upright: the words go under the book. Read from Aurora.astro's own
     media query, so the scene frames the page the way the CSS lays it out. */
  const uprightQuery = matchMedia('(max-width: 760px), (max-aspect-ratio: 4/5)');
  const upright = () => uprightQuery.matches;
  const step = (i: number) => frames[chapterOf(chapters, i)].near;

  /* Each chapter keeps the book chosen in it (its first, to begin with) and the way the camera
     looks to see that book, which turns when another book of the chapter is chosen. */
  const pick = chapters.map((c) => c.first);
  const view = chapters.map((c) => ({ yaw: az[c.first] }));

  const reach = (i: number) => 300 + (i % 3) * 30;
  const curtains: Curtain[] = books.map((b, i) => makeCurtain(b, az[i] * 1.05, reach(i), i * 1.73 + 0.4, night));
  curtains.forEach((c) => {
    c.u.uIntensity.value = LIGHT.rest;
    scene.add(c.mesh);
  });

  /* ---------- light ---------- */

  stage.studio(0.25);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xe8e4dc, 1.2);
  const day = new THREE.DirectionalLight(0xffffff, 2.4);
  day.position.set(1, 3, 2);
  const glow = new THREE.DirectionalLight(0xffffff, 0);
  glow.position.set(0, 4, -3);
  const moon = new THREE.DirectionalLight(0x9fb6ff, 0);
  moon.position.set(3, 2, 1);
  const front = new THREE.SpotLight(0xffffff, 0, 0, 0.2, 0.9, 0);
  front.position.set(0, 0.9, 0.9);
  scene.add(hemi, day, glow, moon, front, front.target);
  const lights = { front: 0 };
  const WHITE = new THREE.Color(0xffffff);
  const DAY_GROUND = new THREE.Color(0xe8e4dc);
  const NIGHT_GROUND = new THREE.Color(0x0a0f18);
  const tFrom = new THREE.Color();
  const tTo = new THREE.Color();
  const tMix = { v: 1 };
  function tintTo(c: THREE.Color) {
    tFrom.copy(tint);
    tTo.copy(c);
    gsap.fromTo(tMix, { v: 0 }, { v: 1, duration: reduceMotion ? 0 : 1.6, ease: 'power2.out', overwrite: true, onUpdate: () => void tint.copy(tFrom).lerp(tTo, tMix.v) });
  }

  /* ---------- the composer ---------- */

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(stage.size.dpr);
  composer.setSize(stage.size.w, stage.size.h);
  composer.addPass(new RenderPass(scene, camera));
  const grade = gradePass();
  composer.addPass(grade);
  /* Draw only when the picture changes: every frame while anything moves (the scroll, a choice, the
     pointer, a resize), and every other frame while only the aurora's slow ripple runs (not at all
     with reduced motion, where the sky holds still). */
  let busyUntil = performance.now() + 1000;
  const busy = (sec: number) => void (busyUntil = Math.max(busyUntil, performance.now() + sec * 1000));
  let skip = false;
  stage.setRender(() => {
    if (performance.now() > busyUntil) {
      if (reduceMotion) return;
      skip = !skip;
      if (skip) return;
    }
    composer.render();
  });
  window.addEventListener('scroll', () => busy(0.4), { passive: true });
  host.addEventListener('pointermove', () => busy(0.6));
  /* A cover that arrives late must still be drawn, even while nothing moves. */
  objs.forEach((o) => o.loaded.then(() => busy(0.3)));
  sky.dpr.value = stage.size.dpr;

  /* Where each chapter's chosen book stands and how the camera turns and tilts to it. Wide, it
     stands close in the middle of the screen, below the languages' row, moving over right of the
     middle where the words beside it would cover it (framing.ts). Upright, it stands between the
     languages' row above and the words below: the camera tilts down until its tallest book's foot
     clears its tallest caption, and steps the book back a little where it would not fit or the tilt
     would hide the sky. Where even that is not enough in some chapter, the chapters' titles make way
     everywhere (the row still names the language). And, wide, the opening view tilts up where the
     row would stand over the books. Measured from the layout, not the drawn page, so it holds while
     the words animate; again on each resize. */
  const FOV = { desk: 46, upright: 62 };
  const frames = chapters.map(() => ({ near: R * STEP.upright, pitch: -0.2, aside: 0 }));
  let openPitch = OPEN.pitch.desk;
  const capBox = $('.aur__caps', host);
  const tallestOf = (list: typeof books) => Math.max(...list.map((b) => b.size.h)) * 0.01 + 0.002;
  function fit() {
    host.classList.remove('is-short');
    const up = upright();
    const H = host.clientHeight;
    const tan = Math.tan((FOV.upright * Math.PI) / 360);
    const tops = caps.items.map((el) => capBox.offsetTop + el.offsetTop);
    const rowFoot = () => head.offsetTop + langBar.offsetTop + langBar.offsetHeight;
    const plan = (c: (typeof chapters)[number], limit: number) => {
      const own = books.slice(c.first, c.last + 1);
      const tallest = tallestOf(own);
      const thickest = Math.max(...own.map((b) => b.size.t)) * 0.01;
      const above = rowFoot() + 16;
      if (!up) {
        const widest = Math.max(...own.map((b) => b.size.w)) * 0.01;
        const clear = capBox.offsetLeft + capBox.offsetWidth + 16;
        return wideFrame({ H, W: host.clientWidth, above, clear, margin: 16, fov: FOV.desk, eye: EYE.desk, pitch: TILT, near: R * STEP.desk, limit, tallest, widest, thickest });
      }
      const below = H - Math.min(...tops.slice(c.first, c.last + 1)) + 20;
      const place = (d: number) => {
        const front = d - thickest / 2;
        const pitch = Math.atan2(-EYE.upright, front) - Math.atan(((2 * below) / H - 1) * tan);
        const top = (H / 2) * (1 - Math.tan(Math.atan2(tallest - EYE.upright, front) - pitch) / tan);
        return { near: d, pitch, aside: 0, fits: top >= above && pitch >= -0.3 };
      };
      let p = place(R * STEP.upright);
      while (!p.fits && p.near < limit) p = place(p.near + 0.02);
      return p;
    };
    let plans = chapters.map((c) => plan(c, R * (up ? 0.4 : 0.45)));
    if (plans.some((p) => !p.fits)) {
      host.classList.add('is-short');
      plans = chapters.map((c) => plan(c, R * 0.8));
    }
    plans.forEach((p, k) => Object.assign(frames[k], { near: p.near, pitch: p.pitch, aside: p.aside }));
    /* How far above the opening camera's eye line it sees the tops of the ring's nearest books. */
    const ahead = Math.atan2(tallestOf(books) - OPEN.eye, R - OPEN.forward - 0.015);
    openPitch = up ? OPEN.pitch.upright : Math.max(OPEN.pitch.desk, tiltTo(FOV.desk, H, ahead, rowFoot() + 24));
  }
  fit();

  /* ---------- looking along the ring as the page opens ---------- */

  /* The view turns about the ring's centre: with the mouse as it crosses the screen (not with reduced
     motion), with a finger (or then the mouse) as it drags the ring along; as far either way as
     brings the ring's end book to the edge (framing.ts). */
  const look = { yaw: 0, target: 0, range: 0, half: 0 };
  function measureLook() {
    const fov = ((upright() ? FOV.upright : FOV.desk) * Math.PI) / 360;
    look.half = Math.atan((stage!.size.w / stage!.size.h) * Math.tan(fov));
    look.range = lookRange({ r: R, forward: OPEN.forward, arc: ARC, half: look.half, pad: 0.07 });
    look.target = clamp(look.target, -look.range, look.range);
  }
  measureLook();

  stage.resized((w, h) => {
    busy(0.5);
    composer.setPixelRatio(stage!.size.dpr);
    composer.setSize(w, h);
    ice.resize(Math.round(w * stage!.size.dpr * 0.25), Math.round(h * stage!.size.dpr * 0.25));
    sky.dpr.value = stage!.size.dpr;
    fit();
    measureLook();
    /* A turn between upright and wide framing moves the chosen book's place out of the ring. */
    if (active >= 0) stepBook(active, true);
  });

  function applyNight(k: number) {
    night.value = k;
    ice.u.uNight.value = k;
    (ice.u.uTint.value as THREE.Color).copy(tint);
    /* The book's colour stays mostly in its curtain; the night keeps its blue. */
    hemi.color.copy(WHITE).lerp(tint, k * LIGHT.skyTint);
    hemi.groundColor.copy(DAY_GROUND).lerp(NIGHT_GROUND, k);
    hemi.intensity = 1.2 + (LIGHT.sky - 1.2) * k;
    day.intensity = 2.4 * (1 - k);
    glow.color.copy(tint);
    glow.intensity = 1.6 * k;
    moon.intensity = 0.35 * k;
    front.color.copy(WHITE).lerp(tint, LIGHT.keyTint);
    front.intensity = LIGHT.key * lights.front * k;
    scene.environmentIntensity = 0.25 * (1 - k) + 0.04;
    grade.uniforms.uTone.value = k;
    grade.uniforms.uVignette.value = 0.55 * k;
    /* Nothing is drawn that cannot be seen: the curtains light from 0.45 of the night and the stars
       from 0.62 (their shaders are black below), and by day the ice is the page's white, so its
       mirror would show nothing. */
    for (const c of curtains) c.mesh.visible = k > 0.45;
    sky.stars.visible = k > 0.62;
    ice.mesh.visible = k > 0.001;
    shade.style.opacity = k.toFixed(3);
    /* The languages are light words for the night; by day they would vanish into the white. */
    langBar.style.opacity = smooth((k - 0.6) / 0.4).toFixed(3);
    langBar.style.visibility = k > 0.6 ? 'visible' : 'hidden';
    const r = host.getBoundingClientRect();
    navBar?.classList.toggle('is-light', r.top <= 1 && r.bottom > 80 && k > 0.45);
  }

  /* ---------- the camera: from inside the ring to the first chapter, then chapter to chapter ---------- */

  function aim(at: { u: number }) {
    const up = upright();
    /* Stop 0 is the ring as the page opens, stop c + 1 chapter c. */
    const pull = 1 - smooth(at.u);
    const u = clamp(at.u - 1, 0, C - 1);
    const i = Math.floor(u);
    const f = smooth(u - i);
    const between = (get: (k: number) => number) => (i >= C - 1 ? get(C - 1) : get(i) + (get(i + 1) - get(i)) * f);
    const turn = between((k) => view[k].yaw - frames[k].aside);
    const low = between((k) => frames[k].pitch);
    const fov = up ? FOV.upright : FOV.desk;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    /* In a chapter the camera stands at the ring's centre, tilted as fit() says; as the page opens it
       stands out towards the books, facing the way the reader has looked. */
    const eye = up ? EYE.upright : EYE.desk;
    const out = OPEN.forward * pull;
    camera.position.set(Math.sin(look.yaw) * out, eye + (OPEN.eye - eye) * pull, -Math.cos(look.yaw) * out);
    const yaw = turn + (look.yaw - turn) * pull;
    const pitch = low + (openPitch - low) * pull;
    const p = camera.position;
    camera.lookAt(p.x + Math.sin(yaw) * 10, p.y + Math.tan(pitch) * 10, p.z - Math.cos(yaw) * 10);
  }

  /* ---------- choosing a book ---------- */

  let active = -1;
  let whole = false;
  /* A chosen book steps out of the ring towards the reader; once it stands still there it takes its
     sharp cover (the upgrade costs a frame or two, which only shows while something moves). */
  function stepBook(i: number, forward: boolean) {
    const to = forward ? ring(i, step(i)) : home[i];
    gsap.to(objs[i].group.position, {
      x: to.x,
      z: to.z,
      duration: reduceMotion ? 0 : forward ? 1.3 : 1,
      ease: 'power3.inOut',
      overwrite: true,
      onComplete: forward ? () => void objs[i].upgrade() : undefined,
    });
  }
  function curtainsTo(intensity: (k: number) => number, spread: (k: number) => number, height: (k: number) => number, duration = 1.6) {
    curtains.forEach((c, k) => {
      gsap.to(c.u.uIntensity, { value: intensity(k), duration: reduceMotion ? 0 : duration, ease: 'power2.out', overwrite: true });
      gsap.to(c.u.uSpread, { value: spread(k), duration: reduceMotion ? 0 : 1.8, ease: 'power3.out', overwrite: true });
      gsap.to(c.u.uHeight, { value: height(k), duration: reduceMotion ? 0 : 1.8, ease: 'power3.out', overwrite: true });
    });
  }
  function release() {
    if (active >= 0) stepBook(active, false);
    active = -1;
    caps.hide();
    gsap.to(lights, { front: 0, duration: reduceMotion ? 0 : 1, overwrite: true });
  }
  function select(i: number) {
    if (i === active) return;
    busy(2.8);
    const prev = active;
    whole = false;
    active = i;
    const lang = books[i].lang;
    curtainsTo(
      (k) => (k === i ? LIGHT.chosen : books[k].lang === lang ? LIGHT.group : LIGHT.others),
      (k) => (k === i ? 1.5 : 1),
      (k) => (k === i ? curtains[k].height * 1.3 : curtains[k].height)
    );
    const c = curtains[i];
    const rtl = books[i].rtl;
    gsap.fromTo(c.u.uWave, { value: rtl ? 1.2 : -0.2 }, { value: rtl ? -0.2 : 1.2, duration: reduceMotion ? 0 : 2.4, ease: 'power1.inOut', overwrite: true });
    gsap.fromTo(c.u.uWaveAmt, { value: reduceMotion ? 0 : LIGHT.surge }, { value: 0, duration: 2.6, ease: 'power2.in', overwrite: true });
    tintTo(auroraColours(books[i]).primary);
    gsap.to(lights, { front: 1, duration: reduceMotion ? 0 : 1.2, overwrite: true });
    front.target.position.copy(ring(i, step(i))).setY(0.12);
    stepBook(i, true);
    if (prev >= 0) stepBook(prev, false);
    caps.show(i, prev < 0 || i > prev ? 1 : -1);
  }
  function wholeSky() {
    if (whole) return;
    busy(2);
    release();
    whole = true;
    curtainsTo(
      () => LIGHT.whole,
      () => 1.25,
      (k) => curtains[k].height * 1.1
    );
    tintTo(CLASSIC);
  }
  /* The name in the sky (the library's under the whole sky, else the chapter's), which language the
     index marks, and a line on the works while the whole sky is up. */
  function showStop(s: number, dir: number) {
    names.show(s, dir);
    langs.forEach((b, k) => b.setAttribute('aria-current', String(k === s - 1)));
    gsap.to(about, { autoAlpha: s === 0 ? 1 : 0, y: s === 0 ? 0 : -10 * dir, duration: reduceMotion ? 0 : s === 0 ? 0.8 : 0.35, delay: s === 0 && !reduceMotion ? 0.18 : 0, ease: s === 0 ? 'power3.out' : 'power2.in', overwrite: true });
  }

  /* The scroll stops for the whole sky, then once per chapter; one gesture goes one stop. On wide
     screens the carry (steps.ts) moves the page between them; it is set up first, so its keys come
     before the stops'. The address follows the book the scroll rests on, not every stop a glide
     passes (WebKit throws after a hundred rewrites in half a minute). */
  const carrying = steps(() => ({ zones: [Array.from({ length: C + 1 }, (_, s) => st.y(s))], marks: [] }));
  const st = stops({
    section,
    stage: host,
    count: C + 1,
    lead: 0,
    per: 1,
    carry: true,
    keys: 'vertical',
    carried: () => carrying.active(),
    onRest: (s) => history.replaceState(null, '', s > 0 ? `?book=${books[pick[s - 1]].id}` : location.pathname),
  });

  let lastStop = -2;
  /* A glide past the next chapter (the languages' row, a book tapped under the whole sky) goes by
     the chapters between without choosing their books, which would step out and back with their
     captions flashing: the chapter it leaves lets its book go at once and the one it goes to opens
     on arrival. The goal is dropped on arrival, when the reader scrolls meanwhile, or after the
     longest glide. */
  let goal = -1;
  let goalUntil = 0;
  function goChapter(c: number) {
    st.go(c + 1);
    if (Math.abs(c + 1 - lastStop) <= 1) return;
    goal = c + 1;
    goalUntil = performance.now() + 2800;
    release();
    names.hide();
    langs.forEach((b, k) => b.setAttribute('aria-current', String(k === c)));
  }
  const drop = () => void (goal = -1);
  window.addEventListener('wheel', drop, { passive: true });
  window.addEventListener('touchstart', drop, { passive: true });

  /* Chooses book i. In the chapter on screen the view turns to it; a book of another chapter (a
     neighbour tapped across the gap, or an arrow or swipe past the chapter's last book) takes the
     scroll on to that chapter, which opens on it. */
  function goBook(i: number) {
    const c = chapterOf(chapters, i);
    if (c < 0) return;
    pick[c] = i;
    if (c + 1 === lastStop) {
      gsap.to(view[c], { yaw: az[i], duration: reduceMotion ? 0 : 1.3, ease: 'power2.inOut', overwrite: true });
      select(i);
      history.replaceState(null, '', `?book=${books[i].id}`);
    } else {
      gsap.killTweensOf(view[c]);
      view[c].yaw = az[i];
      goChapter(c);
    }
  }
  /* At once, to book i: the address's ?book=, and scripted checks. */
  function jumpTo(i: number) {
    const c = chapterOf(chapters, i);
    if (c < 0) return;
    pick[c] = i;
    gsap.killTweensOf(view[c]);
    view[c].yaw = az[i];
    if (c + 1 === lastStop) select(i);
    st.jump(c + 1);
  }

  /* ---------- pointing ---------- */

  /* What the pointer is on: a book, or else the curtain above it; the chosen curtain first, across
     the whole width of its surge. */
  function target() {
    if (!pointer.inside || night.value <= 0.5) return -1;
    const hit = stage!.pick(meshes);
    if (hit) return hit.object.userData.book as number;
    const dir = stage!.ray().ray.direction;
    if (dir.y <= 0.02) return -1;
    const a = Math.atan2(dir.x, -dir.z);
    if (active >= 0) {
      const u = curtains[active].u;
      if (Math.abs(az[active] * 1.05 - a) < Math.atan((u.uLen.value * u.uSpread.value) / 2 / reach(active))) return active;
    }
    let i = -1;
    let best = 0.07;
    curtains.forEach((_, k) => {
      const d = Math.abs(az[k] * 1.05 - a);
      if (d < best) {
        best = d;
        i = k;
      }
    });
    return i;
  }

  let hot = -1;
  function hover(dt: number) {
    hot = pointer.type === 'mouse' ? target() : -1;
    host.classList.toggle('is-hot', hot >= 0);
    curtains.forEach((c, k) => {
      c.u.uHover.value += ((k === hot ? 1 : 0) - c.u.uHover.value) * Math.min(1, dt * 6);
    });
    objs.forEach((o, k) => {
      const want = k === hot ? 0.12 : 0;
      const cur = o.front.emissiveIntensity;
      if (Math.abs(cur - want) > 0.001) {
        o.front.emissive.copy(curtains[k].u.uPrimary.value as THREE.Color);
        o.front.emissiveIntensity = cur + (want - cur) * Math.min(1, dt * 6);
      }
    });
  }

  const words = '.bcap, .bpick, .aur__langs';
  host.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest(words)) return;
    if (pointer.moved > 6) return;
    /* Picked here rather than read from the hover, which a touch never has. */
    const i = target();
    if (i < 0) return;
    if (i === active) openSheet(books[i].id, host);
    else goBook(i);
  });
  host.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => b.addEventListener('click', () => goBook(Number(b.dataset.pick))));
  langs.forEach((b, c) => b.addEventListener('click', () => goChapter(c)));

  /* Left and right go to the next book that way (the scroll keeps up and down, chapter by chapter). */
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (active < 0 || sheetOpen() || !st.inside() || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return;
    e.preventDefault();
    goBook(active + (e.key === 'ArrowRight' ? 1 : -1));
  });

  /* A sideways swipe (or drag) over the stage goes to the next book that way; an upright one
     scrolls the page as ever, since the canvas lets the browser pan only vertically. */
  let swipe: { x: number; y: number; id: number } | null = null;
  /* Only the first finger counts: a second one (a resting thumb) neither starts nor ends a swipe. */
  host.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    swipe = (e.target as HTMLElement).closest(words) ? null : { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  host.addEventListener('pointercancel', (e) => {
    if (e.pointerId === swipe?.id) swipe = null;
  });
  window.addEventListener('pointerup', (e) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    swipe = null;
    if (active < 0 || Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    goBook(active + (dx < 0 ? 1 : -1));
  });

  /* As the page opens, a finger (or, with reduced motion, the mouse's main button) dragging over the
     stage turns the view along the ring, the books ahead keeping pace with it: the camera turns
     about the ring's centre, from which they stand further than from the camera. */
  let drag: { x: number; id: number; mouse: boolean } | null = null;
  host.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || e.button !== 0 || (e.pointerType === 'mouse' && !reduceMotion) || (e.target as HTMLElement).closest(words)) return;
    drag = { x: e.clientX, id: e.pointerId, mouse: e.pointerType === 'mouse' };
  });
  host.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    /* A mouse whose button came up out of sight (a menu took the release) ends the drag. */
    if (drag.mouse && !(e.buttons & 1)) {
      drag = null;
      return;
    }
    const turn = ((e.clientX - drag.x) / stage!.size.w) * 2 * look.half * ((R - OPEN.forward) / R);
    if (lastStop === 0) look.target = clamp(look.target - turn, -look.range, look.range);
    drag.x = e.clientX;
  });
  const undrag = (e: PointerEvent) => void (e.pointerId === drag?.id && (drag = null));
  window.addEventListener('pointerup', undrag);
  host.addEventListener('pointercancel', undrag);

  /* ---------- frames ---------- */

  objs.forEach((o) => (o.front.emissiveIntensity = 0));
  stage.frame((dt, t) => {
    const at = st.at();
    /* Night throughout: the page opens under the whole sky. */
    applyNight(1);
    /* The view follows the mouse along the ring unhurried, a drag closely; drawn every frame while
       it turns and the opening view is on screen. */
    const hand = drag || reduceMotion || pointer.type !== 'mouse';
    if (!hand && pointer.inside) look.target = clamp((pointer.x / stage!.size.w - 0.5) / 0.4, -1, 1) * look.range;
    const was = look.yaw;
    look.yaw += (look.target - look.yaw) * (1 - Math.exp(-dt / (hand ? 0.12 : 0.6)));
    if (Math.abs(look.yaw - was) > 1e-4 && at.u < 1) busy(0.1);
    aim(at);
    /* Between the opening and the first chapter the camera stands out towards the ring, so the
       first chapter's chosen book keeps ahead of it, coming in no faster than the scroll. */
    const pull = 1 - smooth(at.u);
    if (pull > 0) {
      const p = objs[pick[0]].group.position;
      const least = step(pick[0]) + (R - step(pick[0])) * pull;
      if (Math.hypot(p.x, p.z) < least) {
        const q = ring(pick[0], least);
        p.x = q.x;
        p.z = q.z;
      }
    }
    /* With reduced motion the sky holds still: no rippling curtains, no twinkling stars. */
    const clock = reduceMotion ? 12 : t;
    sky.time.value = clock;
    curtains.forEach((c) => (c.u.uTime.value = clock));
    const stop = at.i;
    if (goal >= 0 && (stop === goal || performance.now() > goalUntil)) goal = -1;
    if (stop !== lastStop && goal < 0) {
      const from = lastStop;
      lastStop = stop;
      if (stop === 0) wholeSky();
      else select(pick[stop - 1]);
      showStop(stop, stop > from ? 1 : -1);
    }
    hover(dt);
  });

  function bookAt(i: number) {
    const v = new THREE.Vector3();
    objs[i].mesh.getWorldPosition(v).project(camera);
    const r = host.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * stage!.size.w, y: r.top + ((1 - v.y) / 2) * stage!.size.h };
  }
  /* Where book i lies on screen: its own corners, projected. */
  function bookBox(i: number) {
    const { mesh } = objs[i];
    mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox!;
    const r = host.getBoundingClientRect();
    const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (let k = 0; k < 8; k++) {
      const v = new THREE.Vector3(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).applyMatrix4(mesh.matrixWorld).project(camera);
      const x = r.left + ((v.x + 1) / 2) * stage!.size.w;
      const y = r.top + ((1 - v.y) / 2) * stage!.size.h;
      box.left = Math.min(box.left, x);
      box.right = Math.max(box.right, x);
      box.top = Math.min(box.top, y);
      box.bottom = Math.max(box.bottom, y);
    }
    return box;
  }

  Promise.all(objs.map((o) => o.loaded)).then(() => {
    aim(st.at());
    renderer.compile(scene, camera);
    const at = wanted ? books.findIndex((b) => b.id === wanted) : -1;
    if (at >= 0) jumpTo(at);
    /* For scripted checks of the page. */
    (window as unknown as { __books: object }).__books = {
      ready: true,
      go: jumpTo,
      y: (i: number) => st.y(chapterOf(chapters, i) + 1),
      night: () => night.value,
      bookAt,
      bookBox,
      active: () => active,
      chapter: () => lastStop - 1,
    };
  });
}

/* A font that fails to load must not leave the page blank: the canvases then draw in the fallbacks. */
fontsReady().catch(() => undefined).then(boot);
