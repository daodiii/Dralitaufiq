import * as THREE from 'three';
import type { GlBook } from '../gl/payload';

/* The aurora: one curtain of light for each book, hung in the sky above it, in that book's colours
   (its most telling colour along the bright lower edge, a second in the rays above). Each curtain
   is a ribbon folded by travelling waves (right to left for an Arabic book) and shaded as rays; it
   adds its light to the sky. Metres. */

export interface Curtain {
  mesh: THREE.Mesh;
  u: Record<string, THREE.IUniform>;
  height: number;
}

const VERT = /* glsl */ `
uniform float uTime;
uniform float uSpread;
uniform float uHeight;
uniform float uLen;
uniform float uDir;
uniform float uSeed;
uniform vec3 uFoot;
uniform vec3 uAlong;
uniform vec3 uAcross;
varying vec2 vUv;
float wave(float x) { return sin(x) * 0.5 + sin(x * 2.13 + 1.7) * 0.3 + sin(x * 4.71 + 0.3) * 0.2; }
void main() {
  float s = uv.x - 0.5;
  float t = uTime * 0.12;
  float fold = wave(s * 7.0 - uDir * t * 2.3 + uSeed) * 0.18 + wave(s * 17.0 - uDir * t * 4.1 + uSeed * 1.7) * 0.05;
  float bend = wave(s * 2.2 + t * 0.6 + uSeed * 3.1) * 0.35;
  vec3 foot = uFoot + uAlong * s * uLen * uSpread + uAcross * (fold + bend) * uLen * 0.35;
  /* The lower edge ripples, as a real curtain's does. */
  foot.y += wave(s * 3.1 + t * 0.5 + uSeed) * 14.0 + wave(s * 9.7 - uDir * t + uSeed * 2.3) * 4.0;
  float h = uHeight * (0.75 + 0.25 * wave(s * 5.0 + t + uSeed * 0.7));
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(foot + vec3(0.0, uv.y * h, 0.0), 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform float uIntensity;
uniform float uHover;
uniform float uTime;
uniform float uDir;
uniform float uSeed;
uniform float uWave;
uniform float uWaveAmt;
uniform float uNight;
varying vec2 vUv;
float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float noise(float x) { float i = floor(x); float f = fract(x); return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f)); }
void main() {
  float s = vUv.x;
  float v = vUv.y;
  float t = uTime;
  float edge = smoothstep(0.0, 0.14, s) * smoothstep(1.0, 0.86, s);
  float rays = noise(s * 90.0 - uDir * t * 0.9 + uSeed * 13.0) * 0.6 + noise(s * 230.0 - uDir * t * 1.7 + uSeed * 7.0) * 0.4;
  rays = pow(rays, 2.0);
  float lower = smoothstep(0.0, 0.035, v) * exp(-v * 3.2);
  float upper = smoothstep(0.02, 0.4, v) * exp(-v * 1.4) * 0.35;
  float k = (lower * (0.55 + 0.9 * rays) + upper * (0.3 + 0.7 * rays)) * edge;
  k *= 1.0 + exp(-pow((s - uWave) * 6.0, 2.0)) * uWaveAmt;
  k *= 1.0 + uHover * 0.8;
  vec3 col = mix(uPrimary, uSecondary, smoothstep(0.08, 0.7, v));
  float flicker = 0.82 + 0.18 * noise(t * 1.3 + uSeed * 5.0);
  gl_FragColor = vec4(col * k * uIntensity * flicker * smoothstep(0.45, 1.0, uNight), 1.0);
}`;

/* A book's aurora: its cover's most telling colour, brightened, and a second hue from its palette
   (or a turn towards violet). A colourless cover gets the classic green and violet. */
export function auroraColours(b: GlBook) {
  const hsl = { h: 0, s: 0, l: 0 };
  const primary = new THREE.Color(b.accent);
  primary.getHSL(hsl, THREE.SRGBColorSpace);
  if (hsl.s < 0.18) return { primary: new THREE.Color('#3dffa6'), secondary: new THREE.Color('#9b6bff') };
  primary.setHSL(hsl.h, Math.max(0.78, hsl.s), 0.56, THREE.SRGBColorSpace);
  let secondary: THREE.Color | null = null;
  let best = 0;
  for (const hex of b.palette) {
    const c = new THREE.Color(hex);
    const x = { h: 0, s: 0, l: 0 };
    c.getHSL(x, THREE.SRGBColorSpace);
    const dh = Math.min(Math.abs(x.h - hsl.h), 1 - Math.abs(x.h - hsl.h));
    if (x.s > 0.25 && dh > 0.06 && x.s * dh > best) {
      best = x.s * dh;
      secondary = c.setHSL(x.h, Math.max(0.72, x.s), 0.5, THREE.SRGBColorSpace);
    }
  }
  return { primary, secondary: secondary ?? new THREE.Color().setHSL((hsl.h + 0.83) % 1, 0.8, 0.46, THREE.SRGBColorSpace) };
}

export function makeCurtain(book: GlBook, azimuth: number, distance: number, seed: number, night: THREE.IUniform<number>): Curtain {
  const { primary, secondary } = auroraColours(book);
  const height = 175;
  const u: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uSpread: { value: 1 },
    uHeight: { value: height },
    uLen: { value: 82 },
    uDir: { value: book.rtl ? -1 : 1 },
    uSeed: { value: seed },
    uFoot: { value: new THREE.Vector3(Math.sin(azimuth) * distance, 55, -Math.cos(azimuth) * distance) },
    uAlong: { value: new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth)) },
    uAcross: { value: new THREE.Vector3(-Math.sin(azimuth), 0, Math.cos(azimuth)) },
    uPrimary: { value: primary },
    uSecondary: { value: secondary },
    uIntensity: { value: 0.32 },
    uHover: { value: 0 },
    uWave: { value: -1 },
    uWaveAmt: { value: 0 },
    uNight: night,
  };
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1, 180, 1),
    new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  mesh.frustumCulled = false;
  return { mesh, u, height };
}
