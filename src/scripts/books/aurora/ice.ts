import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { PAGE } from './sky';

/* The frozen lake: a mirror (three's Reflector, at a quarter of the screen's resolution, since it
   is only ever seen blurred) softened by a blur that widens with distance and over drifts of snow,
   dark ice between, all fading to the page's white by day. It gives back under half of the light,
   so the aurora's reflection stays below the books. Reflector clones its uniforms, so the scene sets
   uNight and uTint here each frame. */

const ICE = {
  name: 'IceShader',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uNight: { value: 0 },
    uTint: { value: new THREE.Color() },
    uPage: { value: PAGE.clone() },
    uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uNight;
    uniform vec3 uTint;
    uniform vec3 uPage;
    uniform vec2 uTexel;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <logdepthbuf_pars_fragment>
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
      return v;
    }
    void main() {
      #include <logdepthbuf_fragment>
      vec2 uv = vUv.xy / vUv.w;
      float dist = length(vWorld.xz);
      float snow = smoothstep(0.52, 0.8, fbm(vWorld.xz * 1.6));
      float blur = mix(1.5, 7.0, smoothstep(2.0, 40.0, dist)) + snow * 4.0;
      vec3 refl = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 2.39996;
        float r = sqrt(float(i) + 0.5) / 2.83;
        refl += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * r * blur * uTexel).rgb;
      }
      refl /= 8.0;
      vec3 ice = vec3(0.006, 0.012, 0.022) + uTint * 0.015;
      vec3 night = ice + refl * (0.44 - snow * 0.24) + snow * (vec3(0.03, 0.036, 0.05) + uTint * 0.04);
      gl_FragColor = vec4(mix(uPage, night, uNight), 1.0);
    }`,
};

export function makeIce(size: number, resolution: THREE.Vector2) {
  const mesh = new Reflector(new THREE.PlaneGeometry(size, size), {
    shader: ICE,
    textureWidth: resolution.x,
    textureHeight: resolution.y,
    clipBias: 0.002,
    multisample: 0,
  });
  mesh.rotation.x = -Math.PI / 2;
  const u = (mesh.material as THREE.ShaderMaterial).uniforms;
  /* The blur was tuned on a mirror at half the screen's resolution; it keeps that step. */
  const resize = (w: number, h: number) => {
    mesh.getRenderTarget().setSize(w, h);
    (u.uTexel.value as THREE.Vector2).set(0.5 / w, 0.5 / h);
  };
  resize(resolution.x, resolution.y);
  return { mesh, u, resize };
}
