import * as THREE from 'three';
import gsap from 'gsap';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* A WebGL stage for the books: one renderer on a canvas filling `host` (a sticky 100svh
   box), a scene and a camera, frames driven by gsap.ticker (in step with Lenis and GSAP), paused
   while the stage is off screen, and the pixel ratio lowered a step if frames stay slow. */

export interface StageOptions {
  fov?: number;
  near?: number;
  far?: number;
  maxDpr?: number;
  shadows?: THREE.ShadowMapType;
  clear?: THREE.ColorRepresentation;
  antialias?: boolean;
}

export interface Pointer {
  ndc: THREE.Vector2; /* -1..1, y up; far off screen while the pointer is outside */
  x: number; /* px in the stage */
  y: number;
  inside: boolean;
  down: boolean;
  vx: number; /* px per second, decaying once the pointer stops */
  vy: number;
  type: string; /* mouse, pen or touch */
  moved: number; /* px travelled since the last pointerdown */
}

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  host: HTMLElement;
  size: { w: number; h: number; dpr: number; phone: boolean };
  pointer: Pointer;
  frame(fn: (dt: number, time: number) => void): void;
  resized(fn: (w: number, h: number) => void): void;
  setRender(fn: () => void): void;
  pick(objects: THREE.Object3D[]): THREE.Intersection | null;
  ray(): THREE.Raycaster;
  studio(intensity?: number): void;
}

export function createStage(host: HTMLElement, o: StageOptions = {}): Stage | null {
  /* Without WebGL 2 the page shows its fallback; asking three first would log errors. */
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) return null;
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  const canvas = document.createElement('canvas');
  canvas.className = 'gl__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: o.antialias ?? true, powerPreference: 'high-performance', stencil: false });
  } catch {
    return null;
  }
  host.prepend(canvas);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(new THREE.Color(o.clear ?? '#fbfaf7'), 1);
  if (o.shadows !== undefined) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = o.shadows;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(o.fov ?? 35, 1, o.near ?? 1, o.far ?? 5000);
  const maxDpr = o.maxDpr ?? 1.5;
  const size = { w: 0, h: 0, dpr: Math.min(window.devicePixelRatio || 1, maxDpr), phone: false };
  const frames: ((dt: number, time: number) => void)[] = [];
  const resizers: ((w: number, h: number) => void)[] = [];
  let render = () => renderer.render(scene, camera);
  const raycaster = new THREE.Raycaster();
  const pointer: Pointer = { ndc: new THREE.Vector2(9, 9), x: 0, y: 0, inside: false, down: false, vx: 0, vy: 0, type: 'mouse', moved: 0 };

  function resize(force = false) {
    const w = Math.max(1, Math.round(host.clientWidth));
    const h = Math.max(1, Math.round(host.clientHeight));
    if (!force && w === size.w && h === size.h) return;
    size.w = w;
    size.h = h;
    size.phone = w < 760;
    renderer.setPixelRatio(size.dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    resizers.forEach((fn) => fn(w, h));
  }
  new ResizeObserver(() => resize()).observe(host);
  resize();

  let lastMove = 0;
  const place = (e: MouseEvent) => {
    const r = host.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  host.addEventListener('pointermove', (e) => {
    const [x, y] = place(e);
    const now = performance.now();
    if (pointer.inside) {
      const dt = Math.max(8, now - lastMove) / 1000;
      pointer.vx = (x - pointer.x) / dt;
      pointer.vy = (y - pointer.y) / dt;
      pointer.moved += Math.hypot(x - pointer.x, y - pointer.y);
    }
    lastMove = now;
    pointer.x = x;
    pointer.y = y;
    pointer.inside = true;
    pointer.type = e.pointerType;
    pointer.ndc.set((x / size.w) * 2 - 1, -(y / size.h) * 2 + 1);
  });
  host.addEventListener('pointerleave', () => {
    pointer.inside = false;
    pointer.ndc.set(9, 9);
  });
  /* A touch arrives with no move before it: take its position here, so a tap picks what it hits. */
  host.addEventListener('pointerdown', (e) => {
    const [x, y] = place(e);
    pointer.x = x;
    pointer.y = y;
    pointer.inside = true;
    pointer.ndc.set((x / size.w) * 2 - 1, -(y / size.h) * 2 + 1);
    pointer.down = true;
    pointer.moved = 0;
    pointer.type = e.pointerType;
  });
  window.addEventListener('pointerup', () => {
    pointer.down = false;
  });
  /* A touch has no hover, so its pointerleave comes before its click: the click brings its own
     position (seen before the page's handlers), and the pointer leaves again once they have run. */
  host.addEventListener(
    'click',
    (e) => {
      if (pointer.type === 'mouse' || e.detail === 0) return;
      const [x, y] = place(e);
      pointer.x = x;
      pointer.y = y;
      pointer.inside = true;
      pointer.ndc.set((x / size.w) * 2 - 1, -(y / size.h) * 2 + 1);
      window.setTimeout(() => {
        pointer.inside = false;
        pointer.ndc.set(9, 9);
      }, 0);
    },
    true
  );

  /* Whether the stage is on screen, read each frame: an IntersectionObserver may never report
     while a recording holds the clock still. */
  const onScreen = () => {
    const r = host.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  };

  /* Recording scripts step a fake clock at 30 fps; they set this so the stage keeps its resolution. */
  const fixed = () => (window as unknown as { __fixedDpr?: boolean }).__fixedDpr === true;
  let slow = 0;
  let last = performance.now();
  gsap.ticker.add(() => {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!onScreen()) return;
    if (now - lastMove > 50) {
      pointer.vx *= 0.82;
      pointer.vy *= 0.82;
    }
    for (const fn of frames) fn(dt, now / 1000);
    render();
    if (!fixed() && size.dpr > 1 && dt > 0.026) {
      if (++slow > 90) {
        slow = 0;
        size.dpr = Math.max(1, size.dpr - 0.25);
        resize(true);
      }
    } else slow = Math.max(0, slow - 1);
  });

  return {
    renderer,
    scene,
    camera,
    canvas,
    host,
    size,
    pointer,
    frame: (fn) => {
      frames.push(fn);
    },
    resized: (fn) => {
      resizers.push(fn);
    },
    setRender: (fn) => {
      render = fn;
    },
    pick(objects) {
      if (!pointer.inside) return null;
      raycaster.setFromCamera(pointer.ndc, camera);
      return raycaster.intersectObjects(objects, true)[0] ?? null;
    },
    ray() {
      raycaster.setFromCamera(pointer.ndc, camera);
      return raycaster;
    },
    studio(intensity = 1) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = intensity;
      pmrem.dispose();
    },
  };
}
