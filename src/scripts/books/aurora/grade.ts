import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/* The last pass: tone mapping that comes in with the night (so at the start the white stage is the
   page's own white), a little vignette by night, and the conversion to sRGB. A RawShaderMaterial,
   as three's OutputPass is, so the two chunks it includes are not also prepended. */
export function gradePass() {
  const material = new THREE.RawShaderMaterial({
    name: 'GradeShader',
    uniforms: {
      tDiffuse: { value: null },
      toneMappingExposure: { value: 1 },
      uTone: { value: 0 },
      uVignette: { value: 0 },
    },
    vertexShader: /* glsl */ `
      precision highp float;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      attribute vec3 position;
      attribute vec2 uv;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tDiffuse;
      uniform float uTone;
      uniform float uVignette;
      #include <tonemapping_pars_fragment>
      #include <colorspace_pars_fragment>
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        c.rgb = mix(c.rgb, NeutralToneMapping(c.rgb), uTone);
        float v = smoothstep(1.15, 0.35, length((vUv - 0.5) * vec2(1.25, 1.0)));
        c.rgb *= mix(1.0, v, uVignette);
        gl_FragColor = sRGBTransferOETF(vec4(c.rgb, 1.0));
      }`,
  });
  return new ShaderPass(material);
}
