import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { reduceMotion } from '../smooth';
import { nav, showNav } from '../nav';
import { reveals } from '../reveals';
import { openSheet } from './sheet';
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

/* "Northern lights". The stage opens white, like the page; the first stretch of scrolling brings
   the night: the sky darkens, the mountains and the ice come out of the white, stars appear and the
   aurora kindles. The books stand on the ice in an arc around a low camera, and above each hangs
   its curtain of aurora in its colours (curtains.ts). Scrolling turns the view along the arc; the
   book it comes to steps forward while its curtain surges across the sky and tints the ice. At the
   end the view draws back under the whole sky, every curtain alight. */

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const section = $('.aur');
const host = $('.aur__stage', section);
const shade = $('.aur__shade', host);
const navBar = document.querySelector<HTMLElement>('.nav');
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
const EYE = 0.3; /* the camera's height above the ice, metres */
const R = 2.2; /* the arc of books */
const CLASSIC = new THREE.Color('#3dffa6');

/* The balance of light by night. The chosen book is the brightest, truest thing on screen: lit
   almost white, its cover shows its printed colours. The aurora stays well below it, a backdrop; a
   light show that outshines the book is uncomfortable to look at. */
const LIGHT = {
  chosen: 0.75, /* the chosen book's curtain */
  others: 0.055, /* the other curtains meanwhile */
  rest: 0.12, /* every curtain before a choice */
  whole: 0.36, /* every curtain under the whole sky */
  surge: 0.75, /* the crest that runs along a chosen curtain adds this much of its light, fading */
  horizon: 0.08, /* the chosen colour low on the horizon */
  key: 2.8, /* the spotlight on the chosen book */
  keyTint: 0.05, /* how far its white turns to the aurora's colour */
  sky: 1.3, /* the sky light on every book, so the whole arc reads at night */
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
     receives one full-screen quad. */
  const stage = createStage(host, { fov: 46, near: 0.05, far: 6000, maxDpr: 1.25, clear: '#fbfaf7', antialias: false });
  if (!stage || !books.length) {
    section.classList.add('no-gl');
    return;
  }
  const { scene, camera, renderer, pointer } = stage;
  const caps = captions(host);
  const n = books.length;

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

  /* ---------- the books, in an arc around the camera ---------- */

  const kit = bookKit(renderer);
  const objs = books.map((b) => makeBook(b, kit));
  const meshes = objs.map((o) => o.mesh);
  const slots: number[] = [];
  books.forEach((b, i) => slots.push(i === 0 ? 0 : slots[i - 1] + (b.lang !== books[i - 1].lang ? 1.8 : 1)));
  /* ±60°: wide enough to turn along, narrow enough that the whole sky mostly fits one wide view. */
  const az = slots.map((v) => (v / slots[n - 1] - 0.5) * 2 * 1.05);
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
     pointer, a resize), every other frame while only the aurora's slow ripple runs, and not at all
     while the stage stands still before the night. */
  let busyUntil = performance.now() + 1000;
  const busy = (sec: number) => void (busyUntil = Math.max(busyUntil, performance.now() + sec * 1000));
  let skip = false;
  stage.setRender(() => {
    if (performance.now() > busyUntil) {
      if (reduceMotion || night.value < 0.45) return;
      skip = !skip;
      if (skip) return;
    }
    composer.render();
  });
  window.addEventListener('scroll', () => busy(0.4), { passive: true });
  host.addEventListener('pointermove', () => busy(0.6));
  /* A cover that arrives late must still be drawn, even on the still white stage. */
  objs.forEach((o) => o.loaded.then(() => busy(0.3)));
  sky.dpr.value = stage.size.dpr;
  stage.resized((w, h) => {
    busy(0.5);
    composer.setPixelRatio(stage!.size.dpr);
    composer.setSize(w, h);
    ice.resize(Math.round(w * stage!.size.dpr * 0.25), Math.round(h * stage!.size.dpr * 0.25));
    sky.dpr.value = stage!.size.dpr;
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
    const r = host.getBoundingClientRect();
    navBar?.classList.toggle('is-light', r.top <= 1 && r.bottom > 80 && k > 0.45);
  }

  /* ---------- the camera: along the arc with the scroll, back for the whole sky ---------- */

  function aim(at: { intro: number; u: number }) {
    const phone = stage!.size.phone;
    let yaw: number;
    if (at.intro < 1) yaw = az[0] * smooth((at.intro - 0.55) / 0.45);
    else {
      const u = Math.min(at.u, n - 1);
      const i = Math.floor(u);
      yaw = i >= n - 1 ? az[n - 1] : az[i] + (az[i + 1] - az[i]) * smooth(u - i);
      if (at.u > n - 1) yaw *= 1 - smooth(at.u - (n - 1));
    }
    const pull = at.u > n - 1 ? smooth(at.u - (n - 1)) : 0;
    const fov = (phone ? 62 : 46) + pull * (phone ? 14 : 18);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    /* A portrait screen steps much further back to hold the whole arc. */
    camera.position.set(0, EYE + pull * 0.4, pull * (phone ? 4.8 : 1.6));
    /* Tilted up just enough for the aurora, not so far that the chosen book leaves the frame. */
    const pitch = (phone ? -0.1 : 0.05) + pull * (phone ? 0.2 : 0.1);
    camera.lookAt(Math.sin(yaw) * 10, camera.position.y + Math.tan(pitch) * 10, camera.position.z - Math.cos(yaw) * 10);
  }

  /* ---------- choosing a book ---------- */

  let active = -1;
  let whole = false;
  /* A chosen book steps out of the arc towards the reader; once it stands still there it takes its
     sharp cover (the upgrade costs a frame or two, which only shows while something moves). */
  function stepBook(i: number, forward: boolean) {
    const to = forward ? ring(i, R * 0.45) : home[i];
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
    curtainsTo(
      (k) => (k === i ? LIGHT.chosen : LIGHT.others),
      (k) => (k === i ? 1.5 : 1),
      (k) => (k === i ? curtains[k].height * 1.3 : curtains[k].height)
    );
    const c = curtains[i];
    const rtl = books[i].rtl;
    gsap.fromTo(c.u.uWave, { value: rtl ? 1.2 : -0.2 }, { value: rtl ? -0.2 : 1.2, duration: reduceMotion ? 0 : 2.4, ease: 'power1.inOut', overwrite: true });
    gsap.fromTo(c.u.uWaveAmt, { value: reduceMotion ? 0 : LIGHT.surge }, { value: 0, duration: 2.6, ease: 'power2.in', overwrite: true });
    tintTo(auroraColours(books[i]).primary);
    gsap.to(lights, { front: 1, duration: reduceMotion ? 0 : 1.2, overwrite: true });
    front.target.position.copy(ring(i, R * 0.45)).setY(0.12);
    stepBook(i, true);
    if (prev >= 0) stepBook(prev, false);
    caps.show(i, prev < 0 || i > prev ? 1 : -1);
  }
  function rest() {
    busy(2);
    release();
    whole = false;
    history.replaceState(null, '', location.pathname);
    curtainsTo(
      () => LIGHT.rest,
      () => 1,
      (k) => curtains[k].height
    );
    tintTo(CLASSIC);
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

  /* The address follows the book the scroll rests on, not every stop a glide passes (WebKit throws
     after a hundred rewrites in half a minute). */
  const st = stops({
    section,
    stage: host,
    count: n + 1,
    lead: 1.1,
    per: 0.7,
    onRest: (i) => history.replaceState(null, '', i < n ? `?book=${books[i].id}` : location.pathname),
  });

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

  host.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.bcap, .bpick')) return;
    if (pointer.moved > 6) return;
    /* Picked here rather than read from the hover, which a touch never has. */
    const i = target();
    if (i < 0) return;
    if (i === active) openSheet(books[i].id, host);
    else st.go(i);
  });
  host.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => b.addEventListener('click', () => st.go(Number(b.dataset.pick))));

  /* ---------- frames ---------- */

  objs.forEach((o) => (o.front.emissiveIntensity = 0));
  let lastStop = -2;
  stage.frame((dt, t) => {
    const at = st.at();
    const k = reduceMotion ? 1 : smooth(at.intro);
    applyNight(k);
    aim(at);
    /* With reduced motion the sky holds still: no rippling curtains, no twinkling stars. */
    const clock = reduceMotion ? 12 : t;
    sky.time.value = clock;
    curtains.forEach((c) => (c.u.uTime.value = clock));
    const stop = at.intro < 0.999 ? -1 : at.i;
    if (stop !== lastStop) {
      lastStop = stop;
      if (stop < 0) rest();
      else if (stop >= n) wholeSky();
      else select(stop);
    }
    hover(dt);
  });

  function bookAt(i: number) {
    const v = new THREE.Vector3();
    objs[i].mesh.getWorldPosition(v).project(camera);
    const r = host.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * stage!.size.w, y: r.top + ((1 - v.y) / 2) * stage!.size.h };
  }

  Promise.all(objs.map((o) => o.loaded)).then(() => {
    aim(st.at());
    renderer.compile(scene, camera);
    const at = wanted ? books.findIndex((b) => b.id === wanted) : -1;
    if (at >= 0) st.jump(at);
    /* For scripted checks of the page. */
    (window as unknown as { __books: object }).__books = { ready: true, go: (i: number) => st.jump(i), y: (i: number) => st.y(i), night: () => night.value, bookAt };
  });
}

/* A font that fails to load must not leave the page blank: the canvases then draw in the fallbacks. */
fontsReady().catch(() => undefined).then(boot);
