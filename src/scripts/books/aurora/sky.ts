import * as THREE from 'three';

/* The night: a sky dome that runs from the page's white through dusk to night as uNight goes 0 to
   1, glowing low in the chosen aurora's colour; stars that come out last; and two ridges of far
   mountains, the page's white by day and silhouettes by night with the aurora on their crests.
   Metres; the camera stands at the centre. */

export const PAGE = new THREE.Color('#fbfaf7');

const DOME_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const DOME_FRAG = /* glsl */ `
uniform float uNight;
uniform vec3 uPage;
uniform vec3 uGlow;
uniform float uGlowAmt;
varying vec3 vDir;
void main() {
  float h = max(vDir.y, 0.0);
  vec3 dusk = mix(vec3(0.26, 0.29, 0.40), vec3(0.035, 0.05, 0.11), pow(h, 0.55));
  vec3 night = mix(vec3(0.006, 0.013, 0.032), vec3(0.0006, 0.0014, 0.0045), pow(h, 0.45));
  vec3 col = uNight < 0.5 ? mix(uPage, dusk, smoothstep(0.0, 0.5, uNight)) : mix(dusk, night, smoothstep(0.5, 1.0, uNight));
  col += uGlow * uGlowAmt * exp(-h * 4.0) * smoothstep(0.45, 1.0, uNight);
  gl_FragColor = vec4(col, 1.0);
}`;

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uDpr;
varying float vShine;
void main() {
  vShine = 0.65 + 0.35 * sin(uTime * (0.6 + fract(aPhase * 7.1) * 1.8) + aPhase);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
  gl_PointSize = aSize * uDpr;
}`;

const STAR_FRAG = /* glsl */ `
uniform float uNight;
varying float vShine;
void main() {
  float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
  gl_FragColor = vec4(vec3(0.9, 0.93, 1.0) * a * vShine * smoothstep(0.62, 1.0, uNight), 1.0);
}`;

const RIDGE_VERT = /* glsl */ `
attribute float aTop;
varying float vTop;
void main() {
  vTop = aTop;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const RIDGE_FRAG = /* glsl */ `
uniform float uNight;
uniform vec3 uPage;
uniform vec3 uColor;
uniform vec3 uGlow;
uniform float uGlowAmt;
varying float vTop;
void main() {
  vec3 col = mix(uPage, uColor, smoothstep(0.15, 0.85, uNight));
  col += uGlow * uGlowAmt * 0.14 * smoothstep(0.94, 1.0, vTop) * smoothstep(0.5, 1.0, uNight);
  gl_FragColor = vec4(col, 1.0);
}`;

type Shared = { uNight: THREE.IUniform<number>; uPage: THREE.IUniform<THREE.Color>; uGlow: THREE.IUniform<THREE.Color>; uGlowAmt: THREE.IUniform<number> };

/* A ridge of mountains along an arc: a strip from below the ice up to a crest line. */
function ridge(radius: number, height: number, seed: number, colour: THREE.Color, shared: Shared) {
  const segs = 260;
  const pos = new Float32Array((segs + 1) * 6);
  const top = new Float32Array((segs + 1) * 2);
  const index: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const az = -1.9 + (i / segs) * 3.8;
    const x = Math.sin(az) * radius;
    const z = -Math.cos(az) * radius;
    const crest =
      height *
      (0.55 + 0.25 * Math.sin(az * 3.1 + seed) + 0.14 * Math.sin(az * 7.3 + seed * 2.1) + 0.07 * Math.sin(az * 17.9 + seed * 0.7) + 0.035 * Math.sin(az * 41.3 + seed * 1.3));
    pos.set([x, -6, z, x, crest, z], i * 6);
    top.set([0, 1], i * 2);
    if (i < segs) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aTop', new THREE.BufferAttribute(top, 1));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({ vertexShader: RIDGE_VERT, fragmentShader: RIDGE_FRAG, uniforms: { ...shared, uColor: { value: colour } }, side: THREE.DoubleSide })
  );
  mesh.frustumCulled = false;
  return mesh;
}

export function makeSky() {
  const group = new THREE.Group();
  const uniforms: Shared = { uNight: { value: 0 }, uPage: { value: PAGE.clone() }, uGlow: { value: new THREE.Color('#3dffa6') }, uGlowAmt: { value: 0.35 } };

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3000, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, uniforms, side: THREE.BackSide, depthWrite: false })
  );
  dome.renderOrder = -2;
  dome.frustumCulled = false;
  group.add(dome);

  const count = 2400;
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  let s = 5;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < count; i++) {
    const az = rand() * Math.PI * 2;
    const el = Math.asin(0.03 + rand() * 0.97);
    pos.set([Math.cos(el) * Math.sin(az) * 1900, Math.sin(el) * 1900, -Math.cos(el) * Math.cos(az) * 1900], i * 3);
    size[i] = 0.6 + Math.pow(rand(), 5) * 2.6;
    phase[i] = rand() * 6.283;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const time = { value: 0 };
  const dpr = { value: 1 };
  const stars = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: { uNight: uniforms.uNight, uTime: time, uDpr: dpr },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  stars.renderOrder = -1;
  stars.frustumCulled = false;
  group.add(stars);

  group.add(ridge(1200, 150, 2.3, new THREE.Color(0.009, 0.015, 0.03), uniforms));
  group.add(ridge(700, 70, 0.7, new THREE.Color(0.004, 0.007, 0.014), uniforms));
  return { group, uniforms, time, dpr, stars };
}
