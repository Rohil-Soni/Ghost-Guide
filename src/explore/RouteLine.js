import * as THREE from 'three';

const vert = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const frag = /* glsl */`
  uniform float uTime; uniform float uRepeat; uniform vec3 uA; uniform vec3 uB;
  varying vec2 vUv;
  void main() {
    float s = step(0.5, fract(vUv.x * uRepeat - uTime * 1.5));
    gl_FragColor = vec4(mix(uA, uB, s), 1.0);
    #include <colorspace_fragment>
  }`;

// Animated dashed tube lifted just above the road.
export class RouteLine {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag,
      uniforms: { uTime: { value: 0 }, uRepeat: { value: 20 }, uA: { value: new THREE.Color('#7C5CFF') }, uB: { value: new THREE.Color('#ffffff') } },
    });
  }

  show(points) {
    this.clear();
    const path = new THREE.CurvePath();
    const lifted = points.map((p) => p.clone().setY(0.45));
    for (let i = 1; i < lifted.length; i++) path.add(new THREE.LineCurve3(lifted[i - 1], lifted[i]));
    const len = path.getLength();
    const geo = new THREE.TubeGeometry(path, Math.max(32, Math.ceil(len * 2)), 0.35, 8, false);
    this.mat.uniforms.uRepeat.value = len / 2.5;
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.name = 'RouteLine';
    this.mesh.renderOrder = 2;
    this.scene.add(this.mesh);
    const box = new THREE.Box3().setFromPoints(points);
    return box;
  }

  clear() {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh = null;
  }

  update(t) {
    if (!this.mesh) return false;
    this.mat.uniforms.uTime.value = t;
    return true;
  }
}
