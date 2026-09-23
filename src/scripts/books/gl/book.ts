import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { GlBook } from './payload';
import { drawBack, drawEdges, drawSpine } from './faces';

/* A book at its printed size in centimetres: the cover in front under a thin laminate, the back
   and the spine drawn on canvases, paper edges on the other three sides. The spine is on the left,
   or the right for an Arabic book. The group's origin is the book's centre, or with
   `origin: 'top'` the middle of its top edge (to hang it by). */

export interface BookObject {
  data: GlBook;
  group: THREE.Group;
  mesh: THREE.Mesh;
  front: THREE.MeshPhysicalMaterial;
  back: THREE.MeshPhysicalMaterial;
  loaded: Promise<void>;
  upgrade(): Promise<void>;
}

export interface BookKit {
  loader: THREE.TextureLoader;
  aniso: number;
  blank: THREE.Texture;
  head: THREE.Texture;
  fore: THREE.Texture;
}

export function bookKit(renderer: THREE.WebGLRenderer): BookKit {
  const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  blank.needsUpdate = true;
  const edge = (vertical: boolean) => {
    const t = new THREE.CanvasTexture(drawEdges(vertical));
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  return {
    loader: new THREE.TextureLoader(),
    aniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
    blank,
    head: edge(false),
    fore: edge(true),
  };
}

/* The next idle moment (what is left of a frame), or a short wait where there is no idle callback. */
const idle = () =>
  new Promise<void>((resolve) => {
    if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout: 500 });
    else setTimeout(resolve, 50);
  });

const LOW = 20; /* canvas px per cm, every book */
const HIGH = 60; /* for the book a page brings forward */

function srgb<T extends THREE.Texture>(t: T, kit: BookKit) {
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = kit.aniso;
  return t;
}

export function makeBook(b: GlBook, kit: BookKit, opts: { origin?: 'centre' | 'top' } = {}): BookObject {
  const { w, h, t } = b.size;
  const geometry = new RoundedBoxGeometry(w, h, t, 2, Math.min(0.1, t * 0.2));
  /* Starting with a white 1x1 map means the shader never recompiles when the cover arrives. */
  const front = new THREE.MeshPhysicalMaterial({
    map: kit.blank,
    color: new THREE.Color(b.ground),
    roughness: 0.5,
    clearcoat: 0.18,
    clearcoatRoughness: 0.4,
  });
  const back = new THREE.MeshPhysicalMaterial({
    map: srgb(new THREE.CanvasTexture(drawBack(b, LOW)), kit),
    roughness: 0.54,
    clearcoat: 0.15,
    clearcoatRoughness: 0.42,
  });
  const spine = new THREE.MeshPhysicalMaterial({
    map: srgb(new THREE.CanvasTexture(drawSpine(b, LOW * 3)), kit),
    roughness: 0.54,
    clearcoat: 0.15,
    clearcoatRoughness: 0.42,
  });
  const head = new THREE.MeshStandardMaterial({ map: kit.head.clone(), roughness: 0.86 });
  head.map!.repeat.set(1, Math.max(1, t * 4));
  const fore = new THREE.MeshStandardMaterial({ map: kit.fore.clone(), roughness: 0.86 });
  fore.map!.repeat.set(Math.max(1, t * 4), 1);
  /* RoundedBoxGeometry's groups run +x, -x, +y, -y, +z (front), -z (back). */
  const faces = b.rtl ? [spine, fore, head, head, front, back] : [fore, spine, head, head, front, back];
  const mesh = new THREE.Mesh(geometry, faces);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.book = b.i;
  if (opts.origin === 'top') mesh.position.y = -h / 2;
  const group = new THREE.Group();
  group.name = b.id;
  group.add(mesh);

  const loaded = kit.loader.loadAsync(b.cover.sm).then((tex) => {
    front.map = srgb(tex, kit);
    front.color.set(0xffffff);
  });

  /* The sharp cover and back, swapped in one at a time in idle moments: drawing the back and
     uploading either costs a frame or two, so callers upgrade a book once it has come to rest. */
  let upgraded: Promise<void> | null = null;
  const upgrade = () =>
    (upgraded ??= kit.loader.loadAsync(b.cover.lg).then(async (tex) => {
      await idle();
      const old = front.map;
      front.map = srgb(tex, kit);
      front.color.set(0xffffff);
      if (old && old !== kit.blank) old.dispose();
      await idle();
      const was = back.map;
      back.map = srgb(new THREE.CanvasTexture(drawBack(b, HIGH)), kit);
      was?.dispose();
    }));

  return { data: b, group, mesh, front, back, loaded, upgrade };
}
